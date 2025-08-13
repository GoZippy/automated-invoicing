import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
  details?: any;
}

export class ApiError extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;
  code?: string;
  details?: any;

  constructor(statusCode: number, message: string, code?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let { statusCode = 500, message, code, details } = err;

  // Log error
  logger.error({
    message: err.message,
    statusCode,
    code,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id,
  });

  // Handle specific error types
  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation error';
    details = err.errors;
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Service unavailable';
    code = 'SERVICE_UNAVAILABLE';
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && !err.isOperational) {
    message = 'Internal server error';
    details = undefined;
  }

  res.status(statusCode).json({
    error: {
      message,
      code: code || 'INTERNAL_ERROR',
      statusCode,
      details,
      timestamp: new Date().toISOString(),
      path: req.url,
    },
  });
};

// Async error wrapper
export const asyncHandler = (fn: Function) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Common error responses
export const BadRequest = (message: string, details?: any) =>
  new ApiError(400, message, 'BAD_REQUEST', details);

export const Unauthorized = (message = 'Unauthorized') =>
  new ApiError(401, message, 'UNAUTHORIZED');

export const Forbidden = (message = 'Forbidden') =>
  new ApiError(403, message, 'FORBIDDEN');

export const NotFound = (message = 'Not found') =>
  new ApiError(404, message, 'NOT_FOUND');

export const Conflict = (message: string, details?: any) =>
  new ApiError(409, message, 'CONFLICT', details);

export const TooManyRequests = (message = 'Too many requests') =>
  new ApiError(429, message, 'TOO_MANY_REQUESTS');

export const InternalError = (message = 'Internal server error', details?: any) =>
  new ApiError(500, message, 'INTERNAL_ERROR', details);

export const ServiceUnavailable = (message = 'Service unavailable') =>
  new ApiError(503, message, 'SERVICE_UNAVAILABLE');