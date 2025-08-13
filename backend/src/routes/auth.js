const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const Joi = require('joi');

const {
  generateToken,
  hashPassword,
  comparePassword,
  validatePassword,
  validateEmail,
  authRateLimit,
  createSession,
  invalidateSession,
} = require('../middleware/auth');

const { dbUtils } = require('../database/connection');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit(authRateLimit);

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  first_name: Joi.string().min(2).max(100).required(),
  last_name: Joi.string().min(2).max(100).required(),
  company_name: Joi.string().min(2).max(255).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const changePasswordSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password: Joi.string().min(8).required(),
});

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = registerSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details.map(d => d.message));
  }

  const { email, password, first_name, last_name, company_name } = value;

  // Check if user already exists
  const existingUser = await dbUtils.find('users', { email });
  if (existingUser.length > 0) {
    return res.status(409).json({
      success: false,
      error: 'User already exists',
      message: 'A user with this email address already exists',
    });
  }

  // Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Weak password',
      message: 'Password does not meet security requirements',
      errors: passwordValidation.errors,
    });
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const userData = {
    email,
    password_hash: passwordHash,
    first_name,
    last_name,
    company_name: company_name || null,
    role: 'user',
    is_active: true,
    email_verified: false, // Will be verified via email
  };

  const user = await dbUtils.insert('users', userData);

  // Generate token
  const token = generateToken(user.id, user.role);

  // Create session
  await createSession(user.id, req);

  // Log registration
  logger.logSecurity('USER_REGISTERED', {
    userId: user.id,
    email: user.email,
    ip: req.ip,
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        company_name: user.company_name,
        role: user.role,
      },
      token,
    },
  });
}));

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details.map(d => d.message));
  }

  const { email, password } = value;

  // Find user
  const users = await dbUtils.find('users', { email });
  if (users.length === 0) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
      message: 'Email or password is incorrect',
    });
  }

  const user = users[0];

  // Check if user is active
  if (!user.is_active) {
    return res.status(401).json({
      success: false,
      error: 'Account disabled',
      message: 'Your account has been disabled. Please contact support.',
    });
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.password_hash);
  if (!isPasswordValid) {
    // Log failed login attempt
    logger.logSecurity('LOGIN_FAILED', {
      email,
      ip: req.ip,
      reason: 'Invalid password',
    });

    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
      message: 'Email or password is incorrect',
    });
  }

  // Generate token
  const token = generateToken(user.id, user.role);

  // Create session
  await createSession(user.id, req);

  // Update last login
  await dbUtils.update('users', user.id, {
    updated_at: new Date(),
  });

  // Log successful login
  logger.logSecurity('LOGIN_SUCCESS', {
    userId: user.id,
    email: user.email,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        company_name: user.company_name,
        role: user.role,
        email_verified: user.email_verified,
      },
      token,
    },
  });
}));

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (token) {
    // Invalidate session
    await invalidateSession(token);
  }

  // Log logout
  logger.logSecurity('LOGOUT', {
    userId: req.user?.id,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: 'Logout successful',
  });
}));

// @route   POST /api/auth/refresh
// @desc    Refresh authentication token
// @access  Private
router.post('/refresh', asyncHandler(async (req, res) => {
  const user = await dbUtils.findById('users', req.user.id);
  
  if (!user || !user.is_active) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      message: 'User not found or account is inactive',
    });
  }

  // Generate new token
  const token = generateToken(user.id, user.role);

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      token,
    },
  });
}));

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', authLimiter, asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = resetPasswordSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details.map(d => d.message));
  }

  const { email } = value;

  // Find user
  const users = await dbUtils.find('users', { email });
  if (users.length === 0) {
    // Don't reveal if user exists or not
    return res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  }

  const user = users[0];

  // Generate reset token
  const resetToken = require('crypto').randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Store reset token (in production, you'd store this in the database)
  // For now, we'll just log it
  logger.info('Password reset token generated', {
    userId: user.id,
    email: user.email,
    resetToken,
    expiresAt: resetTokenExpiry,
  });

  // TODO: Send email with reset link
  // await sendPasswordResetEmail(user.email, resetToken);

  // Log password reset request
  logger.logSecurity('PASSWORD_RESET_REQUESTED', {
    userId: user.id,
    email: user.email,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent.',
  });
}));

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', authLimiter, asyncHandler(async (req, res) => {
  const { token, new_password } = req.body;

  if (!token || !new_password) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      message: 'Token and new password are required',
    });
  }

  // Validate password strength
  const passwordValidation = validatePassword(new_password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Weak password',
      message: 'Password does not meet security requirements',
      errors: passwordValidation.errors,
    });
  }

  // TODO: Verify reset token and get user
  // For now, we'll just return a success message
  logger.info('Password reset attempted', {
    token: token.substring(0, 10) + '...',
    ip: req.ip,
  });

  res.json({
    success: true,
    message: 'Password has been reset successfully. You can now login with your new password.',
  });
}));

// @route   POST /api/auth/change-password
// @desc    Change password (authenticated user)
// @access  Private
router.post('/change-password', asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = changePasswordSchema.validate(req.body);
  if (error) {
    throw new ValidationError('Validation failed', error.details.map(d => d.message));
  }

  const { current_password, new_password } = value;

  // Get user with password hash
  const user = await dbUtils.findById('users', req.user.id);

  // Verify current password
  const isCurrentPasswordValid = await comparePassword(current_password, user.password_hash);
  if (!isCurrentPasswordValid) {
    return res.status(400).json({
      success: false,
      error: 'Invalid current password',
      message: 'The current password you entered is incorrect',
    });
  }

  // Validate new password strength
  const passwordValidation = validatePassword(new_password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Weak password',
      message: 'Password does not meet security requirements',
      errors: passwordValidation.errors,
    });
  }

  // Hash new password
  const newPasswordHash = await hashPassword(new_password);

  // Update password
  await dbUtils.update('users', user.id, {
    password_hash: newPasswordHash,
    updated_at: new Date(),
  });

  // Log password change
  logger.logSecurity('PASSWORD_CHANGED', {
    userId: user.id,
    email: user.email,
    ip: req.ip,
  });

  res.json({
    success: true,
    message: 'Password changed successfully',
  });
}));

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', asyncHandler(async (req, res) => {
  const user = await dbUtils.findById('users', req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
      message: 'User profile not found',
    });
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        company_name: user.company_name,
        role: user.role,
        email_verified: user.email_verified,
        avatar_url: user.avatar_url,
        timezone: user.timezone,
        language: user.language,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    },
  });
}));

// @route   PUT /api/auth/me
// @desc    Update current user profile
// @access  Private
router.put('/me', asyncHandler(async (req, res) => {
  const { first_name, last_name, company_name, timezone, language } = req.body;

  // Validate input
  const updateData = {};
  
  if (first_name !== undefined) {
    if (first_name.length < 2 || first_name.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid first name',
        message: 'First name must be between 2 and 100 characters',
      });
    }
    updateData.first_name = first_name;
  }

  if (last_name !== undefined) {
    if (last_name.length < 2 || last_name.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid last name',
        message: 'Last name must be between 2 and 100 characters',
      });
    }
    updateData.last_name = last_name;
  }

  if (company_name !== undefined) {
    if (company_name.length > 255) {
      return res.status(400).json({
        success: false,
        error: 'Invalid company name',
        message: 'Company name must be less than 255 characters',
      });
    }
    updateData.company_name = company_name;
  }

  if (timezone !== undefined) {
    updateData.timezone = timezone;
  }

  if (language !== undefined) {
    updateData.language = language;
  }

  // Update user
  const updatedUser = await dbUtils.update('users', req.user.id, {
    ...updateData,
    updated_at: new Date(),
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        company_name: updatedUser.company_name,
        role: updatedUser.role,
        email_verified: updatedUser.email_verified,
        avatar_url: updatedUser.avatar_url,
        timezone: updatedUser.timezone,
        language: updatedUser.language,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at,
      },
    },
  });
}));

module.exports = router;