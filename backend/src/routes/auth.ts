import { Router } from 'express';
import { body } from 'express-validator';
import { authRateLimiter } from '@/middleware/rateLimiter';
import { authenticate, AuthRequest } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
} from '@/controllers/authController';

const router = Router();

// Registration
router.post('/register',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('firstName').trim().isLength({ min: 1 }).withMessage('First name is required'),
    body('lastName').trim().isLength({ min: 1 }).withMessage('Last name is required'),
    body('companyName').optional().trim(),
  ],
  asyncHandler(register)
);

// Login
router.post('/login',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  asyncHandler(login)
);

// Refresh token
router.post('/refresh',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  ],
  asyncHandler(refreshToken)
);

// Logout
router.post('/logout',
  authenticate,
  asyncHandler(logout)
);

// Get user profile
router.get('/profile',
  authenticate,
  asyncHandler(getProfile)
);

// Update user profile
router.put('/profile',
  authenticate,
  [
    body('firstName').optional().trim().isLength({ min: 1 }).withMessage('First name cannot be empty'),
    body('lastName').optional().trim().isLength({ min: 1 }).withMessage('Last name cannot be empty'),
    body('companyName').optional().trim(),
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  ],
  asyncHandler(updateProfile)
);

// Change password
router.put('/password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long'),
  ],
  asyncHandler(changePassword)
);

// Forgot password
router.post('/forgot-password',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  ],
  asyncHandler(forgotPassword)
);

// Reset password
router.post('/reset-password',
  authRateLimiter,
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  ],
  asyncHandler(resetPassword)
);

// Verify email
router.post('/verify-email',
  [
    body('token').notEmpty().withMessage('Verification token is required'),
  ],
  asyncHandler(verifyEmail)
);

// Resend verification email
router.post('/resend-verification',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  ],
  asyncHandler(resendVerification)
);

export default router;