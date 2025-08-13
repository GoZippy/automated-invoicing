import { Router } from 'express';
import authRoutes from './auth.routes';
import invoiceRoutes from './invoice.routes';
import aiRoutes from './ai.routes';
import userRoutes from './user.routes';
import statsRoutes from './stats.routes';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes
router.use('/auth', authRoutes);

// Protected routes (require authentication)
router.use('/invoices', authenticate, invoiceRoutes);
router.use('/ai', authenticate, aiRoutes);
router.use('/users', authenticate, userRoutes);
router.use('/stats', authenticate, statsRoutes);

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    message: 'API Documentation',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /auth/register': 'Register a new user',
        'POST /auth/login': 'Login user',
        'POST /auth/logout': 'Logout user',
        'POST /auth/refresh': 'Refresh access token',
        'POST /auth/forgot-password': 'Request password reset',
        'POST /auth/reset-password': 'Reset password',
      },
      invoices: {
        'GET /invoices': 'List all invoices',
        'POST /invoices': 'Create new invoice',
        'GET /invoices/:id': 'Get invoice by ID',
        'PUT /invoices/:id': 'Update invoice',
        'DELETE /invoices/:id': 'Delete invoice',
        'POST /invoices/:id/line-items': 'Add line items',
        'GET /invoices/search': 'Search invoices',
        'POST /invoices/:id/send': 'Send invoice',
        'POST /invoices/:id/payment': 'Record payment',
      },
      ai: {
        'POST /ai/process-invoice': 'Process invoice with OCR and AI',
        'POST /ai/chat': 'Natural language query',
        'POST /ai/validate-invoice': 'Validate invoice data',
        'GET /ai/suggestions': 'Get AI suggestions',
      },
      users: {
        'GET /users/profile': 'Get user profile',
        'PUT /users/profile': 'Update user profile',
        'GET /users/api-keys': 'List API keys',
        'POST /users/api-keys': 'Create API key',
        'DELETE /users/api-keys/:id': 'Delete API key',
      },
      stats: {
        'GET /stats/dashboard': 'Get dashboard statistics',
        'GET /stats/revenue': 'Get revenue statistics',
        'GET /stats/invoices': 'Get invoice statistics',
        'GET /stats/trends': 'Get trend analysis',
      },
    },
  });
});

// Health check for protected routes
router.get('/health', authenticate, (req, res) => {
  res.json({
    status: 'healthy',
    user: (req as any).user?.id,
    timestamp: new Date().toISOString(),
  });
});

export default router;