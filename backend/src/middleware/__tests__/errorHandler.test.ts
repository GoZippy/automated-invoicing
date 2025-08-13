import { Request, Response, NextFunction } from 'express';
import { 
  ApiError, 
  errorHandler, 
  asyncHandler,
  NotFound,
  BadRequest,
  Unauthorized,
  Forbidden,
  Conflict,
  TooManyRequests,
  InternalServerError
} from '../errorHandler';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

describe('Error Handler Middleware', () => {
  let mockRequest: Request;
  let mockResponse: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
    mockNext = createMockNext();
  });

  describe('ApiError Class', () => {
    it('should create an ApiError with all properties', () => {
      const error = new ApiError(400, 'Bad Request', 'BAD_REQUEST', { field: 'email' });

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad Request');
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.details).toEqual({ field: 'email' });
      expect(error.isOperational).toBe(true);
      expect(error.stack).toBeDefined();
    });

    it('should create an ApiError without optional properties', () => {
      const error = new ApiError(500, 'Internal Server Error');

      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Internal Server Error');
      expect(error.code).toBeUndefined();
      expect(error.details).toBeUndefined();
    });
  });

  describe('Error Handler Function', () => {
    it('should handle ApiError correctly', () => {
      const error = new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { field: 'email' });

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          statusCode: 400,
          details: { field: 'email' },
          timestamp: expect.any(String),
          path: mockRequest.url,
          method: mockRequest.method,
        },
      });
    });

    it('should handle ZodError correctly', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['email'],
          message: 'Expected string, received number',
        },
      ]);

      errorHandler(zodError, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          statusCode: 400,
          details: [
            {
              field: 'email',
              message: 'Expected string, received number',
            },
          ],
          timestamp: expect.any(String),
          path: mockRequest.url,
          method: mockRequest.method,
        },
      });
    });

    it('should handle JsonWebTokenError correctly', () => {
      const jwtError = new JsonWebTokenError('Invalid token');

      errorHandler(jwtError, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Invalid token',
          code: 'INVALID_TOKEN',
          statusCode: 401,
          timestamp: expect.any(String),
          path: mockRequest.url,
          method: mockRequest.method,
        },
      });
    });

    it('should handle TokenExpiredError correctly', () => {
      const expiredError = new TokenExpiredError('Token expired', new Date());

      errorHandler(expiredError, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Token expired',
          code: 'TOKEN_EXPIRED',
          statusCode: 401,
          timestamp: expect.any(String),
          path: mockRequest.url,
          method: mockRequest.method,
        },
      });
    });

    it('should handle network errors correctly', () => {
      const networkError = new Error('ECONNREFUSED');
      networkError.name = 'ECONNREFUSED';

      errorHandler(networkError, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Service temporarily unavailable',
          code: 'SERVICE_UNAVAILABLE',
          statusCode: 503,
          timestamp: expect.any(String),
          path: mockRequest.url,
          method: mockRequest.method,
        },
      });
    });

    it('should handle unknown errors correctly', () => {
      const unknownError = new Error('Something went wrong');

      errorHandler(unknownError, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
          statusCode: 500,
          timestamp: expect.any(String),
          path: mockRequest.url,
          method: mockRequest.method,
        },
      });
    });

    it('should include stack trace in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');
      errorHandler(error, mockRequest, mockResponse, mockNext);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.error.stack).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stack trace in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Test error');
      errorHandler(error, mockRequest, mockResponse, mockNext);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.error.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Async Handler', () => {
    it('should handle successful async operations', async () => {
      const asyncFunction = jest.fn().mockResolvedValue('success');
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(mockRequest, mockResponse, mockNext);

      expect(asyncFunction).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch and forward async errors', async () => {
      const error = new Error('Async error');
      const asyncFunction = jest.fn().mockRejectedValue(error);
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(mockRequest, mockResponse, mockNext);

      expect(asyncFunction).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle synchronous errors in async handler', async () => {
      const error = new Error('Sync error');
      const asyncFunction = jest.fn().mockImplementation(() => {
        throw error;
      });
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('Error Factory Functions', () => {
    it('should create NotFound error', () => {
      const error = NotFound('Resource not found');
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Resource not found');
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should create BadRequest error', () => {
      const error = BadRequest('Invalid input', { field: 'email' });
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should create Unauthorized error', () => {
      const error = Unauthorized('Please authenticate');
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Please authenticate');
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should create Forbidden error', () => {
      const error = Forbidden('Access denied');
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Access denied');
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should create Conflict error', () => {
      const error = Conflict('Resource already exists');
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Resource already exists');
      expect(error.code).toBe('CONFLICT');
    });

    it('should create TooManyRequests error', () => {
      const error = TooManyRequests('Rate limit exceeded');
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(429);
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.code).toBe('TOO_MANY_REQUESTS');
    });

    it('should create InternalServerError', () => {
      const error = InternalServerError('Something went wrong');
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Something went wrong');
      expect(error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('Error Logging', () => {
    it('should log errors with logger', () => {
      const { logger } = require('../../utils/logger');
      const error = new ApiError(500, 'Test error');

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(logger.error).toHaveBeenCalledWith({
        type: 'ERROR',
        error: {
          message: error.message,
          code: error.code,
          statusCode: error.statusCode,
          stack: error.stack,
        },
        request: {
          id: mockRequest.id,
          method: mockRequest.method,
          url: mockRequest.url,
          ip: mockRequest.ip,
          userAgent: mockRequest.headers['user-agent'],
          userId: undefined,
        },
      });
    });

    it('should include user ID in error logs when available', () => {
      const { logger } = require('../../utils/logger');
      const error = new ApiError(403, 'Access denied');
      mockRequest.user = { id: 'user-123', email: 'test@example.com' };

      errorHandler(error, mockRequest, mockResponse, mockNext);

      const logCall = (logger.error as jest.Mock).mock.calls[0][0];
      expect(logCall.request.userId).toBe('user-123');
    });
  });

  describe('Headers Already Sent', () => {
    it('should not send response if headers already sent', () => {
      const error = new ApiError(400, 'Bad request');
      mockResponse.headersSent = true;

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});