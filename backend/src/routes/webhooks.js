const express = require('express');
const crypto = require('crypto');
const { dbUtils } = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Verify webhook signature
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const payload = JSON.stringify(req.body);
  
  if (!signature || !timestamp) {
    return res.status(401).json({
      success: false,
      error: 'Missing signature',
      message: 'Webhook signature is required',
    });
  }

  // Check timestamp (prevent replay attacks)
  const now = Math.floor(Date.now() / 1000);
  const timestampInt = parseInt(timestamp);
  
  if (Math.abs(now - timestampInt) > 300) { // 5 minutes tolerance
    return res.status(401).json({
      success: false,
      error: 'Invalid timestamp',
      message: 'Webhook timestamp is too old',
    });
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  if (signature !== expectedSignature) {
    logger.logSecurity('WEBHOOK_SIGNATURE_FAILED', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      expectedSignature,
      receivedSignature: signature,
    });

    return res.status(401).json({
      success: false,
      error: 'Invalid signature',
      message: 'Webhook signature verification failed',
    });
  }

  next();
};

// @route   POST /api/webhooks/n8n
// @desc    Handle n8n webhook for invoice processing
// @access  Public (with signature verification)
router.post('/n8n', verifyWebhookSignature, asyncHandler(async (req, res) => {
  const { invoice_id, processing_result, extracted_data, confidence_score } = req.body;

  if (!invoice_id) {
    return res.status(400).json({
      success: false,
      error: 'Missing invoice ID',
      message: 'Invoice ID is required',
    });
  }

  try {
    // Get invoice
    const invoice = await dbUtils.findById('invoices', invoice_id);
    
    if (!invoice) {
      logger.warn('Webhook received for non-existent invoice', {
        invoiceId: invoice_id,
        ip: req.ip,
      });

      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
        message: 'Invoice with the specified ID was not found',
      });
    }

    // Update invoice with processing results
    const updateData = {
      processing_status: processing_result?.status || 'completed',
      confidence_score: confidence_score || 0.0,
      updated_at: new Date(),
    };

    if (extracted_data) {
      updateData.extracted_data = extracted_data;
      
      // Update invoice fields if extracted data is available
      if (extracted_data.vendor_name) updateData.vendor_name = extracted_data.vendor_name;
      if (extracted_data.vendor_email) updateData.vendor_email = extracted_data.vendor_email;
      if (extracted_data.invoice_date) updateData.invoice_date = extracted_data.invoice_date;
      if (extracted_data.due_date) updateData.due_date = extracted_data.due_date;
      if (extracted_data.total_amount) updateData.total_amount = parseFloat(extracted_data.total_amount);
      if (extracted_data.currency) updateData.currency = extracted_data.currency;
    }

    if (processing_result?.error) {
      updateData.error_message = processing_result.error;
      updateData.processing_status = 'failed';
    }

    // Update invoice
    await dbUtils.update('invoices', invoice_id, updateData);

    // Log webhook processing
    logger.info('Webhook processed successfully', {
      invoiceId: invoice_id,
      processingStatus: updateData.processing_status,
      confidenceScore: updateData.confidence_score,
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Webhook processed successfully',
      data: {
        invoice_id,
        processing_status: updateData.processing_status,
      },
    });

  } catch (error) {
    logger.error('Webhook processing failed', {
      invoiceId: invoice_id,
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json({
      success: false,
      error: 'Processing failed',
      message: 'An error occurred while processing the webhook',
    });
  }
}));

// @route   POST /api/webhooks/google-drive
// @desc    Handle Google Drive webhook for new files
// @access  Public (with signature verification)
router.post('/google-drive', verifyWebhookSignature, asyncHandler(async (req, res) => {
  const { file_id, file_name, file_url, user_id } = req.body;

  if (!file_id || !file_name || !user_id) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      message: 'File ID, file name, and user ID are required',
    });
  }

  try {
    // Check if file is an invoice (based on file name or type)
    const isInvoice = /invoice|bill|receipt/i.test(file_name) || 
                     /\.(pdf|jpg|jpeg|png|gif)$/i.test(file_name);

    if (!isInvoice) {
      logger.info('Non-invoice file ignored', {
        fileId: file_id,
        fileName: file_name,
        userId: user_id,
      });

      return res.json({
        success: true,
        message: 'File ignored (not an invoice)',
      });
    }

    // Create invoice record
    const invoiceData = {
      user_id,
      vendor_name: null, // Will be extracted during processing
      invoice_date: null,
      due_date: null,
      total_amount: null,
      currency: 'USD',
      status: 'pending',
      file_path: file_url,
      file_size: null,
      file_type: file_name.split('.').pop().toLowerCase(),
      processing_status: 'pending',
      confidence_score: 0.0,
      extracted_data: {
        source: 'google_drive',
        file_id,
        file_name,
      },
    };

    const invoice = await dbUtils.insert('invoices', invoiceData);

    // Log webhook processing
    logger.info('Google Drive webhook processed', {
      fileId: file_id,
      fileName: file_name,
      userId: user_id,
      invoiceId: invoice.id,
    });

    res.json({
      success: true,
      message: 'Invoice created from Google Drive file',
      data: {
        invoice_id: invoice.id,
        file_id,
        file_name,
      },
    });

  } catch (error) {
    logger.error('Google Drive webhook processing failed', {
      fileId: file_id,
      fileName: file_name,
      userId: user_id,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Processing failed',
      message: 'An error occurred while processing the Google Drive webhook',
    });
  }
}));

// @route   POST /api/webhooks/stripe
// @desc    Handle Stripe webhook for payment events
// @access  Public (with signature verification)
router.post('/stripe', verifyWebhookSignature, asyncHandler(async (req, res) => {
  const { event_type, data } = req.body;

  if (!event_type || !data) {
    return res.status(400).json({
      success: false,
      error: 'Missing event data',
      message: 'Event type and data are required',
    });
  }

  try {
    switch (event_type) {
      case 'payment_intent.succeeded':
        // Handle successful payment
        const { invoice_id, amount } = data.object.metadata;
        
        if (invoice_id) {
          await dbUtils.update('invoices', invoice_id, {
            status: 'paid',
            payment_date: new Date(),
            payment_method: 'stripe',
            updated_at: new Date(),
          });

          logger.info('Payment processed via Stripe', {
            invoiceId: invoice_id,
            amount,
            eventType: event_type,
          });
        }
        break;

      case 'payment_intent.payment_failed':
        // Handle failed payment
        const failedInvoiceId = data.object.metadata.invoice_id;
        
        if (failedInvoiceId) {
          await dbUtils.update('invoices', failedInvoiceId, {
            status: 'failed',
            error_message: 'Payment failed via Stripe',
            updated_at: new Date(),
          });

          logger.warn('Payment failed via Stripe', {
            invoiceId: failedInvoiceId,
            eventType: event_type,
          });
        }
        break;

      default:
        logger.info('Unhandled Stripe event', {
          eventType: event_type,
        });
    }

    res.json({
      success: true,
      message: 'Stripe webhook processed successfully',
    });

  } catch (error) {
    logger.error('Stripe webhook processing failed', {
      eventType: event_type,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Processing failed',
      message: 'An error occurred while processing the Stripe webhook',
    });
  }
}));

// @route   GET /api/webhooks/health
// @desc    Webhook health check
// @access  Public
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoint is healthy',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;