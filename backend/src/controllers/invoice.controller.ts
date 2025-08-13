import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { getSupabaseServiceClient } from '../config/supabase';
import { logAudit } from '../utils/logger';

export const invoiceController = {
  // List invoices with pagination and filters
  listInvoices: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate,
      customerId,
      vendorId,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const supabase = getSupabaseServiceClient();
    
    // Build query
    let query = supabase
      .from('invoices')
      .select('*, line_items(count)')
      .eq('user_id', userId);

    // Apply filters
    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('invoice_date', startDate);
    if (endDate) query = query.lte('invoice_date', endDate);
    if (customerId) query = query.eq('customer_name', customerId);
    if (vendorId) query = query.eq('vendor_name', vendorId);

    // Apply sorting
    query = query.order(sortBy as string, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const offset = (Number(page) - 1) * Number(limit);
    query = query.range(offset, offset + Number(limit) - 1);

    const { data: invoices, error, count } = await query;

    if (error) throw error;

    res.json({
      invoices,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
    });
  }),

  // Get invoice by ID
  getInvoiceById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    const supabase = getSupabaseServiceClient();
    
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        line_items(*),
        payment_transactions(*)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoice);
  }),

  // Create new invoice
  createInvoice: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { lineItems, ...invoiceData } = req.body;

    const supabase = getSupabaseServiceClient();
    
    // Start transaction
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        ...invoiceData,
        user_id: userId,
        status: 'draft'
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Add line items
    if (lineItems && lineItems.length > 0) {
      const lineItemsData = lineItems.map((item: any, index: number) => ({
        ...item,
        invoice_id: invoice.id,
        item_order: index + 1
      }));

      const { error: lineItemsError } = await supabase
        .from('line_items')
        .insert(lineItemsData);

      if (lineItemsError) throw lineItemsError;
    }

    // Log audit
    logAudit('INVOICE_CREATED', userId, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number
    });

    res.status(201).json(invoice);
  }),

  // Update invoice
  updateInvoice: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;
    const updateData = req.body;

    const supabase = getSupabaseServiceClient();
    
    const { data: invoice, error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Log audit
    logAudit('INVOICE_UPDATED', userId, {
      invoiceId: invoice.id,
      changes: updateData
    });

    res.json(invoice);
  }),

  // Delete invoice
  deleteInvoice: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    const supabase = getSupabaseServiceClient();
    
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Log audit
    logAudit('INVOICE_DELETED', userId, { invoiceId: id });

    res.status(204).send();
  }),

  // Placeholder implementations for other methods
  searchInvoices: asyncHandler(async (req: Request, res: Response) => {
    res.json({ message: 'Search invoices endpoint - implementation pending' });
  }),

  getInvoiceStats: asyncHandler(async (req: Request, res: Response) => {
    res.json({ message: 'Invoice stats endpoint - implementation pending' });
  }),

  getOverdueInvoices: asyncHandler(async (req: Request, res: Response) => {
    res.json({ message: 'Overdue invoices endpoint - implementation pending' });
  }),

  uploadInvoice: asyncHandler(async (req: Request, res: Response) => {
    res.json({ message: 'Upload invoice endpoint - implementation pending' });
  }),

  addLineItems: asyncHandler(async (req: Request, res: Response) => {
    res.json({ message: 'Add line items endpoint - implementation pending' });
  }),

  updateLineItem: asyncHandler(async (req: Request, res: Response) => {
    res.json({ message: 'Update line item endpoint - implementation pending' });
  }),

  deleteLineItem: asyncHandler(async (req: Request, res: Response) => {
    res.json({ message: 'Delete line item endpoint - implementation pending' });
  }),

  sendInvoice: asyncHandler(async (req: Request, res: Response) => {
    res.json({ message: 'Send invoice endpoint - implementation pending' });
  }),

  markAsViewed: asyncHandler(async (req: Request, res: Response) => {
    res.json({ message: 'Mark as viewed endpoint - implementation pending' });
  }),

  recordPayment: asyncHandler(async (req: Request, res: Response) => {
    res.json({ message: 'Record payment endpoint - implementation pending' });
  }),

  exportToPDF: asyncHandler(async (req: Request, res: Response) => {
    res.json({ message: 'Export to PDF endpoint - implementation pending' });
  }),

  exportToCSV: asyncHandler(async (req: Request, res: Response) => {
    res.json({ message: 'Export to CSV endpoint - implementation pending' });
  }),

  duplicateInvoice: asyncHandler(async (req: Request, res: Response) => {
    res.json({ message: 'Duplicate invoice endpoint - implementation pending' });
  }),
};