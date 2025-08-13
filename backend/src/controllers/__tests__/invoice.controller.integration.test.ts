import request from 'supertest';
import express from 'express';
import { invoiceController } from '../invoice.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { upload } from '../../middleware/upload';
import { body, query, param } from 'express-validator';
import { getSupabaseServiceClient } from '../../config/supabase';
import aiService from '../../services/ai.service';

// Create test app
const app = express();
app.use(express.json());

// Apply authentication to all routes
app.use(authenticate);

// Mount invoice routes for testing
app.get('/invoices', 
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  validate,
  invoiceController.list
);

app.get('/invoices/:id',
  param('id').isUUID(),
  validate,
  invoiceController.getById
);

app.post('/invoices',
  [
    body('invoiceNumber').notEmpty(),
    body('vendorName').notEmpty(),
    body('customerName').notEmpty(),
    body('totalAmount').isFloat({ min: 0 }),
    body('dueDate').isISO8601(),
  ],
  validate,
  invoiceController.create
);

app.put('/invoices/:id',
  [
    param('id').isUUID(),
    body('status').optional().isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  ],
  validate,
  invoiceController.update
);

app.delete('/invoices/:id',
  param('id').isUUID(),
  validate,
  invoiceController.delete
);

app.post('/invoices/upload',
  upload.single('invoice'),
  invoiceController.uploadInvoice
);

app.get('/invoices/search',
  query('q').notEmpty(),
  validate,
  invoiceController.search
);

// Mock dependencies
jest.mock('../../services/ai.service');

const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(),
      getPublicUrl: jest.fn(),
    })),
  },
};

jest.mock('../../config/supabase', () => ({
  getSupabaseServiceClient: jest.fn(() => mockSupabase),
}));

describe('Invoice Controller Integration Tests', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    jest.clearAllMocks();
    // Set up authenticated user
    app.use((req, res, next) => {
      req.user = mockUser;
      next();
    });
  });

  describe('GET /invoices', () => {
    it('should list invoices with pagination', async () => {
      const mockInvoices = [
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          vendor_name: 'ABC Corp',
          customer_name: 'XYZ Ltd',
          total_amount: 1000,
          status: 'paid',
          created_at: '2024-01-15',
        },
        {
          id: 'inv-2',
          invoice_number: 'INV-002',
          vendor_name: 'DEF Inc',
          customer_name: 'XYZ Ltd',
          total_amount: 2000,
          status: 'pending',
          created_at: '2024-01-16',
        },
      ];

      mockSupabase.from().range.mockResolvedValue({
        data: mockInvoices,
        error: null,
        count: 50,
      });

      const response = await request(app)
        .get('/invoices?page=1&limit=10')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockInvoices,
        pagination: {
          page: 1,
          limit: 10,
          total: 50,
          totalPages: 5,
        },
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('invoices');
      expect(mockSupabase.from().eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(mockSupabase.from().range).toHaveBeenCalledWith(0, 9);
    });

    it('should filter invoices by status', async () => {
      mockSupabase.from().range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      await request(app)
        .get('/invoices?status=overdue')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(mockSupabase.from().eq).toHaveBeenCalledWith('status', 'overdue');
    });

    it('should filter invoices by date range', async () => {
      mockSupabase.from().range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      await request(app)
        .get('/invoices?startDate=2024-01-01&endDate=2024-01-31')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(mockSupabase.from().gte).toHaveBeenCalledWith('created_at', '2024-01-01');
      expect(mockSupabase.from().lte).toHaveBeenCalledWith('created_at', '2024-01-31');
    });
  });

  describe('GET /invoices/:id', () => {
    it('should get invoice by ID', async () => {
      const mockInvoice = {
        id: 'inv-123',
        invoice_number: 'INV-001',
        vendor_name: 'ABC Corp',
        customer_name: 'XYZ Ltd',
        total_amount: 1000,
        status: 'paid',
        line_items: [
          {
            description: 'Product A',
            quantity: 10,
            unit_price: 100,
            total: 1000,
          },
        ],
      };

      mockSupabase.from().single.mockResolvedValue({
        data: mockInvoice,
        error: null,
      });

      const response = await request(app)
        .get('/invoices/inv-123')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockInvoice,
      });

      expect(mockSupabase.from().eq).toHaveBeenCalledWith('id', 'inv-123');
      expect(mockSupabase.from().eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });

    it('should return 404 for non-existent invoice', async () => {
      mockSupabase.from().single.mockResolvedValue({
        data: null,
        error: { message: 'Invoice not found' },
      });

      const response = await request(app)
        .get('/invoices/non-existent-id')
        .set('Authorization', 'Bearer test-token')
        .expect(404);

      expect(response.body.error.message).toBe('Invoice not found');
    });
  });

  describe('POST /invoices', () => {
    it('should create a new invoice', async () => {
      const newInvoice = {
        invoiceNumber: 'INV-003',
        vendorName: 'New Vendor',
        customerName: 'New Customer',
        totalAmount: 5000,
        dueDate: '2024-02-15',
        lineItems: [
          {
            description: 'Service A',
            quantity: 1,
            unitPrice: 5000,
            total: 5000,
          },
        ],
      };

      const createdInvoice = {
        id: 'inv-new',
        ...newInvoice,
        user_id: mockUser.id,
        status: 'draft',
        created_at: new Date().toISOString(),
      };

      mockSupabase.from().single.mockResolvedValue({
        data: createdInvoice,
        error: null,
      });

      const response = await request(app)
        .post('/invoices')
        .set('Authorization', 'Bearer test-token')
        .send(newInvoice)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: createdInvoice,
      });

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          invoice_number: newInvoice.invoiceNumber,
          vendor_name: newInvoice.vendorName,
          user_id: mockUser.id,
        })
      );
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/invoices')
        .set('Authorization', 'Bearer test-token')
        .send({
          // Missing required fields
          vendorName: 'Test Vendor',
        })
        .expect(400);

      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'invoiceNumber' }),
          expect.objectContaining({ field: 'customerName' }),
          expect.objectContaining({ field: 'totalAmount' }),
          expect.objectContaining({ field: 'dueDate' }),
        ])
      );
    });
  });

  describe('PUT /invoices/:id', () => {
    it('should update invoice', async () => {
      const updates = {
        status: 'paid',
        paidDate: '2024-01-20',
        notes: 'Payment received via bank transfer',
      };

      mockSupabase.from().single.mockResolvedValue({
        data: { id: 'inv-123', ...updates },
        error: null,
      });

      const response = await request(app)
        .put('/invoices/inv-123')
        .set('Authorization', 'Bearer test-token')
        .send(updates)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining(updates),
      });

      expect(mockSupabase.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'paid',
          paid_date: '2024-01-20',
        })
      );
    });

    it('should validate status values', async () => {
      const response = await request(app)
        .put('/invoices/inv-123')
        .set('Authorization', 'Bearer test-token')
        .send({ status: 'invalid-status' })
        .expect(400);

      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'status' }),
        ])
      );
    });
  });

  describe('DELETE /invoices/:id', () => {
    it('should delete invoice', async () => {
      mockSupabase.from().single.mockResolvedValue({
        data: { id: 'inv-123' },
        error: null,
      });

      const response = await request(app)
        .delete('/invoices/inv-123')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Invoice deleted successfully',
      });

      expect(mockSupabase.from().delete).toHaveBeenCalled();
      expect(mockSupabase.from().eq).toHaveBeenCalledWith('id', 'inv-123');
      expect(mockSupabase.from().eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });
  });

  describe('POST /invoices/upload', () => {
    it('should process uploaded invoice', async () => {
      const mockFile = {
        buffer: Buffer.from('fake-pdf-content'),
        mimetype: 'application/pdf',
        originalname: 'invoice.pdf',
        size: 1024,
      };

      const mockProcessedData = {
        success: true,
        invoiceData: {
          invoiceNumber: 'INV-UPLOAD-001',
          totalAmount: 1500,
          vendorName: 'Uploaded Vendor',
        },
        confidence: 0.92,
      };

      (aiService.processInvoiceFile as jest.Mock).mockResolvedValue(mockProcessedData);

      mockSupabase.storage.from().upload.mockResolvedValue({
        data: { path: 'invoices/invoice-123.pdf' },
        error: null,
      });

      mockSupabase.storage.from().getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.example.com/invoices/invoice-123.pdf' },
      });

      mockSupabase.from().single.mockResolvedValue({
        data: {
          id: 'inv-uploaded',
          ...mockProcessedData.invoiceData,
        },
        error: null,
      });

      // Note: Actual file upload testing requires more setup with multer
      // This is a simplified test focusing on the controller logic
      const response = await request(app)
        .post('/invoices/upload')
        .set('Authorization', 'Bearer test-token')
        .attach('invoice', Buffer.from('test'), 'invoice.pdf')
        .expect(201);

      expect(aiService.processInvoiceFile).toHaveBeenCalled();
    });
  });

  describe('GET /invoices/search', () => {
    it('should search invoices', async () => {
      const searchResults = [
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          vendor_name: 'ABC Corp',
          match_score: 0.9,
        },
      ];

      mockSupabase.from().select.mockResolvedValue({
        data: searchResults,
        error: null,
      });

      const response = await request(app)
        .get('/invoices/search?q=ABC')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: searchResults,
        query: 'ABC',
      });

      expect(mockSupabase.from().or).toHaveBeenCalledWith(
        expect.stringContaining('invoice_number.ilike.%ABC%')
      );
    });

    it('should require search query', async () => {
      const response = await request(app)
        .get('/invoices/search')
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'q' }),
        ])
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors', async () => {
      mockSupabase.from().select.mockReturnThis();
      mockSupabase.from().range.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/invoices')
        .set('Authorization', 'Bearer test-token')
        .expect(500);

      expect(response.body.error.message).toBe('Internal server error');
    });
  });

  describe('Authorization', () => {
    it('should only return invoices for authenticated user', async () => {
      mockSupabase.from().range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      await request(app)
        .get('/invoices')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      // Verify user_id filter was applied
      expect(mockSupabase.from().eq).toHaveBeenCalledWith('user_id', mockUser.id);
    });

    it('should require authentication', async () => {
      // Remove auth middleware for this test
      const unauthApp = express();
      unauthApp.use(express.json());
      unauthApp.get('/invoices', invoiceController.list);

      const response = await request(unauthApp)
        .get('/invoices')
        .expect(401);

      expect(response.body.error.message).toBe('No token provided');
    });
  });
});