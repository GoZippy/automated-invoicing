import aiService from '../ai.service';
import ocrService from '../ocr.service';
import { openai } from '../../config/openai';
import { getSupabaseServiceClient } from '../../config/supabase';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('../ocr.service');
jest.mock('../../config/openai');
jest.mock('../../config/supabase');

// Mock OpenAI responses
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
};

(openai as any) = mockOpenAI;

describe('AI Service', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      })),
      rpc: jest.fn(),
    };

    (getSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('processInvoiceFile', () => {
    const mockBuffer = Buffer.from('test-file');
    const mockUserId = 'user-123';

    it('should process invoice file successfully', async () => {
      // Mock OCR extraction
      (ocrService.extractText as jest.Mock).mockResolvedValue({
        text: 'Invoice #123\nTotal: $1,000.00',
        confidence: 0.95,
        metadata: { pages: 1 },
      });

      // Mock AI extraction
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              invoiceNumber: 'INV-123',
              totalAmount: 1000.00,
              currency: 'USD',
              invoiceDate: '2024-01-15',
              dueDate: '2024-02-15',
              vendorName: 'ABC Corp',
              customerName: 'XYZ Ltd',
              lineItems: [
                {
                  description: 'Product A',
                  quantity: 10,
                  unitPrice: 100,
                  total: 1000,
                },
              ],
            }),
          },
        }],
      });

      const result = await aiService.processInvoiceFile(
        mockBuffer,
        'application/pdf',
        mockUserId
      );

      expect(result).toEqual({
        success: true,
        invoiceData: expect.objectContaining({
          invoiceNumber: 'INV-123',
          totalAmount: 1000.00,
          currency: 'USD',
        }),
        confidence: 0.95,
        ocrText: 'Invoice #123\nTotal: $1,000.00',
        ocrConfidence: 0.95,
        validationResults: expect.objectContaining({
          isValid: true,
        }),
        extractionTime: expect.any(Number),
      });

      expect(ocrService.extractText).toHaveBeenCalledWith(mockBuffer, 'application/pdf');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    });

    it('should handle OCR extraction failure', async () => {
      (ocrService.extractText as jest.Mock).mockRejectedValue(
        new Error('OCR extraction failed')
      );

      await expect(
        aiService.processInvoiceFile(mockBuffer, 'image/jpeg', mockUserId)
      ).rejects.toThrow('Failed to process invoice file');

      expect(logger.error).toHaveBeenCalledWith(
        'Invoice processing failed',
        expect.objectContaining({
          error: 'OCR extraction failed',
          userId: mockUserId,
        })
      );
    });

    it('should handle AI extraction failure', async () => {
      (ocrService.extractText as jest.Mock).mockResolvedValue({
        text: 'Invoice text',
        confidence: 0.9,
      });

      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('OpenAI API error')
      );

      await expect(
        aiService.processInvoiceFile(mockBuffer, 'application/pdf', mockUserId)
      ).rejects.toThrow('Failed to process invoice file');
    });

    it('should validate extracted invoice data', async () => {
      (ocrService.extractText as jest.Mock).mockResolvedValue({
        text: 'Invoice text',
        confidence: 0.9,
      });

      // Mock AI extraction with invalid data
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              invoiceNumber: '',
              totalAmount: -100,
              invoiceDate: 'invalid-date',
            }),
          },
        }],
      });

      const result = await aiService.processInvoiceFile(
        mockBuffer,
        'application/pdf',
        mockUserId
      );

      expect(result.validationResults).toEqual({
        isValid: false,
        errors: expect.arrayContaining([
          expect.stringContaining('Invoice number is required'),
          expect.stringContaining('Total amount must be positive'),
          expect.stringContaining('Invalid invoice date'),
        ]),
        warnings: expect.any(Array),
      });
    });
  });

  describe('processQuery', () => {
    const mockQuery = 'Show me all invoices from last month';
    const mockUserId = 'user-123';
    const mockSessionId = 'session-456';

    it('should process natural language query successfully', async () => {
      // Mock user context retrieval
      mockSupabase.from().select().eq().limit().mockResolvedValue({
        data: [
          { invoice_count: 50, total_revenue: 50000 },
        ],
        error: null,
      });

      // Mock AI query processing
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'list_invoices',
                parameters: {
                  dateRange: 'last_month',
                  status: 'all',
                },
                suggestedQuery: {
                  table: 'invoices',
                  filters: {
                    created_at: { gte: '2024-01-01', lt: '2024-02-01' },
                  },
                  orderBy: 'created_at',
                  orderDirection: 'desc',
                },
              }),
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'Here are your invoices from last month. You had 15 invoices totaling $25,000.',
            },
          }],
        });

      // Mock invoice query
      mockSupabase.from().select().eq().order().mockResolvedValue({
        data: Array(15).fill({
          id: 'inv-123',
          invoice_number: 'INV-001',
          total_amount: 1666.67,
          created_at: '2024-01-15',
        }),
        error: null,
      });

      const result = await aiService.processQuery(mockQuery, mockUserId, mockSessionId);

      expect(result).toEqual({
        success: true,
        response: 'Here are your invoices from last month. You had 15 invoices totaling $25,000.',
        data: expect.any(Array),
        intent: 'list_invoices',
        sessionId: mockSessionId,
      });

      // Verify message storage
      expect(mockSupabase.from).toHaveBeenCalledWith('messages');
      expect(mockSupabase.from().insert).toHaveBeenCalledTimes(2); // User message + AI response
    });

    it('should handle query processing errors', async () => {
      mockSupabase.from().select().eq().limit().mockResolvedValue({
        data: [],
        error: null,
      });

      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('OpenAI API error')
      );

      await expect(
        aiService.processQuery(mockQuery, mockUserId, mockSessionId)
      ).rejects.toThrow('Failed to process query');

      expect(logger.error).toHaveBeenCalledWith(
        'Query processing failed',
        expect.objectContaining({
          error: 'OpenAI API error',
          userId: mockUserId,
          sessionId: mockSessionId,
        })
      );
    });

    it('should use existing session or create new one', async () => {
      // Test with existing session
      await aiService.processQuery(mockQuery, mockUserId, mockSessionId);
      expect(mockSupabase.from).toHaveBeenCalledWith('messages');

      // Test without session (should create new one)
      await aiService.processQuery(mockQuery, mockUserId);
      const calls = mockSupabase.from.mock.calls;
      const messageInsertCall = calls.find(call => call[0] === 'messages');
      expect(messageInsertCall).toBeDefined();
    });
  });

  describe('getSuggestions', () => {
    it('should generate AI suggestions for invoice data', async () => {
      const invoiceData = {
        totalAmount: 1000,
        vendorName: 'ABC Corp',
        dueDate: '2024-02-15',
      };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              suggestions: [
                {
                  field: 'paymentTerms',
                  suggestion: 'Consider offering 2/10 net 30 terms for early payment discount',
                  confidence: 0.85,
                },
                {
                  field: 'category',
                  suggestion: 'Based on vendor, this appears to be a Technology/Software expense',
                  confidence: 0.9,
                },
              ],
              insights: {
                vendorAnalysis: 'ABC Corp is a frequent vendor with good payment history',
                amountAnalysis: 'Amount is within typical range for this vendor',
              },
            }),
          },
        }],
      });

      const result = await aiService.getSuggestions(invoiceData, 'user-123');

      expect(result).toEqual({
        suggestions: expect.arrayContaining([
          expect.objectContaining({
            field: 'paymentTerms',
            confidence: 0.85,
          }),
        ]),
        insights: expect.objectContaining({
          vendorAnalysis: expect.any(String),
        }),
      });
    });
  });

  describe('analyzeTrends', () => {
    it('should analyze invoice trends successfully', async () => {
      const mockInvoices = Array(30).fill(null).map((_, i) => ({
        id: `inv-${i}`,
        total_amount: 1000 + (i * 100),
        created_at: new Date(2024, 0, i + 1).toISOString(),
        vendor_name: i % 3 === 0 ? 'ABC Corp' : 'XYZ Ltd',
      }));

      mockSupabase.from().select().eq().gte().lte().order().mockResolvedValue({
        data: mockInvoices,
        error: null,
      });

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              trends: {
                revenue: {
                  trend: 'increasing',
                  changePercent: 15.5,
                  forecast: 'Continued growth expected',
                },
                volume: {
                  trend: 'stable',
                  averagePerMonth: 30,
                },
                vendors: {
                  topVendors: ['ABC Corp', 'XYZ Ltd'],
                  concentration: 0.67,
                },
              },
              insights: [
                'Revenue showing consistent 15.5% growth',
                'Vendor concentration risk with 67% from top 2 vendors',
              ],
              recommendations: [
                'Consider diversifying vendor base',
                'Lock in favorable terms with top vendors',
              ],
            }),
          },
        }],
      });

      const result = await aiService.analyzeTrends(
        'user-123',
        '2024-01-01',
        '2024-01-31'
      );

      expect(result).toEqual({
        trends: expect.objectContaining({
          revenue: expect.objectContaining({
            trend: 'increasing',
            changePercent: 15.5,
          }),
        }),
        insights: expect.arrayContaining([
          expect.stringContaining('Revenue showing consistent'),
        ]),
        recommendations: expect.any(Array),
      });
    });
  });

  describe('extractFromText', () => {
    it('should extract invoice data from plain text', async () => {
      const plainText = `
        Invoice Number: INV-2024-001
        Date: January 15, 2024
        
        Bill To: John Doe
        Amount: $1,500.00
        
        Items:
        - Product A: $500
        - Product B: $1000
      `;

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              invoiceNumber: 'INV-2024-001',
              invoiceDate: '2024-01-15',
              customerName: 'John Doe',
              totalAmount: 1500,
              lineItems: [
                { description: 'Product A', total: 500 },
                { description: 'Product B', total: 1000 },
              ],
            }),
          },
        }],
      });

      const result = await aiService.extractFromText(plainText, 'user-123');

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          invoiceNumber: 'INV-2024-001',
          totalAmount: 1500,
        }),
        confidence: expect.any(Number),
      });
    });
  });

  describe('summarizeInvoices', () => {
    it('should generate invoice summary', async () => {
      const invoiceIds = ['inv-1', 'inv-2', 'inv-3'];

      mockSupabase.from().select().in().mockResolvedValue({
        data: [
          {
            id: 'inv-1',
            invoice_number: 'INV-001',
            total_amount: 1000,
            vendor_name: 'ABC Corp',
            status: 'paid',
          },
          {
            id: 'inv-2',
            invoice_number: 'INV-002',
            total_amount: 2000,
            vendor_name: 'XYZ Ltd',
            status: 'pending',
          },
          {
            id: 'inv-3',
            invoice_number: 'INV-003',
            total_amount: 1500,
            vendor_name: 'ABC Corp',
            status: 'overdue',
          },
        ],
        error: null,
      });

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              summary: {
                totalAmount: 4500,
                averageAmount: 1500,
                statusBreakdown: {
                  paid: 1,
                  pending: 1,
                  overdue: 1,
                },
                vendorBreakdown: {
                  'ABC Corp': { count: 2, total: 2500 },
                  'XYZ Ltd': { count: 1, total: 2000 },
                },
              },
              narrative: 'You have 3 invoices totaling $4,500. One invoice is overdue and requires immediate attention.',
              actionItems: [
                'Follow up on overdue invoice INV-003 from ABC Corp',
                'Process pending payment for INV-002',
              ],
            }),
          },
        }],
      });

      const result = await aiService.summarizeInvoices(invoiceIds, 'user-123');

      expect(result).toEqual({
        summary: expect.objectContaining({
          totalAmount: 4500,
          statusBreakdown: expect.any(Object),
        }),
        narrative: expect.stringContaining('3 invoices totaling $4,500'),
        actionItems: expect.arrayContaining([
          expect.stringContaining('overdue invoice'),
        ]),
      });
    });
  });

  describe('correctInvoiceData', () => {
    it('should apply AI corrections to invoice data', async () => {
      const invoiceData = {
        invoiceNumber: 'INV001',
        invoiceDate: '01/15/24',
        totalAmount: '1,000.00',
        vendorName: 'abc corp',
      };

      const expectedCorrections = {
        invoiceNumber: 'INV-001',
        invoiceDate: '2024-01-15',
        totalAmount: 1000.00,
        vendorName: 'ABC Corp',
      };

      // Mock the correction process
      const result = await aiService.correctInvoiceData(invoiceData);

      expect(result).toEqual(expect.objectContaining({
        invoiceNumber: expect.stringContaining('INV-001'),
        invoiceDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        totalAmount: expect.any(Number),
        vendorName: expect.stringContaining('ABC Corp'),
      }));
    });
  });

  describe('enrichInvoiceData', () => {
    it('should enrich invoice data with additional information', async () => {
      const invoiceData = {
        vendorName: 'ABC Corp',
        totalAmount: 1000,
        invoiceDate: '2024-01-15',
      };

      mockSupabase.from().select().eq().mockResolvedValue({
        data: [
          {
            vendor_name: 'ABC Corp',
            total_invoices: 50,
            average_amount: 1200,
            payment_terms: 'Net 30',
          },
        ],
        error: null,
      });

      const result = await aiService.enrichInvoiceData(invoiceData, 'user-123');

      expect(result).toEqual(expect.objectContaining({
        vendorName: 'ABC Corp',
        totalAmount: 1000,
        invoiceDate: '2024-01-15',
        enrichment: expect.objectContaining({
          vendorHistory: expect.any(Object),
          paymentTerms: 'Net 30',
          category: expect.any(String),
        }),
      }));
    });
  });
});