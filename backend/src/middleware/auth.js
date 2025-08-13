const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { dbUtils } = require('../database/connection');
const logger = require('../utils/logger');

// Authentication middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        message: 'Please provide a valid authentication token',
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await dbUtils.findById('users', decoded.userId);
    
    if (!user || !user.is_active) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'User not found or account is inactive',
      });
    }
    
    // Check if token is expired
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Authentication token has expired',
      });
    }
    
    // Add user to request object
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      company_name: user.company_name,
    };
    
    // Log successful authentication
    logger.logSecurity('AUTH_SUCCESS', {
      userId: user.id,
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    next();
  } catch (error) {
    logger.logSecurity('AUTH_FAILURE', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid',
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'The authentication token has expired',
      });
    }
    
    logger.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication',
    });
  }
};

// Role-based authorization middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please authenticate to access this resource',
      });
    }
    
    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(userRole)) {
      logger.logSecurity('AUTHORIZATION_FAILURE', {
        userId: req.user.id,
        userRole,
        requiredRoles: allowedRoles,
        endpoint: req.originalUrl,
        method: req.method,
      });
      
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'You do not have permission to access this resource',
      });
    }
    
    next();
  };
};

// Extract token from request
const extractToken = (req) => {
  // Check Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.substring(7);
  }
  
  // Check query parameter
  if (req.query.token) {
    return req.query.token;
  }
  
  // Check cookie
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  return null;
};

// Generate JWT token
const generateToken = (userId, role) => {
  const payload = {
    userId,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (parseInt(process.env.JWT_EXPIRES_IN) || 7 * 24 * 60 * 60), // 7 days default
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET);
};

// Hash password
const hashPassword = async (password) => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

// Compare password
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// Validate password strength
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Validate email format
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Rate limiting for authentication endpoints
const authRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
};

// Session management
const createSession = async (userId, req) => {
  const sessionToken = require('crypto').randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  const sessionData = {
    user_id: userId,
    session_token: sessionToken,
    expires_at: expiresAt,
    ip_address: req.ip,
    user_agent: req.get('User-Agent'),
  };
  
  await dbUtils.insert('sessions', sessionData);
  
  return sessionToken;
};

const validateSession = async (sessionToken) => {
  const sessions = await dbUtils.find('sessions', {
    session_token: sessionToken,
    is_active: true,
  });
  
  if (sessions.length === 0) {
    return null;
  }
  
  const session = sessions[0];
  
  if (new Date() > new Date(session.expires_at)) {
    // Session expired, mark as inactive
    await dbUtils.update('sessions', session.id, { is_active: false });
    return null;
  }
  
  return session;
};

const invalidateSession = async (sessionToken) => {
  const sessions = await dbUtils.find('sessions', { session_token: sessionToken });
  
  if (sessions.length > 0) {
    await dbUtils.update('sessions', sessions[0].id, { is_active: false });
  }
};

module.exports = {
  authMiddleware,
  requireRole,
  generateToken,
  hashPassword,
  comparePassword,
  validatePassword,
  validateEmail,
  authRateLimit,
  createSession,
  validateSession,
  invalidateSession,
};