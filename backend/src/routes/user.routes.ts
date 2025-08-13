import { Router } from 'express';
import { body, param } from 'express-validator';
import { userController } from '../controllers/user.controller';
import { validate } from '../middleware/validate';
import { apiKeyRateLimiter } from '../middleware/rateLimiter';
import { authorize } from '../middleware/auth';

const router = Router();

// Get current user profile
router.get(
  '/profile',
  userController.getProfile
);

// Update user profile
router.put(
  '/profile',
  body('fullName').optional().notEmpty().trim(),
  body('companyName').optional().trim(),
  body('phone').optional().isMobilePhone('any'),
  body('settings').optional().isObject(),
  validate,
  userController.updateProfile
);

// Change password
router.post(
  '/change-password',
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
  validate,
  userController.changePassword
);

// List user's API keys
router.get(
  '/api-keys',
  userController.listApiKeys
);

// Create new API key
router.post(
  '/api-keys',
  apiKeyRateLimiter,
  body('name').notEmpty().trim(),
  body('permissions').optional().isObject(),
  body('expiresAt').optional().isISO8601(),
  validate,
  userController.createApiKey
);

// Update API key
router.put(
  '/api-keys/:id',
  param('id').isUUID(),
  body('name').optional().notEmpty().trim(),
  body('permissions').optional().isObject(),
  body('isActive').optional().isBoolean(),
  validate,
  userController.updateApiKey
);

// Delete API key
router.delete(
  '/api-keys/:id',
  param('id').isUUID(),
  validate,
  userController.deleteApiKey
);

// Get user preferences
router.get(
  '/preferences',
  userController.getPreferences
);

// Update user preferences
router.put(
  '/preferences',
  body('theme').optional().isIn(['light', 'dark', 'auto']),
  body('language').optional().isIn(['en', 'es', 'fr', 'de']),
  body('timezone').optional().isString(),
  body('dateFormat').optional().isString(),
  body('currencyFormat').optional().isString(),
  body('notifications').optional().isObject(),
  validate,
  userController.updatePreferences
);

// Get user activity log
router.get(
  '/activity',
  userController.getActivityLog
);

// Export user data (GDPR compliance)
router.get(
  '/export-data',
  userController.exportUserData
);

// Delete user account
router.delete(
  '/account',
  body('password').notEmpty(),
  body('confirmation').equals('DELETE'),
  validate,
  userController.deleteAccount
);

// Admin routes (require admin role)
router.get(
  '/all',
  authorize('admin', 'super_admin'),
  userController.listAllUsers
);

router.put(
  '/:id/role',
  authorize('super_admin'),
  param('id').isUUID(),
  body('role').isIn(['user', 'admin', 'super_admin']),
  validate,
  userController.updateUserRole
);

router.put(
  '/:id/status',
  authorize('admin', 'super_admin'),
  param('id').isUUID(),
  body('isActive').isBoolean(),
  validate,
  userController.updateUserStatus
);

export default router;