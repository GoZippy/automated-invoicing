import { Request, Response } from 'express';
import { asyncHandler, BadRequest } from '../middleware/errorHandler';
import aiService from '../services/ai.service';
import ocrService from '../services/ocr.service';
import { getSupabaseServiceClient } from '../config/supabase';
import { logAudit } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export const aiController = {
  processInvoice: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      throw BadRequest('No file uploaded');
    }

    // Validate file
    const validation = ocrService.validateFile(file.buffer, file.mimetype);
    if (!validation.valid) {
      throw BadRequest(validation.error!);
    }

    // Process invoice
    const result = await aiService.processInvoiceFile(
      file.buffer,
      file.mimetype,
      userId
    );

    // Store in database
    const supabase = getSupabaseServiceClient();
    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        ...result.invoiceData,
        user_id: userId,
        ocr_confidence_score: result.ocrConfidence,
        ai_extracted_data: result.invoiceData,
        processing_status: 'completed',
      })
      .select()
      .single();

    if (error) throw error;

    // Log audit
    logAudit('AI_INVOICE_PROCESSED', userId, {
      invoiceId: invoice.id,
      confidence: result.confidence,
      processingTime: result.extractionTime,
    });

    res.json({
      success: true,
      invoice,
      confidence: result.confidence,
      processingTime: result.extractionTime,
      validationResults: result.validationResults,
    });
  }),

  chat: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { query, sessionId, context } = req.body;

    const response = await aiService.processQuery(
      query,
      userId,
      sessionId || uuidv4()
    );

    res.json({
      success: true,
      ...response,
    });
  }),

  validateInvoice: asyncHandler(async (req: Request, res: Response) => {
    const { invoiceData } = req.body;

    const { validateInvoiceData } = await import('../config/openai');
    const validationResults = await validateInvoiceData(invoiceData);

    res.json({
      success: true,
      validationResults,
    });
  }),

  getSuggestions: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { invoiceId, type } = req.query;

    let invoiceData = {};
    if (invoiceId) {
      const supabase = getSupabaseServiceClient();
      const { data } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId as string)
        .eq('user_id', userId)
        .single();
      
      invoiceData = data || {};
    }

    const suggestions = await aiService.getSuggestions(invoiceData, userId);

    res.json({
      success: true,
      suggestions,
    });
  }),

  analyzeTrends: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { period = 'month', metric = 'revenue' } = req.query;

    const analysis = await aiService.analyzeTrends(
      userId,
      period as any,
      metric as any
    );

    res.json({
      success: true,
      analysis,
    });
  }),

  extractFromText: asyncHandler(async (req: Request, res: Response) => {
    const { text, extractionType = 'invoice' } = req.body;

    const { extractInvoiceData } = await import('../config/openai');
    const extractedData = await extractInvoiceData(text);

    res.json({
      success: true,
      extractedData,
      extractionType,
    });
  }),

  summarizeInvoices: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { invoiceIds } = req.body;

    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      throw BadRequest('Invoice IDs array is required');
    }

    const summary = await aiService.summarizeInvoices(invoiceIds, userId);

    res.json({
      success: true,
      summary,
    });
  }),

  getChatHistory: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { sessionId, limit = 50, offset = 0 } = req.query;

    const supabase = getSupabaseServiceClient();
    let query = supabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data: messages, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      messages: messages?.reverse() || [],
      total: count || 0,
      limit: Number(limit),
      offset: Number(offset),
    });
  }),

  clearChatSession: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { sessionId } = req.params;

    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('user_id', userId)
      .eq('session_id', sessionId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Chat session cleared',
    });
  }),

  batchProcessInvoices: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw BadRequest('No files uploaded');
    }

    const results = await Promise.allSettled(
      files.map(async (file) => {
        try {
          const result = await aiService.processInvoiceFile(
            file.buffer,
            file.mimetype,
            userId
          );
          
          return {
            filename: file.originalname,
            success: true,
            ...result,
          };
        } catch (error) {
          return {
            filename: file.originalname,
            success: false,
            error: error instanceof Error ? error.message : 'Processing failed',
          };
        }
      })
    );

    const processed = results.map(r => 
      r.status === 'fulfilled' ? r.value : { success: false, error: r.reason }
    );

    res.json({
      success: true,
      totalFiles: files.length,
      successful: processed.filter(r => r.success).length,
      failed: processed.filter(r => !r.success).length,
      results: processed,
    });
  }),
};