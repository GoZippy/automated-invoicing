import { Router } from 'express';
import { body, query } from 'express-validator';
import { aiController } from '../controllers/ai.controller';
import { validate } from '../middleware/validate';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { upload } from '../middleware/upload';

const router = Router();

// Process invoice with OCR and AI extraction
router.post(
  '/process-invoice',
  aiRateLimiter,
  upload.single('invoice'),
  aiController.processInvoice
);

// Natural language chat interface
router.post(
  '/chat',
  aiRateLimiter,
  body('query').notEmpty().trim().isLength({ max: 1000 }),
  body('sessionId').optional().isUUID(),
  body('context').optional().isObject(),
  validate,
  aiController.chat
);

// Validate invoice data
router.post(
  '/validate-invoice',
  aiRateLimiter,
  body('invoiceData').isObject(),
  validate,
  aiController.validateInvoice
);

// Get AI suggestions for invoice
router.get(
  '/suggestions',
  query('invoiceId').optional().isUUID(),
  query('type').optional().isIn(['payment_terms', 'due_date', 'line_items', 'categorization']),
  validate,
  aiController.getSuggestions
);

// Analyze invoice trends
router.get(
  '/analyze-trends',
  query('period').optional().isIn(['week', 'month', 'quarter', 'year']),
  query('metric').optional().isIn(['revenue', 'volume', 'customers', 'payment_time']),
  validate,
  aiController.analyzeTrends
);

// Extract data from text
router.post(
  '/extract-text',
  aiRateLimiter,
  body('text').notEmpty().isLength({ max: 10000 }),
  body('extractionType').optional().isIn(['invoice', 'receipt', 'purchase_order']),
  validate,
  aiController.extractFromText
);

// Generate invoice summary
router.post(
  '/summarize',
  aiRateLimiter,
  body('invoiceIds').isArray({ min: 1, max: 100 }),
  body('invoiceIds.*').isUUID(),
  validate,
  aiController.summarizeInvoices
);

// Get chat history
router.get(
  '/chat/history',
  query('sessionId').optional().isUUID(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
  validate,
  aiController.getChatHistory
);

// Clear chat session
router.delete(
  '/chat/session/:sessionId',
  aiController.clearChatSession
);

// Batch process multiple invoices
router.post(
  '/batch-process',
  aiRateLimiter,
  upload.array('invoices', 10),
  aiController.batchProcessInvoices
);

export default router;