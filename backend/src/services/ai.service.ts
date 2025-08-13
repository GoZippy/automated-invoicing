import { 
  extractInvoiceData, 
  processNaturalLanguageQuery, 
  validateInvoiceData,
  createChatCompletion 
} from '../config/openai';
import { getSupabaseServiceClient } from '../config/supabase';
import { logger, logPerformance } from '../utils/logger';
import { InternalError } from '../middleware/errorHandler';
import ocrService from './ocr.service';
import { v4 as uuidv4 } from 'uuid';

interface ProcessedInvoice {
  invoiceData: any;
  confidence: number;
  extractionTime: number;
  ocrConfidence?: number;
  validationResults?: any;
}

interface ChatResponse {
  response: string;
  data?: any;
  suggestions?: string[];
  relatedInvoices?: any[];
}

interface InvoiceSuggestions {
  paymentTerms?: string[];
  categories?: string[];
  dueDateSuggestion?: string;
  taxRateSuggestion?: number;
}

class AIService {
  /**
   * Process an uploaded invoice file
   */
  async processInvoiceFile(
    fileBuffer: Buffer, 
    mimeType: string, 
    userId: string
  ): Promise<ProcessedInvoice> {
    const startTime = Date.now();
    
    try {
      // Step 1: Extract text using OCR
      logger.info('Starting OCR extraction');
      const ocrResult = await ocrService.extractText(fileBuffer, mimeType);
      
      if (!ocrResult.text || ocrResult.text.trim().length === 0) {
        throw new InternalError('No text found in document');
      }

      // Step 2: Extract invoice data using AI
      logger.info('Starting AI extraction');
      const invoiceData = await extractInvoiceData(ocrResult.text);
      
      // Step 3: Validate extracted data
      logger.info('Validating extracted data');
      const validationResults = await validateInvoiceData(invoiceData);
      
      // Step 4: Apply corrections if needed
      const correctedData = await this.applySuggestions(invoiceData, validationResults);
      
      // Step 5: Enrich data with additional information
      const enrichedData = await this.enrichInvoiceData(correctedData, userId);
      
      const processingTime = Date.now() - startTime;
      logPerformance('invoice_processing', processingTime, {
        ocrConfidence: ocrResult.confidence,
        validationScore: validationResults.confidence_score,
      });

      return {
        invoiceData: enrichedData,
        confidence: validationResults.confidence_score,
        extractionTime: processingTime,
        ocrConfidence: ocrResult.confidence,
        validationResults,
      };
    } catch (error) {
      logger.error('Invoice processing failed:', error);
      throw new InternalError('Failed to process invoice');
    }
  }

  /**
   * Process natural language query about invoices
   */
  async processQuery(
    query: string, 
    userId: string, 
    sessionId?: string
  ): Promise<ChatResponse> {
    try {
      // Get user context
      const context = await this.getUserContext(userId, sessionId);
      
      // Process query with AI
      const aiResponse = await processNaturalLanguageQuery(query, context);
      
      // Execute database query based on AI response
      const queryResults = await this.executeQuery(aiResponse, userId);
      
      // Format response
      const formattedResponse = await this.formatResponse(aiResponse, queryResults);
      
      // Save to conversation history
      if (sessionId) {
        await this.saveConversation(userId, sessionId, query, formattedResponse);
      }

      return formattedResponse;
    } catch (error) {
      logger.error('Query processing failed:', error);
      throw new InternalError('Failed to process query');
    }
  }

  /**
   * Get AI suggestions for invoice fields
   */
  async getSuggestions(
    invoiceData: Partial<any>, 
    userId: string
  ): Promise<InvoiceSuggestions> {
    try {
      // Get historical data for context
      const historicalData = await this.getHistoricalInvoices(userId);
      
      const messages = [
        {
          role: 'system' as const,
          content: 'You are an AI assistant that provides intelligent suggestions for invoice fields based on historical data and best practices.',
        },
        {
          role: 'user' as const,
          content: `Based on this invoice data and historical patterns, suggest appropriate values:
          
          Current Invoice: ${JSON.stringify(invoiceData)}
          Historical Patterns: ${JSON.stringify(historicalData)}
          
          Provide suggestions for:
          1. Payment terms (if not set)
          2. Categories/tags
          3. Due date (based on typical terms)
          4. Tax rate (based on location/type)
          
          Return as JSON with arrays of suggestions where applicable.`,
        },
      ];

      const response = await createChatCompletion(messages, {
        response_format: { type: 'json_object' },
      });

      const suggestions = JSON.parse(response.choices[0].message.content || '{}');
      return suggestions;
    } catch (error) {
      logger.error('Failed to get suggestions:', error);
      return {};
    }
  }

  /**
   * Analyze invoice trends
   */
  async analyzeTrends(
    userId: string,
    period: 'week' | 'month' | 'quarter' | 'year',
    metric: 'revenue' | 'volume' | 'customers' | 'payment_time'
  ): Promise<any> {
    try {
      const supabase = getSupabaseServiceClient();
      
      // Get invoice data for the period
      const startDate = this.getStartDate(period);
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .gte('invoice_date', startDate.toISOString());

      if (error) throw error;

      // Analyze trends using AI
      const messages = [
        {
          role: 'system' as const,
          content: 'You are a financial analyst AI that identifies trends and patterns in invoice data.',
        },
        {
          role: 'user' as const,
          content: `Analyze these invoices for ${metric} trends over the ${period}:
          
          ${JSON.stringify(invoices)}
          
          Provide insights on:
          1. Overall trend (increasing/decreasing/stable)
          2. Notable patterns or anomalies
          3. Predictions for next period
          4. Actionable recommendations
          
          Return as structured JSON.`,
        },
      ];

      const response = await createChatCompletion(messages, {
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      logger.error('Trend analysis failed:', error);
      throw new InternalError('Failed to analyze trends');
    }
  }

  /**
   * Generate invoice summary
   */
  async summarizeInvoices(invoiceIds: string[], userId: string): Promise<string> {
    try {
      const supabase = getSupabaseServiceClient();
      
      // Fetch invoices
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*, line_items(*)')
        .in('id', invoiceIds)
        .eq('user_id', userId);

      if (error) throw error;

      const messages = [
        {
          role: 'system' as const,
          content: 'You are an AI assistant that creates concise, professional summaries of invoice data.',
        },
        {
          role: 'user' as const,
          content: `Create a professional summary of these invoices:
          
          ${JSON.stringify(invoices)}
          
          Include:
          - Total value and count
          - Key vendors and customers
          - Payment status overview
          - Notable items or patterns
          
          Keep it concise and business-friendly.`,
        },
      ];

      const response = await createChatCompletion(messages);
      return response.choices[0].message.content || 'Unable to generate summary';
    } catch (error) {
      logger.error('Summary generation failed:', error);
      throw new InternalError('Failed to generate summary');
    }
  }

  /**
   * Apply AI suggestions to correct invoice data
   */
  private async applySuggestions(invoiceData: any, validationResults: any): Promise<any> {
    const correctedData = { ...invoiceData };
    
    // Apply suggestions for errors
    if (validationResults.errors) {
      for (const error of validationResults.errors) {
        if (error.severity === 'error' && validationResults.suggestions) {
          const suggestion = validationResults.suggestions.find(
            (s: any) => s.field === error.field
          );
          if (suggestion) {
            // Apply suggestion based on field type
            correctedData[error.field] = suggestion.suggestion;
          }
        }
      }
    }

    return correctedData;
  }

  /**
   * Enrich invoice data with additional information
   */
  private async enrichInvoiceData(invoiceData: any, userId: string): Promise<any> {
    const enrichedData = { ...invoiceData };
    
    // Add calculated fields
    if (!enrichedData.balance_due && enrichedData.total_amount) {
      enrichedData.balance_due = enrichedData.total_amount - (enrichedData.paid_amount || 0);
    }

    // Add default status
    if (!enrichedData.status) {
      enrichedData.status = 'draft';
    }

    // Add processing metadata
    enrichedData.ai_processing_metadata = {
      processed_at: new Date().toISOString(),
      ai_model: process.env.OPENAI_MODEL || 'gpt-4',
      extraction_method: 'ocr_ai',
    };

    return enrichedData;
  }

  /**
   * Get user context for natural language processing
   */
  private async getUserContext(userId: string, sessionId?: string): Promise<any> {
    const supabase = getSupabaseServiceClient();
    const context: any = { userId };

    // Get recent messages if session exists
    if (sessionId) {
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(10);

      context.conversationHistory = messages;
    }

    // Get user preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', userId)
      .single();

    context.userPreferences = profile?.settings;

    return context;
  }

  /**
   * Execute database query based on AI interpretation
   */
  private async executeQuery(aiResponse: any, userId: string): Promise<any> {
    const supabase = getSupabaseServiceClient();
    
    switch (aiResponse.operation) {
      case 'search_invoices':
        return this.searchInvoices(aiResponse.parameters, aiResponse.filters, userId);
        
      case 'get_statistics':
        return this.getStatistics(aiResponse.parameters, userId);
        
      case 'find_overdue':
        return this.findOverdueInvoices(userId);
        
      case 'calculate_revenue':
        return this.calculateRevenue(aiResponse.parameters, userId);
        
      default:
        return null;
    }
  }

  /**
   * Format AI response for user
   */
  private async formatResponse(aiResponse: any, queryResults: any): Promise<ChatResponse> {
    const response: ChatResponse = {
      response: aiResponse.natural_response,
      data: queryResults,
    };

    // Add suggestions if applicable
    if (aiResponse.operation === 'search_invoices' && queryResults.length === 0) {
      response.suggestions = [
        'Try searching with different criteria',
        'Check if the date range is correct',
        'Use broader search terms',
      ];
    }

    return response;
  }

  /**
   * Save conversation to history
   */
  private async saveConversation(
    userId: string, 
    sessionId: string, 
    query: string, 
    response: ChatResponse
  ): Promise<void> {
    const supabase = getSupabaseServiceClient();
    
    await supabase.from('messages').insert([
      {
        user_id: userId,
        session_id: sessionId,
        message_type: 'user',
        content: query,
        role: 'user',
        created_at: new Date().toISOString(),
      },
      {
        user_id: userId,
        session_id: sessionId,
        message_type: 'assistant',
        content: response.response,
        role: 'assistant',
        metadata: { data: response.data },
        created_at: new Date().toISOString(),
      },
    ]);
  }

  /**
   * Helper method to search invoices
   */
  private async searchInvoices(parameters: any, filters: any, userId: string): Promise<any> {
    const supabase = getSupabaseServiceClient();
    
    let query = supabase
      .from('invoices')
      .select('*, line_items(count)')
      .eq('user_id', userId);

    // Apply filters
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.start_date) query = query.gte('invoice_date', filters.start_date);
    if (filters.end_date) query = query.lte('invoice_date', filters.end_date);
    if (filters.min_amount) query = query.gte('total_amount', filters.min_amount);
    if (filters.max_amount) query = query.lte('total_amount', filters.max_amount);
    
    const { data, error } = await query;
    if (error) throw error;
    
    return data;
  }

  /**
   * Get historical invoice patterns
   */
  private async getHistoricalInvoices(userId: string): Promise<any> {
    const supabase = getSupabaseServiceClient();
    
    const { data } = await supabase
      .from('invoices')
      .select('vendor_name, customer_name, payment_terms, tax_rate, currency')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Aggregate patterns
    const patterns = {
      commonVendors: this.getMostCommon(data?.map(i => i.vendor_name) || []),
      commonCustomers: this.getMostCommon(data?.map(i => i.customer_name) || []),
      commonPaymentTerms: this.getMostCommon(data?.map(i => i.payment_terms) || []),
      averageTaxRate: this.getAverage(data?.map(i => i.tax_rate) || []),
      currencies: this.getMostCommon(data?.map(i => i.currency) || []),
    };

    return patterns;
  }

  /**
   * Helper to get most common values
   */
  private getMostCommon(values: any[]): any[] {
    const counts = values.reduce((acc, val) => {
      if (val) acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([value]) => value);
  }

  /**
   * Helper to get average
   */
  private getAverage(values: number[]): number {
    const filtered = values.filter(v => v != null);
    if (filtered.length === 0) return 0;
    return filtered.reduce((a, b) => a + b, 0) / filtered.length;
  }

  /**
   * Get start date for period
   */
  private getStartDate(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'week':
        return new Date(now.setDate(now.getDate() - 7));
      case 'month':
        return new Date(now.setMonth(now.getMonth() - 1));
      case 'quarter':
        return new Date(now.setMonth(now.getMonth() - 3));
      case 'year':
        return new Date(now.setFullYear(now.getFullYear() - 1));
      default:
        return new Date(now.setMonth(now.getMonth() - 1));
    }
  }

  /**
   * Get invoice statistics
   */
  private async getStatistics(parameters: any, userId: string): Promise<any> {
    const supabase = getSupabaseServiceClient();
    
    const { data: stats } = await supabase.rpc('get_revenue_summary', {
      p_user_id: userId,
      p_start_date: parameters.start_date || this.getStartDate('month').toISOString(),
      p_end_date: parameters.end_date || new Date().toISOString(),
    });

    return stats;
  }

  /**
   * Find overdue invoices
   */
  private async findOverdueInvoices(userId: string): Promise<any> {
    const supabase = getSupabaseServiceClient();
    
    const { data } = await supabase
      .from('unpaid_invoices')
      .select('*')
      .eq('user_id', userId)
      .eq('is_overdue', true);

    return data;
  }

  /**
   * Calculate revenue
   */
  private async calculateRevenue(parameters: any, userId: string): Promise<any> {
    const supabase = getSupabaseServiceClient();
    
    const { data } = await supabase
      .from('invoices')
      .select('total_amount, paid_amount, status')
      .eq('user_id', userId)
      .gte('invoice_date', parameters.start_date || this.getStartDate('month').toISOString())
      .lte('invoice_date', parameters.end_date || new Date().toISOString());

    const revenue = {
      total: data?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0,
      paid: data?.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0) || 0,
      pending: 0,
    };
    
    revenue.pending = revenue.total - revenue.paid;
    
    return revenue;
  }
}

// Create singleton instance
const aiService = new AIService();

export default aiService;
export { AIService, ProcessedInvoice, ChatResponse, InvoiceSuggestions };