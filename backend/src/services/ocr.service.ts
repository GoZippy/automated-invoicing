import { ImageAnnotatorClient } from '@google-cloud/vision';
import sharp from 'sharp';
import pdfParse from 'pdf-parse';
import { logger } from '../utils/logger';
import { BadRequest, InternalError } from '../middleware/errorHandler';

interface OCRResult {
  text: string;
  confidence: number;
  language?: string;
  pages?: number;
  metadata?: Record<string, any>;
}

interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
}

class OCRService {
  private visionClient: ImageAnnotatorClient | null = null;
  
  constructor() {
    this.initializeGoogleVision();
  }

  private initializeGoogleVision() {
    try {
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        this.visionClient = new ImageAnnotatorClient({
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        });
        logger.info('Google Vision API initialized');
      } else {
        logger.warn('Google Vision API credentials not configured');
      }
    } catch (error) {
      logger.error('Failed to initialize Google Vision API:', error);
    }
  }

  /**
   * Extract text from an image using Google Vision API
   */
  async extractTextFromImage(imageBuffer: Buffer): Promise<OCRResult> {
    if (!this.visionClient) {
      // Fallback to basic OCR or throw error
      throw new InternalError('OCR service not available');
    }

    try {
      // Optimize image for OCR
      const optimizedBuffer = await this.preprocessImage(imageBuffer);
      
      // Perform text detection
      const [result] = await this.visionClient.documentTextDetection({
        image: { content: optimizedBuffer },
      });

      const fullText = result.fullTextAnnotation?.text || '';
      const confidence = this.calculateConfidence(result.fullTextAnnotation);
      const language = result.fullTextAnnotation?.pages?.[0]?.property?.detectedLanguages?.[0]?.languageCode;

      logger.info('OCR extraction completed', {
        textLength: fullText.length,
        confidence,
        language,
      });

      return {
        text: fullText,
        confidence,
        language,
        metadata: {
          pages: result.fullTextAnnotation?.pages?.length || 1,
          blocks: result.fullTextAnnotation?.pages?.[0]?.blocks?.length || 0,
        },
      };
    } catch (error) {
      logger.error('Google Vision API error:', error);
      throw new InternalError('Failed to extract text from image');
    }
  }

  /**
   * Extract text from a PDF document
   */
  async extractTextFromPDF(pdfBuffer: Buffer): Promise<OCRResult> {
    try {
      const data = await pdfParse(pdfBuffer);
      
      return {
        text: data.text,
        confidence: 1.0, // PDF text extraction is usually 100% accurate
        pages: data.numpages,
        metadata: {
          info: data.info,
          metadata: data.metadata,
        },
      };
    } catch (error) {
      logger.error('PDF parsing error:', error);
      throw new InternalError('Failed to extract text from PDF');
    }
  }

  /**
   * Extract text from any supported document type
   */
  async extractText(fileBuffer: Buffer, mimeType: string): Promise<OCRResult> {
    logger.info('Starting text extraction', { mimeType });

    if (mimeType === 'application/pdf') {
      return this.extractTextFromPDF(fileBuffer);
    } else if (mimeType.startsWith('image/')) {
      return this.extractTextFromImage(fileBuffer);
    } else {
      throw new BadRequest(`Unsupported file type: ${mimeType}`);
    }
  }

  /**
   * Preprocess image for better OCR results
   */
  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      
      // Apply preprocessing transformations
      let processedImage = image
        .grayscale() // Convert to grayscale
        .normalize() // Normalize contrast
        .sharpen(); // Enhance edges

      // Resize if image is too large
      if (metadata.width && metadata.width > 4000) {
        processedImage = processedImage.resize(4000, null, {
          withoutEnlargement: true,
          fit: 'inside',
        });
      }

      // Convert to JPEG for consistency
      return await processedImage
        .jpeg({ quality: 95 })
        .toBuffer();
    } catch (error) {
      logger.error('Image preprocessing error:', error);
      // Return original buffer if preprocessing fails
      return imageBuffer;
    }
  }

  /**
   * Calculate confidence score from Vision API response
   */
  private calculateConfidence(fullTextAnnotation: any): number {
    if (!fullTextAnnotation || !fullTextAnnotation.pages) {
      return 0;
    }

    const confidences: number[] = [];
    
    fullTextAnnotation.pages.forEach((page: any) => {
      page.blocks?.forEach((block: any) => {
        if (block.confidence) {
          confidences.push(block.confidence);
        }
      });
    });

    if (confidences.length === 0) {
      return 0.5; // Default confidence if not provided
    }

    // Calculate average confidence
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    return Math.round(avgConfidence * 100) / 100;
  }

  /**
   * Extract structured invoice data from text
   */
  extractInvoiceFields(text: string): Partial<any> {
    const invoice: any = {};
    
    // Extract invoice number
    const invoiceNumberMatch = text.match(/Invoice\s*#?\s*:?\s*([A-Z0-9-]+)/i);
    if (invoiceNumberMatch) {
      invoice.invoiceNumber = invoiceNumberMatch[1];
    }

    // Extract dates
    const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g;
    const dates = text.match(datePattern) || [];
    if (dates.length > 0) {
      invoice.invoiceDate = this.parseDate(dates[0]);
      if (dates.length > 1) {
        invoice.dueDate = this.parseDate(dates[1]);
      }
    }

    // Extract amounts
    const amountPattern = /\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
    const amounts = text.match(amountPattern) || [];
    if (amounts.length > 0) {
      // Assume the largest amount is the total
      const parsedAmounts = amounts.map(a => parseFloat(a.replace(/[$,]/g, '')));
      invoice.totalAmount = Math.max(...parsedAmounts);
    }

    // Extract email addresses
    const emailPattern = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g;
    const emails = text.match(emailPattern) || [];
    if (emails.length > 0) {
      invoice.vendorEmail = emails[0];
      if (emails.length > 1) {
        invoice.customerEmail = emails[1];
      }
    }

    return invoice;
  }

  /**
   * Parse date string to ISO format
   */
  private parseDate(dateStr: string): string | null {
    try {
      // Handle various date formats
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (error) {
      logger.debug('Date parsing failed:', dateStr);
    }
    return null;
  }

  /**
   * Batch process multiple images
   */
  async batchExtractText(files: Array<{ buffer: Buffer; mimeType: string }>): Promise<OCRResult[]> {
    const results = await Promise.all(
      files.map(file => this.extractText(file.buffer, file.mimeType))
    );
    
    return results;
  }

  /**
   * Get supported file types
   */
  getSupportedTypes(): string[] {
    return [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/tiff',
      'image/bmp',
      'application/pdf',
    ];
  }

  /**
   * Validate file for OCR processing
   */
  validateFile(buffer: Buffer, mimeType: string): { valid: boolean; error?: string } {
    // Check file size
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (buffer.length > maxSize) {
      return { valid: false, error: 'File size exceeds 10MB limit' };
    }

    // Check mime type
    if (!this.getSupportedTypes().includes(mimeType)) {
      return { valid: false, error: `Unsupported file type: ${mimeType}` };
    }

    return { valid: true };
  }
}

// Create singleton instance
const ocrService = new OCRService();

export default ocrService;
export { OCRResult, OCRService };