const express = require('express');
const OpenAI = require('openai');

const { dbUtils } = require('../database/connection');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// @route   POST /api/chat/query
// @desc    Process natural language query about invoices
// @access  Private
router.post('/query', asyncHandler(async (req, res) => {
  const { query, session_id } = req.body;

  if (!query || !query.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Query required',
      message: 'Please provide a query to process',
    });
  }

  const startTime = Date.now();

  try {
    // Get user's invoices for context
    const invoices = await dbUtils.find('invoices', { user_id: req.user.id });
    
    // Get recent chat history for context
    const recentMessages = await dbUtils.find('messages', 
      { user_id: req.user.id, session_id: session_id || 'default' },
      { orderBy: 'created_at DESC', limit: 10 }
    );

    // Build context from invoices
    const invoiceContext = invoices.map(invoice => ({
      id: invoice.id,
      vendor_name: invoice.vendor_name,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      total_amount: invoice.total_amount,
      currency: invoice.currency,
      status: invoice.status,
      processing_status: invoice.processing_status,
    }));

    // Build conversation history
    const conversationHistory = recentMessages.reverse().map(msg => ({
      role: msg.message_type === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // Create system prompt
    const systemPrompt = `You are an intelligent invoice assistant. You help users understand and manage their invoices through natural language queries.

Available invoice data:
${JSON.stringify(invoiceContext, null, 2)}

Your capabilities:
- Answer questions about invoice status, amounts, vendors, and due dates
- Provide summaries and statistics
- Help identify overdue invoices
- Suggest actions for invoice management
- Calculate totals and trends

Always respond in a helpful, conversational tone. If you need to perform calculations, show your work. If you don't have enough information, ask for clarification.`;

    // Prepare messages for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: query }
    ];

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages,
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content;
    const tokensUsed = completion.usage.total_tokens;
    const processingTime = Date.now() - startTime;

    // Save user message
    const userMessage = await dbUtils.insert('messages', {
      session_id: session_id || 'default',
      user_id: req.user.id,
      message_type: 'user',
      content: query,
      metadata: { tokens_used: 0, processing_time_ms: 0 },
    });

    // Save assistant response
    const assistantMessage = await dbUtils.insert('messages', {
      session_id: session_id || 'default',
      user_id: req.user.id,
      message_type: 'assistant',
      content: response,
      metadata: { tokens_used: tokensUsed, processing_time_ms: processingTime },
      tokens_used: tokensUsed,
      processing_time_ms: processingTime,
    });

    // Log chat interaction
    logger.info('Chat query processed', {
      userId: req.user.id,
      sessionId: session_id || 'default',
      query: query.substring(0, 100),
      responseLength: response.length,
      tokensUsed,
      processingTime,
    });

    res.json({
      success: true,
      data: {
        response,
        session_id: session_id || 'default',
        message_id: assistantMessage.id,
        metadata: {
          tokens_used: tokensUsed,
          processing_time_ms: processingTime,
          model: process.env.OPENAI_MODEL || 'gpt-4',
        },
      },
    });

  } catch (error) {
    logger.error('Chat query failed', {
      userId: req.user.id,
      query: query.substring(0, 100),
      error: error.message,
    });

    // Save error message
    await dbUtils.insert('messages', {
      session_id: session_id || 'default',
      user_id: req.user.id,
      message_type: 'assistant',
      content: 'I apologize, but I encountered an error processing your query. Please try again.',
      metadata: { error: error.message, tokens_used: 0, processing_time_ms: Date.now() - startTime },
    });

    res.status(500).json({
      success: false,
      error: 'Query processing failed',
      message: 'An error occurred while processing your query. Please try again.',
    });
  }
}));

// @route   GET /api/chat/history
// @desc    Get chat history for user
// @access  Private
router.get('/history', asyncHandler(async (req, res) => {
  const { session_id, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  // Build query conditions
  const conditions = { user_id: req.user.id };
  if (session_id) {
    conditions.session_id = session_id;
  }

  // Get messages
  const messages = await dbUtils.find('messages', conditions, {
    orderBy: 'created_at DESC',
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  // Get total count
  const totalCount = await dbUtils.count('messages', conditions);

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  res.json({
    success: true,
    data: {
      messages: messages.reverse(), // Return in chronological order
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total_count: totalCount,
        total_pages: totalPages,
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage,
      },
    },
  });
}));

// @route   GET /api/chat/sessions
// @desc    Get chat sessions for user
// @access  Private
router.get('/sessions', asyncHandler(async (req, res) => {
  // Get unique sessions for user
  const sessions = await dbUtils.executeQuery(`
    SELECT 
      session_id,
      MAX(created_at) as last_message_at,
      COUNT(*) as message_count
    FROM messages 
    WHERE user_id = $1 
    GROUP BY session_id 
    ORDER BY last_message_at DESC
  `, [req.user.id]);

  res.json({
    success: true,
    data: {
      sessions: sessions.rows,
    },
  });
}));

// @route   DELETE /api/chat/history
// @desc    Clear chat history
// @access  Private
router.delete('/history', asyncHandler(async (req, res) => {
  const { session_id } = req.query;

  // Build delete conditions
  const conditions = { user_id: req.user.id };
  if (session_id) {
    conditions.session_id = session_id;
  }

  // Delete messages
  const result = await dbUtils.executeQuery(`
    DELETE FROM messages 
    WHERE user_id = $1 
    ${session_id ? 'AND session_id = $2' : ''}
  `, session_id ? [req.user.id, session_id] : [req.user.id]);

  // Log history deletion
  logger.info('Chat history cleared', {
    userId: req.user.id,
    sessionId: session_id || 'all',
    deletedCount: result.rowCount,
  });

  res.json({
    success: true,
    message: session_id ? 'Session history cleared' : 'All chat history cleared',
    data: {
      deleted_count: result.rowCount,
    },
  });
}));

// @route   POST /api/chat/analyze
// @desc    Analyze invoices with AI
// @access  Private
router.post('/analyze', asyncHandler(async (req, res) => {
  const { analysis_type, filters = {} } = req.body;

  if (!analysis_type) {
    return res.status(400).json({
      success: false,
      error: 'Analysis type required',
      message: 'Please specify the type of analysis to perform',
    });
  }

  const startTime = Date.now();

  try {
    // Get invoices based on filters
    const conditions = { user_id: req.user.id };
    
    if (filters.status) conditions.status = filters.status;
    if (filters.start_date) conditions.invoice_date = { $gte: filters.start_date };
    if (filters.end_date) {
      if (conditions.invoice_date) {
        conditions.invoice_date.$lte = filters.end_date;
      } else {
        conditions.invoice_date = { $lte: filters.end_date };
      }
    }

    const invoices = await dbUtils.find('invoices', conditions);

    if (invoices.length === 0) {
      return res.json({
        success: true,
        data: {
          analysis: 'No invoices found matching the specified criteria.',
          summary: {},
        },
      });
    }

    // Prepare data for analysis
    const invoiceData = invoices.map(invoice => ({
      id: invoice.id,
      vendor_name: invoice.vendor_name,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      total_amount: invoice.total_amount,
      currency: invoice.currency,
      status: invoice.status,
      processing_status: invoice.processing_status,
    }));

    // Create analysis prompt based on type
    let analysisPrompt = '';
    switch (analysis_type) {
      case 'overview':
        analysisPrompt = `Analyze the following invoice data and provide a comprehensive overview including:
- Total number of invoices
- Total value across all invoices
- Breakdown by status (pending, paid, overdue, etc.)
- Top vendors by invoice count and value
- Recent trends and patterns
- Any concerning issues or recommendations

Invoice data: ${JSON.stringify(invoiceData, null, 2)}`;
        break;
      
      case 'trends':
        analysisPrompt = `Analyze the following invoice data for trends and patterns:
- Monthly/quarterly spending trends
- Vendor spending patterns
- Payment timing analysis
- Seasonal variations
- Growth or decline patterns

Invoice data: ${JSON.stringify(invoiceData, null, 2)}`;
        break;
      
      case 'risks':
        analysisPrompt = `Analyze the following invoice data for potential risks and issues:
- Overdue invoices and aging analysis
- High-value pending invoices
- Vendor concentration risks
- Payment timing risks
- Data quality issues
- Recommendations for risk mitigation

Invoice data: ${JSON.stringify(invoiceData, null, 2)}`;
        break;
      
      default:
        analysisPrompt = `Provide a general analysis of the following invoice data: ${JSON.stringify(invoiceData, null, 2)}`;
    }

    // Call OpenAI for analysis
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        { role: 'system', content: 'You are an expert financial analyst specializing in invoice analysis. Provide clear, actionable insights.' },
        { role: 'user', content: analysisPrompt }
      ],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1500,
      temperature: 0.3,
    });

    const analysis = completion.choices[0].message.content;
    const tokensUsed = completion.usage.total_tokens;
    const processingTime = Date.now() - startTime;

    // Calculate summary statistics
    const summary = {
      total_invoices: invoices.length,
      total_value: invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0),
      by_status: invoices.reduce((acc, inv) => {
        acc[inv.status] = (acc[inv.status] || 0) + 1;
        return acc;
      }, {}),
      by_vendor: invoices.reduce((acc, inv) => {
        if (inv.vendor_name) {
          acc[inv.vendor_name] = (acc[inv.vendor_name] || 0) + 1;
        }
        return acc;
      }, {}),
    };

    // Log analysis
    logger.info('Invoice analysis completed', {
      userId: req.user.id,
      analysisType: analysis_type,
      invoiceCount: invoices.length,
      tokensUsed,
      processingTime,
    });

    res.json({
      success: true,
      data: {
        analysis,
        summary,
        metadata: {
          analysis_type,
          invoice_count: invoices.length,
          tokens_used: tokensUsed,
          processing_time_ms: processingTime,
          filters,
        },
      },
    });

  } catch (error) {
    logger.error('Invoice analysis failed', {
      userId: req.user.id,
      analysisType: analysis_type,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Analysis failed',
      message: 'An error occurred while performing the analysis. Please try again.',
    });
  }
}));

module.exports = router;