import { Router } from 'express';
import { body } from 'express-validator';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { authRateLimiter } from '../middleware/rateLimiter';
import { authenticate } from '../middleware/auth';

const router = Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('fullName').notEmpty().trim(),
  body('companyName').optional().trim(),
  body('phone').optional().isMobilePhone('any'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

const forgotPasswordValidation = [
  body('email').isEmail().normalizeEmail(),
];

const resetPasswordValidation = [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }),
];

const refreshTokenValidation = [
  body('refreshToken').notEmpty(),
];

// Routes
router.post(
  '/register',
  authRateLimiter,
  registerValidation,
  validate,
  authController.register
);

router.post(
  '/login',
  authRateLimiter,
  loginValidation,
  validate,
  authController.login
);

router.post(
  '/logout',
  authenticate,
  authController.logout
);

router.post(
  '/refresh',
  refreshTokenValidation,
  validate,
  authController.refreshToken
);

router.post(
  '/forgot-password',
  authRateLimiter,
  forgotPasswordValidation,
  validate,
  authController.forgotPassword
);

router.post(
  '/reset-password',
  authRateLimiter,
  resetPasswordValidation,
  validate,
  authController.resetPassword
);

router.get(
  '/verify-email/:token',
  authController.verifyEmail
);

router.post(
  '/resend-verification',
  authRateLimiter,
  authenticate,
  authController.resendVerification
);

export default router;