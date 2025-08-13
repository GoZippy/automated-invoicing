import { Router } from 'express';
import { query } from 'express-validator';
import { statsController } from '../controllers/stats.controller';
import { validate } from '../middleware/validate';

const router = Router();

// Common validation for date ranges
const dateRangeValidation = [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('period').optional().isIn(['day', 'week', 'month', 'quarter', 'year', 'custom']),
];

// Get dashboard statistics
router.get(
  '/dashboard',
  ...dateRangeValidation,
  validate,
  statsController.getDashboardStats
);

// Get revenue statistics
router.get(
  '/revenue',
  ...dateRangeValidation,
  query('groupBy').optional().isIn(['day', 'week', 'month', 'customer', 'category']),
  query('currency').optional().isLength({ min: 3, max: 3 }),
  validate,
  statsController.getRevenueStats
);

// Get invoice statistics
router.get(
  '/invoices',
  ...dateRangeValidation,
  query('groupBy').optional().isIn(['status', 'customer', 'date', 'amount_range']),
  validate,
  statsController.getInvoiceStats
);

// Get payment statistics
router.get(
  '/payments',
  ...dateRangeValidation,
  query('groupBy').optional().isIn(['method', 'status', 'date']),
  validate,
  statsController.getPaymentStats
);

// Get customer statistics
router.get(
  '/customers',
  ...dateRangeValidation,
  query('sortBy').optional().isIn(['revenue', 'invoice_count', 'avg_payment_time']),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
  statsController.getCustomerStats
);

// Get trend analysis
router.get(
  '/trends',
  ...dateRangeValidation,
  query('metrics').optional().isArray(),
  query('metrics.*').optional().isIn(['revenue', 'invoice_count', 'avg_invoice_value', 'payment_time']),
  validate,
  statsController.getTrendAnalysis
);

// Get performance metrics
router.get(
  '/performance',
  ...dateRangeValidation,
  validate,
  statsController.getPerformanceMetrics
);

// Get forecasting data
router.get(
  '/forecast',
  query('forecastPeriod').optional().isIn(['week', 'month', 'quarter']),
  query('confidenceLevel').optional().isFloat({ min: 0.5, max: 0.99 }),
  validate,
  statsController.getForecast
);

// Export statistics as CSV
router.get(
  '/export/csv',
  query('type').isIn(['revenue', 'invoices', 'customers', 'payments']),
  ...dateRangeValidation,
  validate,
  statsController.exportStatsAsCSV
);

// Export statistics as PDF report
router.get(
  '/export/pdf',
  query('reportType').isIn(['summary', 'detailed', 'executive']),
  ...dateRangeValidation,
  validate,
  statsController.exportStatsAsPDF
);

// Get real-time statistics (WebSocket endpoint info)
router.get(
  '/realtime/info',
  statsController.getRealtimeInfo
);

// Get custom report
router.post(
  '/custom-report',
  query('name').notEmpty().trim(),
  query('metrics').isArray({ min: 1 }),
  query('filters').optional().isObject(),
  ...dateRangeValidation,
  validate,
  statsController.generateCustomReport
);

export default router;