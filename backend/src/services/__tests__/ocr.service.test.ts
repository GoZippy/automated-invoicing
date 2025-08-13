import { ImageAnnotatorClient } from '@google-cloud/vision';
import pdf from 'pdf-parse';
import sharp from 'sharp';
import ocrService from '../ocr.service';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('@google-cloud/vision');
jest.mock('pdf-parse');
jest.mock('sharp');

describe('OCR Service', () => {
  let mockVisionClient: any;
  let mockSharp: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Vision client
    mockVisionClient = {
      textDetection: jest.fn(),
      documentTextDetection: jest.fn(),
    };
    (ImageAnnotatorClient as jest.Mock).mockImplementation(() => mockVisionClient);

    // Mock Sharp
    mockSharp = {
      grayscale: jest.fn().mockReturnThis(),
      normalize: jest.fn().mockReturnThis(),
      sharpen: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis(),
      toBuffer: jest.fn(),
      metadata: jest.fn(),
    };
    (sharp as unknown as jest.Mock).mockReturnValue(mockSharp);
  });

  describe('extractTextFromImage', () => {
    const mockImageBuffer = Buffer.from('fake-image-data');

    it('should extract text from image successfully', async () => {
      const mockOcrResponse = [
        {
          textAnnotations: [
            {
              description: 'INVOICE #123\nDate: 2024-01-15\nTotal: $1,000.00',
              boundingPoly: { vertices: [] },
            },
          ],
          fullTextAnnotation: {
            text: 'INVOICE #123\nDate: 2024-01-15\nTotal: $1,000.00',
          },
        },
      ];

      mockVisionClient.documentTextDetection.mockResolvedValue(mockOcrResponse);
      mockSharp.toBuffer.mockResolvedValue(mockImageBuffer);
      mockSharp.metadata.mockResolvedValue({ width: 1000, height: 1500 });

      const result = await ocrService.extractTextFromImage(mockImageBuffer);

      expect(result).toEqual({
        text: 'INVOICE #123\nDate: 2024-01-15\nTotal: $1,000.00',
        confidence: 0.95,
        metadata: {
          language: 'en',
          blocks: 1,
        },
      });

      expect(mockSharp.grayscale).toHaveBeenCalled();
      expect(mockSharp.normalize).toHaveBeenCalled();
      expect(mockSharp.sharpen).toHaveBeenCalled();
      expect(mockVisionClient.documentTextDetection).toHaveBeenCalledWith({
        image: { content: mockImageBuffer.toString('base64') },
      });
    });

    it('should handle OCR errors gracefully', async () => {
      const error = new Error('Vision API error');
      mockVisionClient.documentTextDetection.mockRejectedValue(error);
      mockSharp.toBuffer.mockResolvedValue(mockImageBuffer);

      await expect(ocrService.extractTextFromImage(mockImageBuffer))
        .rejects.toThrow('Vision API error');

      expect(logger.error).toHaveBeenCalledWith(
        'OCR extraction failed',
        expect.objectContaining({ error: error.message })
      );
    });

    it('should handle empty OCR results', async () => {
      mockVisionClient.documentTextDetection.mockResolvedValue([{}]);
      mockSharp.toBuffer.mockResolvedValue(mockImageBuffer);

      const result = await ocrService.extractTextFromImage(mockImageBuffer);

      expect(result).toEqual({
        text: '',
        confidence: 0,
        metadata: {
          language: 'unknown',
          blocks: 0,
        },
      });
    });

    it('should resize large images before OCR', async () => {
      mockSharp.metadata.mockResolvedValue({ width: 5000, height: 6000 });
      mockSharp.toBuffer.mockResolvedValue(mockImageBuffer);
      mockVisionClient.documentTextDetection.mockResolvedValue([
        { fullTextAnnotation: { text: 'Resized text' } },
      ]);

      await ocrService.extractTextFromImage(mockImageBuffer);

      expect(mockSharp.resize).toHaveBeenCalledWith(2000, null, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    });
  });

  describe('extractTextFromPDF', () => {
    const mockPdfBuffer = Buffer.from('fake-pdf-data');

    it('should extract text from PDF successfully', async () => {
      const mockPdfData = {
        text: 'Invoice Number: INV-001\nCustomer: ABC Corp\nAmount: $5,000',
        numpages: 3,
        info: {
          Title: 'Invoice Document',
          Author: 'InvoiceAI',
          CreationDate: new Date('2024-01-15'),
        },
      };

      (pdf as jest.Mock).mockResolvedValue(mockPdfData);

      const result = await ocrService.extractTextFromPDF(mockPdfBuffer);

      expect(result).toEqual({
        text: mockPdfData.text,
        confidence: 1.0,
        metadata: {
          pages: 3,
          title: 'Invoice Document',
          author: 'InvoiceAI',
          creationDate: expect.any(Date),
        },
      });

      expect(pdf).toHaveBeenCalledWith(mockPdfBuffer);
    });

    it('should handle PDF parsing errors', async () => {
      const error = new Error('Invalid PDF');
      (pdf as jest.Mock).mockRejectedValue(error);

      await expect(ocrService.extractTextFromPDF(mockPdfBuffer))
        .rejects.toThrow('Invalid PDF');

      expect(logger.error).toHaveBeenCalledWith(
        'PDF extraction failed',
        expect.objectContaining({ error: error.message })
      );
    });

    it('should handle PDFs with no text', async () => {
      (pdf as jest.Mock).mockResolvedValue({
        text: '',
        numpages: 1,
        info: {},
      });

      const result = await ocrService.extractTextFromPDF(mockPdfBuffer);

      expect(result).toEqual({
        text: '',
        confidence: 1.0,
        metadata: {
          pages: 1,
        },
      });
    });
  });

  describe('extractText', () => {
    it('should route image files to image extraction', async () => {
      const imageBuffer = Buffer.from('image-data');
      const extractImageSpy = jest.spyOn(ocrService, 'extractTextFromImage')
        .mockResolvedValue({
          text: 'Image text',
          confidence: 0.9,
          metadata: {},
        });

      await ocrService.extractText(imageBuffer, 'image/jpeg');

      expect(extractImageSpy).toHaveBeenCalledWith(imageBuffer);
    });

    it('should route PDF files to PDF extraction', async () => {
      const pdfBuffer = Buffer.from('pdf-data');
      const extractPdfSpy = jest.spyOn(ocrService, 'extractTextFromPDF')
        .mockResolvedValue({
          text: 'PDF text',
          confidence: 1.0,
          metadata: {},
        });

      await ocrService.extractText(pdfBuffer, 'application/pdf');

      expect(extractPdfSpy).toHaveBeenCalledWith(pdfBuffer);
    });

    it('should throw error for unsupported file types', async () => {
      const buffer = Buffer.from('data');

      await expect(ocrService.extractText(buffer, 'text/plain'))
        .rejects.toThrow('Unsupported file type: text/plain');
    });
  });

  describe('extractInvoiceFields', () => {
    it('should extract all invoice fields from text', () => {
      const text = `
        INVOICE
        Invoice Number: INV-2024-001
        Invoice Date: January 15, 2024
        Due Date: February 15, 2024
        
        Bill To:
        John Doe
        ABC Company
        123 Main St
        
        Total Amount: $1,234.56
        Tax: $123.46
        Subtotal: $1,111.10
      `;

      const result = ocrService.extractInvoiceFields(text);

      expect(result).toEqual({
        invoiceNumber: 'INV-2024-001',
        invoiceDate: 'January 15, 2024',
        dueDate: 'February 15, 2024',
        totalAmount: '$1,234.56',
        taxAmount: '$123.46',
        subtotal: '$1,111.10',
        vendorName: null,
        customerName: 'John Doe',
        items: [],
      });
    });

    it('should extract line items from invoice text', () => {
      const text = `
        INVOICE ITEMS:
        1. Product A - Quantity: 5 - Price: $10.00 - Total: $50.00
        2. Service B - Hours: 10 - Rate: $100.00 - Total: $1,000.00
        
        Description: Consulting Services
        Qty: 20 @ $50 each = $1,000
      `;

      const result = ocrService.extractInvoiceFields(text);

      expect(result.items).toHaveLength(3);
      expect(result.items[0]).toEqual({
        description: 'Product A',
        quantity: '5',
        price: '$10.00',
        total: '$50.00',
      });
    });

    it('should handle text with missing fields', () => {
      const text = 'Random text without invoice information';

      const result = ocrService.extractInvoiceFields(text);

      expect(result).toEqual({
        invoiceNumber: null,
        invoiceDate: null,
        dueDate: null,
        totalAmount: null,
        taxAmount: null,
        subtotal: null,
        vendorName: null,
        customerName: null,
        items: [],
      });
    });
  });

  describe('calculateConfidence', () => {
    it('should calculate high confidence for clear text', () => {
      const annotations = [
        {
          confidence: 0.95,
          boundingPoly: {
            vertices: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 50 },
              { x: 0, y: 50 },
            ],
          },
        },
        {
          confidence: 0.92,
          boundingPoly: {
            vertices: [
              { x: 0, y: 60 },
              { x: 100, y: 60 },
              { x: 100, y: 110 },
              { x: 0, y: 110 },
            ],
          },
        },
      ];

      const confidence = ocrService.calculateConfidence(annotations);

      expect(confidence).toBeCloseTo(0.935, 2);
    });

    it('should handle missing confidence scores', () => {
      const annotations = [
        { boundingPoly: { vertices: [] } },
        { confidence: 0.8, boundingPoly: { vertices: [] } },
      ];

      const confidence = ocrService.calculateConfidence(annotations);

      expect(confidence).toBeCloseTo(0.65, 2); // (0.5 + 0.8) / 2
    });

    it('should return 0 for empty annotations', () => {
      const confidence = ocrService.calculateConfidence([]);

      expect(confidence).toBe(0);
    });
  });

  describe('validateFile', () => {
    it('should validate supported image types', () => {
      const imageBuffer = Buffer.from('image');
      
      const jpegResult = ocrService.validateFile(imageBuffer, 'image/jpeg');
      expect(jpegResult).toEqual({ valid: true });

      const pngResult = ocrService.validateFile(imageBuffer, 'image/png');
      expect(pngResult).toEqual({ valid: true });

      const webpResult = ocrService.validateFile(imageBuffer, 'image/webp');
      expect(webpResult).toEqual({ valid: true });
    });

    it('should validate PDF files', () => {
      const pdfBuffer = Buffer.from('pdf');
      
      const result = ocrService.validateFile(pdfBuffer, 'application/pdf');
      expect(result).toEqual({ valid: true });
    });

    it('should reject unsupported file types', () => {
      const buffer = Buffer.from('data');
      
      const result = ocrService.validateFile(buffer, 'text/plain');
      expect(result).toEqual({
        valid: false,
        error: 'Unsupported file type. Supported types: JPEG, PNG, WebP, PDF',
      });
    });

    it('should reject files that are too large', () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      
      const result = ocrService.validateFile(largeBuffer, 'image/jpeg');
      expect(result).toEqual({
        valid: false,
        error: 'File size exceeds maximum allowed size of 10MB',
      });
    });

    it('should reject empty files', () => {
      const emptyBuffer = Buffer.alloc(0);
      
      const result = ocrService.validateFile(emptyBuffer, 'image/jpeg');
      expect(result).toEqual({
        valid: false,
        error: 'File is empty',
      });
    });
  });

  describe('preprocessImage', () => {
    it('should apply all preprocessing steps', async () => {
      const inputBuffer = Buffer.from('input-image');
      const outputBuffer = Buffer.from('processed-image');
      
      mockSharp.toBuffer.mockResolvedValue(outputBuffer);
      mockSharp.metadata.mockResolvedValue({ width: 800, height: 600 });

      const result = await ocrService.preprocessImage(inputBuffer);

      expect(result).toBe(outputBuffer);
      expect(mockSharp.grayscale).toHaveBeenCalled();
      expect(mockSharp.normalize).toHaveBeenCalled();
      expect(mockSharp.sharpen).toHaveBeenCalledWith({ sigma: 1.5 });
    });

    it('should handle preprocessing errors', async () => {
      const inputBuffer = Buffer.from('input-image');
      const error = new Error('Sharp processing failed');
      
      mockSharp.toBuffer.mockRejectedValue(error);

      await expect(ocrService.preprocessImage(inputBuffer))
        .rejects.toThrow('Sharp processing failed');
    });
  });
});