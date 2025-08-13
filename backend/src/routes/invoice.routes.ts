import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { invoiceController } from '../controllers/invoice.controller';
import { validate } from '../middleware/validate';
import { uploadRateLimiter } from '../middleware/rateLimiter';
import { upload } from '../middleware/upload';

const router = Router();

// Validation rules
const createInvoiceValidation = [
  body('invoiceNumber').notEmpty().trim(),
  body('invoiceDate').isISO8601().toDate(),
  body('dueDate').optional().isISO8601().toDate(),
  body('vendorName').notEmpty().trim(),
  body('customerName').notEmpty().trim(),
  body('currency').optional().isLength({ min: 3, max: 3 }).default('USD'),
  body('lineItems').isArray({ min: 1 }).withMessage('At least one line item is required'),
  body('lineItems.*.description').notEmpty().trim(),
  body('lineItems.*.quantity').isFloat({ min: 0 }),
  body('lineItems.*.unitPrice').isFloat({ min: 0 }),
];

const updateInvoiceValidation = [
  param('id').isUUID(),
  body('invoiceNumber').optional().notEmpty().trim(),
  body('invoiceDate').optional().isISO8601().toDate(),
  body('dueDate').optional().isISO8601().toDate(),
  body('status').optional().isIn(['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled']),
];

const listInvoicesValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('customerId').optional().trim(),
  query('vendorId').optional().trim(),
  query('sortBy').optional().isIn(['invoiceDate', 'dueDate', 'totalAmount', 'createdAt']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

const searchInvoicesValidation = [
  query('q').notEmpty().trim().isLength({ min: 2 }),
];

const addPaymentValidation = [
  param('id').isUUID(),
  body('amount').isFloat({ min: 0.01 }),
  body('paymentDate').isISO8601().toDate(),
  body('paymentMethod').isIn(['cash', 'check', 'credit_card', 'debit_card', 'bank_transfer', 'paypal', 'stripe', 'other']),
  body('referenceNumber').optional().trim(),
  body('notes').optional().trim(),
];

// Routes

// List invoices with pagination and filters
router.get(
  '/',
  listInvoicesValidation,
  validate,
  invoiceController.listInvoices
);

// Search invoices
router.get(
  '/search',
  searchInvoicesValidation,
  validate,
  invoiceController.searchInvoices
);

// Get invoice statistics
router.get(
  '/stats',
  invoiceController.getInvoiceStats
);

// Get overdue invoices
router.get(
  '/overdue',
  invoiceController.getOverdueInvoices
);

// Get invoice by ID
router.get(
  '/:id',
  param('id').isUUID(),
  validate,
  invoiceController.getInvoiceById
);

// Create new invoice
router.post(
  '/',
  createInvoiceValidation,
  validate,
  invoiceController.createInvoice
);

// Upload and process invoice
router.post(
  '/upload',
  uploadRateLimiter,
  upload.single('invoice'),
  invoiceController.uploadInvoice
);

// Update invoice
router.put(
  '/:id',
  updateInvoiceValidation,
  validate,
  invoiceController.updateInvoice
);

// Delete invoice
router.delete(
  '/:id',
  param('id').isUUID(),
  validate,
  invoiceController.deleteInvoice
);

// Add line items to invoice
router.post(
  '/:id/line-items',
  param('id').isUUID(),
  body('lineItems').isArray({ min: 1 }),
  body('lineItems.*.description').notEmpty().trim(),
  body('lineItems.*.quantity').isFloat({ min: 0 }),
  body('lineItems.*.unitPrice').isFloat({ min: 0 }),
  validate,
  invoiceController.addLineItems
);

// Update line item
router.put(
  '/:invoiceId/line-items/:lineItemId',
  param('invoiceId').isUUID(),
  param('lineItemId').isUUID(),
  body('description').optional().notEmpty().trim(),
  body('quantity').optional().isFloat({ min: 0 }),
  body('unitPrice').optional().isFloat({ min: 0 }),
  validate,
  invoiceController.updateLineItem
);

// Delete line item
router.delete(
  '/:invoiceId/line-items/:lineItemId',
  param('invoiceId').isUUID(),
  param('lineItemId').isUUID(),
  validate,
  invoiceController.deleteLineItem
);

// Send invoice via email
router.post(
  '/:id/send',
  param('id').isUUID(),
  body('recipientEmail').isEmail(),
  body('message').optional().trim(),
  validate,
  invoiceController.sendInvoice
);

// Mark invoice as viewed
router.post(
  '/:id/viewed',
  param('id').isUUID(),
  validate,
  invoiceController.markAsViewed
);

// Record payment
router.post(
  '/:id/payment',
  addPaymentValidation,
  validate,
  invoiceController.recordPayment
);

// Export invoice as PDF
router.get(
  '/:id/export/pdf',
  param('id').isUUID(),
  validate,
  invoiceController.exportToPDF
);

// Export invoice as CSV
router.get(
  '/:id/export/csv',
  param('id').isUUID(),
  validate,
  invoiceController.exportToCSV
);

// Duplicate invoice
router.post(
  '/:id/duplicate',
  param('id').isUUID(),
  validate,
  invoiceController.duplicateInvoice
);

export default router;