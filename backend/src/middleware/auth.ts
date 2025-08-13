import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDatabase } from '@/config/database';
import { AuthenticationError, AuthorizationError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    company_name?: string;
    is_active: boolean;
  };
}

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Verify JWT token and authenticate user
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      throw new AuthenticationError('Authentication token required');
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET environment variable not set');
      throw new Error('Authentication configuration error');
    }

    // Verify token
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    
    // Get user from database
    const db = getDatabase();
    const user = await db('users')
      .select('id', 'email', 'role', 'company_name', 'is_active')
      .where({ id: decoded.id })
      .first();

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    if (!user.is_active) {
      throw new AuthenticationError('User account is deactivated');
    }

    // Update last login
    await db('users')
      .where({ id: user.id })
      .update({ last_login_at: new Date() });

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError('Invalid authentication token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError('Authentication token has expired'));
    } else {
      next(error);
    }
  }
};

// Optional authentication (user may or may not be logged in)
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return next();
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return next();
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    
    const db = getDatabase();
    const user = await db('users')
      .select('id', 'email', 'role', 'company_name', 'is_active')
      .where({ id: decoded.id })
      .first();

    if (user && user.is_active) {
      req.user = user;
    }

    next();
  } catch (error) {
    // For optional auth, we don't throw errors, just continue without user
    next();
  }
};

// Authorization middleware - check user roles
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError());
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Authorization failed', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.path,
      });
      return next(new AuthorizationError('Insufficient permissions for this action'));
    }

    next();
  };
};

// Check if user owns the resource or is admin
export const authorizeOwnerOrAdmin = (getResourceUserId: (req: AuthRequest) => Promise<string | null>) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new AuthenticationError());
      }

      // Admins can access any resource
      if (req.user.role === 'admin') {
        return next();
      }

      // Check if user owns the resource
      const resourceUserId = await getResourceUserId(req);
      
      if (!resourceUserId) {
        return next(new AuthorizationError('Resource not found or access denied'));
      }

      if (resourceUserId !== req.user.id) {
        logger.warn('Resource access denied', {
          userId: req.user.id,
          resourceUserId,
          path: req.path,
        });
        return next(new AuthorizationError('You can only access your own resources'));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Extract token from request headers
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }

  // Check for Bearer token
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check for simple token
  return authHeader;
}

// Generate JWT token
export const generateToken = (user: { id: string; email: string; role: string }): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable not set');
  }

  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: 'intelligent-invoicing',
  });
};

// Verify refresh token
export const verifyRefreshToken = (token: string): JwtPayload => {
  const jwtSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT secret not configured');
  }

  return jwt.verify(token, jwtSecret) as JwtPayload;
};

// Generate refresh token
export const generateRefreshToken = (user: { id: string; email: string; role: string }): string => {
  const jwtSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_REFRESH_SECRET environment variable not set');
  }

  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, jwtSecret, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    issuer: 'intelligent-invoicing',
  });
};