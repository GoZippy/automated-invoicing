import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { Request } from 'express';
import { BadRequest } from './errorHandler';

// Configure storage
const storage = multer.memoryStorage(); // Store in memory for processing

// File filter
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequest(`File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`));
  }
};

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
    files: 1, // Single file upload
  },
});

// Multiple file upload (for future use)
export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
    files: 10, // Max 10 files
  },
});

// Helper to generate unique filename
export const generateUniqueFilename = (originalName: string): string => {
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext);
  const uniqueSuffix = crypto.randomBytes(6).toString('hex');
  const timestamp = Date.now();
  
  return `${name}-${timestamp}-${uniqueSuffix}${ext}`;
};

// Helper to validate image dimensions
export const validateImageDimensions = async (
  buffer: Buffer,
  maxWidth: number = 4000,
  maxHeight: number = 4000
): Promise<boolean> => {
  try {
    const sharp = require('sharp');
    const metadata = await sharp(buffer).metadata();
    
    if (!metadata.width || !metadata.height) {
      return false;
    }
    
    return metadata.width <= maxWidth && metadata.height <= maxHeight;
  } catch (error) {
    return false;
  }
};

// Helper to compress image if needed
export const compressImage = async (
  buffer: Buffer,
  maxSizeKB: number = 1024 // 1MB
): Promise<Buffer> => {
  try {
    const sharp = require('sharp');
    const sizeInKB = buffer.length / 1024;
    
    if (sizeInKB <= maxSizeKB) {
      return buffer;
    }
    
    // Calculate quality based on current size
    const quality = Math.floor((maxSizeKB / sizeInKB) * 100);
    
    return await sharp(buffer)
      .jpeg({ quality: Math.max(quality, 60) }) // Minimum 60% quality
      .toBuffer();
  } catch (error) {
    throw new Error('Failed to compress image');
  }
};

// Helper to extract text from PDF
export const extractTextFromPDF = async (buffer: Buffer): Promise<string> => {
  // This is a placeholder - in production, you'd use a library like pdf-parse
  // or integrate with Google Cloud Document AI
  return 'PDF text extraction not implemented';
};

// Middleware to handle file upload errors
export const handleUploadError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(BadRequest('File size too large'));
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return next(BadRequest('Too many files'));
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(BadRequest('Unexpected field name'));
    }
  }
  next(error);
};