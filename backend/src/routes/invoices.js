const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const { dbUtils } = require('../database/connection');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'invoices');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `invoice-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ValidationError('Invalid file type', ['Only JPEG, PNG, GIF, and PDF files are allowed']), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  }
});

// @route   POST /api/invoices/upload
// @desc    Upload and process invoice
// @access  Private
router.post('/upload', upload.single('invoice'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
      message: 'Please upload an invoice file',
    });
  }

  const { vendor_name, vendor_email, invoice_date, due_date, total_amount, currency } = req.body;

  // Create invoice record
  const invoiceData = {
    user_id: req.user.id,
    vendor_name: vendor_name || null,
    vendor_email: vendor_email || null,
    invoice_date: invoice_date || null,
    due_date: due_date || null,
    total_amount: total_amount ? parseFloat(total_amount) : null,
    currency: currency || 'USD',
    status: 'pending',
    file_path: req.file.path,
    file_size: req.file.size,
    file_type: req.file.mimetype,
    processing_status: 'pending',
    confidence_score: 0.0,
  };

  const invoice = await dbUtils.insert('invoices', invoiceData);

  // Log invoice upload
  logger.info('Invoice uploaded', {
    userId: req.user.id,
    invoiceId: invoice.id,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    fileType: req.file.mimetype,
  });

  // TODO: Trigger AI processing workflow
  // await triggerInvoiceProcessing(invoice.id);

  res.status(201).json({
    success: true,
    message: 'Invoice uploaded successfully',
    data: {
      invoice: {
        id: invoice.id,
        vendor_name: invoice.vendor_name,
        invoice_date: invoice.invoice_date,
        total_amount: invoice.total_amount,
        currency: invoice.currency,
        status: invoice.status,
        processing_status: invoice.processing_status,
        created_at: invoice.created_at,
      },
    },
  });
}));

// @route   GET /api/invoices
// @desc    Get all invoices for user
// @access  Private
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    vendor_name,
    start_date,
    end_date,
    sort_by = 'created_at',
    sort_order = 'desc'
  } = req.query;

  const offset = (page - 1) * limit;
  
  // Build query conditions
  const conditions = { user_id: req.user.id };
  
  if (status) {
    conditions.status = status;
  }
  
  if (vendor_name) {
    conditions.vendor_name = { $ilike: `%${vendor_name}%` };
  }
  
  if (start_date || end_date) {
    conditions.invoice_date = {};
    if (start_date) conditions.invoice_date.$gte = start_date;
    if (end_date) conditions.invoice_date.$lte = end_date;
  }

  // Get invoices
  const invoices = await dbUtils.find('invoices', conditions, {
    orderBy: `${sort_by} ${sort_order.toUpperCase()}`,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  // Get total count
  const totalCount = await dbUtils.count('invoices', conditions);

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  res.json({
    success: true,
    data: {
      invoices,
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

// @route   GET /api/invoices/:id
// @desc    Get invoice by ID
// @access  Private
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const invoice = await dbUtils.findById('invoices', id);
  
  if (!invoice) {
    throw new NotFoundError('Invoice');
  }

  // Check if user owns this invoice or is admin
  if (invoice.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied',
      message: 'You do not have permission to access this invoice',
    });
  }

  // Get line items
  const lineItems = await dbUtils.find('line_items', { invoice_id: id });

  res.json({
    success: true,
    data: {
      invoice: {
        ...invoice,
        line_items: lineItems,
      },
    },
  });
}));

// @route   PUT /api/invoices/:id
// @desc    Update invoice
// @access  Private
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    vendor_name,
    vendor_email,
    vendor_address,
    vendor_phone,
    vendor_tax_id,
    invoice_date,
    due_date,
    total_amount,
    subtotal_amount,
    tax_amount,
    currency,
    status,
    payment_method,
    payment_date,
  } = req.body;

  // Get invoice
  const invoice = await dbUtils.findById('invoices', id);
  
  if (!invoice) {
    throw new NotFoundError('Invoice');
  }

  // Check if user owns this invoice or is admin
  if (invoice.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied',
      message: 'You do not have permission to update this invoice',
    });
  }

  // Build update data
  const updateData = {};
  
  if (vendor_name !== undefined) updateData.vendor_name = vendor_name;
  if (vendor_email !== undefined) updateData.vendor_email = vendor_email;
  if (vendor_address !== undefined) updateData.vendor_address = vendor_address;
  if (vendor_phone !== undefined) updateData.vendor_phone = vendor_phone;
  if (vendor_tax_id !== undefined) updateData.vendor_tax_id = vendor_tax_id;
  if (invoice_date !== undefined) updateData.invoice_date = invoice_date;
  if (due_date !== undefined) updateData.due_date = due_date;
  if (total_amount !== undefined) updateData.total_amount = parseFloat(total_amount);
  if (subtotal_amount !== undefined) updateData.subtotal_amount = parseFloat(subtotal_amount);
  if (tax_amount !== undefined) updateData.tax_amount = parseFloat(tax_amount);
  if (currency !== undefined) updateData.currency = currency;
  if (status !== undefined) updateData.status = status;
  if (payment_method !== undefined) updateData.payment_method = payment_method;
  if (payment_date !== undefined) updateData.payment_date = payment_date;

  // Update invoice
  const updatedInvoice = await dbUtils.update('invoices', id, {
    ...updateData,
    updated_at: new Date(),
  });

  // Log invoice update
  logger.info('Invoice updated', {
    userId: req.user.id,
    invoiceId: id,
    updatedFields: Object.keys(updateData),
  });

  res.json({
    success: true,
    message: 'Invoice updated successfully',
    data: {
      invoice: updatedInvoice,
    },
  });
}));

// @route   DELETE /api/invoices/:id
// @desc    Delete invoice
// @access  Private
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get invoice
  const invoice = await dbUtils.findById('invoices', id);
  
  if (!invoice) {
    throw new NotFoundError('Invoice');
  }

  // Check if user owns this invoice or is admin
  if (invoice.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied',
      message: 'You do not have permission to delete this invoice',
    });
  }

  // Delete associated file if it exists
  if (invoice.file_path) {
    try {
      await fs.unlink(invoice.file_path);
    } catch (error) {
      logger.warn('Failed to delete invoice file', {
        invoiceId: id,
        filePath: invoice.file_path,
        error: error.message,
      });
    }
  }

  // Delete invoice (line items will be deleted via CASCADE)
  await dbUtils.delete('invoices', id);

  // Log invoice deletion
  logger.info('Invoice deleted', {
    userId: req.user.id,
    invoiceId: id,
  });

  res.json({
    success: true,
    message: 'Invoice deleted successfully',
  });
}));

// @route   POST /api/invoices/:id/line-items
// @desc    Add line item to invoice
// @access  Private
router.post('/:id/line-items', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    description,
    quantity,
    unit_price,
    total_price,
    tax_amount,
    tax_rate,
    unit,
    sku,
    category,
  } = req.body;

  // Get invoice
  const invoice = await dbUtils.findById('invoices', id);
  
  if (!invoice) {
    throw new NotFoundError('Invoice');
  }

  // Check if user owns this invoice or is admin
  if (invoice.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied',
      message: 'You do not have permission to add line items to this invoice',
    });
  }

  // Create line item
  const lineItemData = {
    invoice_id: id,
    description: description || null,
    quantity: quantity ? parseFloat(quantity) : null,
    unit_price: unit_price ? parseFloat(unit_price) : null,
    total_price: total_price ? parseFloat(total_price) : null,
    tax_amount: tax_amount ? parseFloat(tax_amount) : 0,
    tax_rate: tax_rate ? parseFloat(tax_rate) : 0,
    unit: unit || null,
    sku: sku || null,
    category: category || null,
  };

  const lineItem = await dbUtils.insert('line_items', lineItemData);

  res.status(201).json({
    success: true,
    message: 'Line item added successfully',
    data: {
      line_item: lineItem,
    },
  });
}));

// @route   PUT /api/invoices/:id/line-items/:lineItemId
// @desc    Update line item
// @access  Private
router.put('/:id/line-items/:lineItemId', asyncHandler(async (req, res) => {
  const { id, lineItemId } = req.params;
  const {
    description,
    quantity,
    unit_price,
    total_price,
    tax_amount,
    tax_rate,
    unit,
    sku,
    category,
  } = req.body;

  // Get invoice
  const invoice = await dbUtils.findById('invoices', id);
  
  if (!invoice) {
    throw new NotFoundError('Invoice');
  }

  // Check if user owns this invoice or is admin
  if (invoice.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied',
      message: 'You do not have permission to update line items in this invoice',
    });
  }

  // Get line item
  const lineItem = await dbUtils.findById('line_items', lineItemId);
  
  if (!lineItem || lineItem.invoice_id !== id) {
    throw new NotFoundError('Line item');
  }

  // Build update data
  const updateData = {};
  
  if (description !== undefined) updateData.description = description;
  if (quantity !== undefined) updateData.quantity = parseFloat(quantity);
  if (unit_price !== undefined) updateData.unit_price = parseFloat(unit_price);
  if (total_price !== undefined) updateData.total_price = parseFloat(total_price);
  if (tax_amount !== undefined) updateData.tax_amount = parseFloat(tax_amount);
  if (tax_rate !== undefined) updateData.tax_rate = parseFloat(tax_rate);
  if (unit !== undefined) updateData.unit = unit;
  if (sku !== undefined) updateData.sku = sku;
  if (category !== undefined) updateData.category = category;

  // Update line item
  const updatedLineItem = await dbUtils.update('line_items', lineItemId, updateData);

  res.json({
    success: true,
    message: 'Line item updated successfully',
    data: {
      line_item: updatedLineItem,
    },
  });
}));

// @route   DELETE /api/invoices/:id/line-items/:lineItemId
// @desc    Delete line item
// @access  Private
router.delete('/:id/line-items/:lineItemId', asyncHandler(async (req, res) => {
  const { id, lineItemId } = req.params;

  // Get invoice
  const invoice = await dbUtils.findById('invoices', id);
  
  if (!invoice) {
    throw new NotFoundError('Invoice');
  }

  // Check if user owns this invoice or is admin
  if (invoice.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied',
      message: 'You do not have permission to delete line items from this invoice',
    });
  }

  // Get line item
  const lineItem = await dbUtils.findById('line_items', lineItemId);
  
  if (!lineItem || lineItem.invoice_id !== id) {
    throw new NotFoundError('Line item');
  }

  // Delete line item
  await dbUtils.delete('line_items', lineItemId);

  res.json({
    success: true,
    message: 'Line item deleted successfully',
  });
}));

// @route   POST /api/invoices/:id/process
// @desc    Trigger invoice processing
// @access  Private
router.post('/:id/process', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get invoice
  const invoice = await dbUtils.findById('invoices', id);
  
  if (!invoice) {
    throw new NotFoundError('Invoice');
  }

  // Check if user owns this invoice or is admin
  if (invoice.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied',
      message: 'You do not have permission to process this invoice',
    });
  }

  // Update processing status
  await dbUtils.update('invoices', id, {
    processing_status: 'processing',
    updated_at: new Date(),
  });

  // TODO: Trigger AI processing workflow
  // await triggerInvoiceProcessing(id);

  // Log processing request
  logger.info('Invoice processing triggered', {
    userId: req.user.id,
    invoiceId: id,
  });

  res.json({
    success: true,
    message: 'Invoice processing started',
    data: {
      invoice_id: id,
      processing_status: 'processing',
    },
  });
}));

// @route   GET /api/invoices/stats/summary
// @desc    Get invoice statistics
// @access  Private
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;

  // Build date conditions
  const dateConditions = {};
  if (start_date || end_date) {
    dateConditions.invoice_date = {};
    if (start_date) dateConditions.invoice_date.$gte = start_date;
    if (end_date) dateConditions.invoice_date.$lte = end_date;
  }

  // Get invoice counts by status
  const statusCounts = await dbUtils.executeQuery(`
    SELECT status, COUNT(*) as count
    FROM invoices
    WHERE user_id = $1
    ${start_date ? 'AND invoice_date >= $2' : ''}
    ${end_date ? `AND invoice_date <= $${start_date ? '3' : '2'}` : ''}
    GROUP BY status
  `, [req.user.id, ...(start_date ? [start_date] : []), ...(end_date ? [end_date] : [])]);

  // Get total amounts by status
  const amountTotals = await dbUtils.executeQuery(`
    SELECT status, SUM(total_amount) as total
    FROM invoices
    WHERE user_id = $1 AND total_amount IS NOT NULL
    ${start_date ? 'AND invoice_date >= $2' : ''}
    ${end_date ? `AND invoice_date <= $${start_date ? '3' : '2'}` : ''}
    GROUP BY status
  `, [req.user.id, ...(start_date ? [start_date] : []), ...(end_date ? [end_date] : [])]);

  // Get processing status counts
  const processingCounts = await dbUtils.executeQuery(`
    SELECT processing_status, COUNT(*) as count
    FROM invoices
    WHERE user_id = $1
    ${start_date ? 'AND invoice_date >= $2' : ''}
    ${end_date ? `AND invoice_date <= $${start_date ? '3' : '2'}` : ''}
    GROUP BY processing_status
  `, [req.user.id, ...(start_date ? [start_date] : []), ...(end_date ? [end_date] : [])]);

  // Format response
  const stats = {
    status_counts: statusCounts.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {}),
    amount_totals: amountTotals.rows.reduce((acc, row) => {
      acc[row.status] = parseFloat(row.total || 0);
      return acc;
    }, {}),
    processing_counts: processingCounts.rows.reduce((acc, row) => {
      acc[row.processing_status] = parseInt(row.count);
      return acc;
    }, {}),
  };

  res.json({
    success: true,
    data: {
      stats,
      date_range: {
        start_date: start_date || null,
        end_date: end_date || null,
      },
    },
  });
}));

module.exports = router;