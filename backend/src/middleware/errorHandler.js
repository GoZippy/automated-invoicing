const logger = require('../utils/logger');

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429);
  }
}

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  
  // Log error
  logger.logError(err, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
  });
  
  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new NotFoundError(message);
  }
  
  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value: ${field}`;
    error = new ConflictError(message);
  }
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = 'Validation Error';
    const errors = Object.values(err.errors).map(val => val.message);
    error = new ValidationError(message, errors);
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new AuthenticationError(message);
  }
  
  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new AuthenticationError(message);
  }
  
  // Rate limiting errors
  if (err.statusCode === 429) {
    error = new RateLimitError();
  }
  
  // Database connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    const message = 'Database connection failed';
    error = new AppError(message, 503, false);
  }
  
  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large';
    error = new ValidationError(message);
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    error = new ValidationError(message);
  }
  
  // Default error
  if (!error.statusCode) {
    error.statusCode = 500;
    error.message = 'Internal server error';
  }
  
  // Development error response
  if (process.env.NODE_ENV === 'development') {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      statusCode: error.statusCode,
      stack: error.stack,
      details: error.errors || [],
    });
  }
  
  // Production error response
  const response = {
    success: false,
    error: error.message,
    statusCode: error.statusCode,
  };
  
  // Add validation errors if they exist
  if (error.errors && error.errors.length > 0) {
    response.errors = error.errors;
  }
  
  // Add request ID for tracking
  if (req.id) {
    response.requestId = req.id;
  }
  
  res.status(error.statusCode).json(response);
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError('Route');
  next(error);
};

// Validation middleware
const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });
      
      if (error) {
        const errors = error.details.map(detail => detail.message);
        throw new ValidationError('Validation failed', errors);
      }
      
      req.body = value;
      next();
    } catch (err) {
      next(err);
    }
  };
};

// File upload error handler
const handleFileUploadError = (err, req, res, next) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        message: 'The uploaded file exceeds the maximum allowed size',
      });
    }
    
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files',
        message: 'Too many files were uploaded',
      });
    }
    
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected file field',
        message: 'An unexpected file field was detected',
      });
    }
    
    logger.error('File upload error:', err);
    return res.status(500).json({
      success: false,
      error: 'File upload failed',
      message: 'An error occurred while uploading the file',
    });
  }
  
  next();
};

// Database error handler
const handleDatabaseError = (err, req, res, next) => {
  if (err) {
    logger.error('Database error:', err);
    
    // Check for specific database errors
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({
        success: false,
        error: 'Duplicate entry',
        message: 'A record with this information already exists',
      });
    }
    
    if (err.code === '23503') { // Foreign key violation
      return res.status(400).json({
        success: false,
        error: 'Reference error',
        message: 'Referenced record does not exist',
      });
    }
    
    if (err.code === '23514') { // Check violation
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Data does not meet the required constraints',
      });
    }
    
    // Generic database error
    return res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'An error occurred while accessing the database',
    });
  }
  
  next();
};

// Request timeout handler
const timeoutHandler = (timeout = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      res.status(408).json({
        success: false,
        error: 'Request timeout',
        message: 'The request took too long to process',
      });
    }, timeout);
    
    res.on('finish', () => {
      clearTimeout(timer);
    });
    
    next();
  };
};

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  validateRequest,
  handleFileUploadError,
  handleDatabaseError,
  timeoutHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
};