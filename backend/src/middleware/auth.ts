import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getSupabaseServiceClient } from '../config/supabase';
import { Unauthorized, Forbidden } from './errorHandler';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
      token?: string;
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw Unauthorized('No token provided');
    }

    const token = authHeader.substring(7);
    req.token = token;

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      sub: string;
      email: string;
      role: string;
    };

    // Get user from database to ensure they still exist and are active
    const supabase = getSupabaseServiceClient();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, role, is_active')
      .eq('id', decoded.sub)
      .single();

    if (error || !profile) {
      throw Unauthorized('User not found');
    }

    if (!profile.is_active) {
      throw Forbidden('Account is deactivated');
    }

    // Attach user to request
    req.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(Unauthorized('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(Unauthorized('Token expired'));
    } else {
      next(error);
    }
  }
};

// Middleware to check if user has specific role
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(Unauthorized());
    }

    if (!roles.includes(req.user.role)) {
      return next(Forbidden('Insufficient permissions'));
    }

    next();
  };
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      sub: string;
      email: string;
      role: string;
    };

    const supabase = getSupabaseServiceClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, role, is_active')
      .eq('id', decoded.sub)
      .single();

    if (profile && profile.is_active) {
      req.user = {
        id: profile.id,
        email: profile.email,
        role: profile.role,
      };
    }
  } catch (error) {
    // Log error but don't fail the request
    logger.debug('Optional auth failed:', error);
  }

  next();
};

// API Key authentication
export const authenticateApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw Unauthorized('No API key provided');
    }

    // Hash the API key to compare with stored hash
    const crypto = require('crypto');
    const keyHash = crypto
      .createHash('sha256')
      .update(apiKey + process.env.API_KEY_SALT)
      .digest('hex');

    const supabase = getSupabaseServiceClient();
    const { data: apiKeyRecord, error } = await supabase
      .from('api_keys')
      .select('user_id, is_active, expires_at, permissions')
      .eq('key_hash', keyHash)
      .single();

    if (error || !apiKeyRecord) {
      throw Unauthorized('Invalid API key');
    }

    if (!apiKeyRecord.is_active) {
      throw Forbidden('API key is deactivated');
    }

    if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
      throw Unauthorized('API key expired');
    }

    // Update last used timestamp
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key_hash', keyHash);

    // Get user associated with API key
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, role, is_active')
      .eq('id', apiKeyRecord.user_id)
      .single();

    if (!profile || !profile.is_active) {
      throw Forbidden('Associated user account is deactivated');
    }

    req.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};

// Combined auth - accepts either JWT or API key
export const authenticateAny = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey) {
    return authenticateApiKey(req, res, next);
  } else {
    return authenticate(req, res, next);
  }
};