const express = require('express');
const { dbUtils } = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// @route   GET /api/analytics/dashboard
// @desc    Get dashboard analytics
// @access  Private
router.get('/dashboard', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;

  try {
    // Build date conditions
    const dateConditions = start_date || end_date ? 'WHERE user_id = $1' : 'WHERE user_id = $1';
    const params = [req.user.id];
    let paramIndex = 2;

    if (start_date) {
      dateConditions += ` AND invoice_date >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      dateConditions += ` AND invoice_date <= $${paramIndex++}`;
      params.push(end_date);
    }

    // Get total invoices and amounts
    const totalsQuery = `
      SELECT 
        COUNT(*) as total_invoices,
        SUM(CASE WHEN total_amount IS NOT NULL THEN total_amount ELSE 0 END) as total_amount,
        AVG(CASE WHEN total_amount IS NOT NULL THEN total_amount ELSE NULL END) as avg_amount
      FROM invoices 
      ${dateConditions}
    `;

    // Get invoices by status
    const statusQuery = `
      SELECT 
        status,
        COUNT(*) as count,
        SUM(CASE WHEN total_amount IS NOT NULL THEN total_amount ELSE 0 END) as total_amount
      FROM invoices 
      ${dateConditions}
      GROUP BY status
    `;

    // Get invoices by month
    const monthlyQuery = `
      SELECT 
        DATE_TRUNC('month', invoice_date) as month,
        COUNT(*) as count,
        SUM(CASE WHEN total_amount IS NOT NULL THEN total_amount ELSE 0 END) as total_amount
      FROM invoices 
      ${dateConditions}
      AND invoice_date IS NOT NULL
      GROUP BY DATE_TRUNC('month', invoice_date)
      ORDER BY month DESC
      LIMIT 12
    `;

    // Get top vendors
    const vendorsQuery = `
      SELECT 
        vendor_name,
        COUNT(*) as invoice_count,
        SUM(CASE WHEN total_amount IS NOT NULL THEN total_amount ELSE 0 END) as total_amount
      FROM invoices 
      ${dateConditions}
      AND vendor_name IS NOT NULL
      GROUP BY vendor_name
      ORDER BY total_amount DESC
      LIMIT 10
    `;

    // Get overdue invoices
    const overdueQuery = `
      SELECT 
        COUNT(*) as count,
        SUM(CASE WHEN total_amount IS NOT NULL THEN total_amount ELSE 0 END) as total_amount
      FROM invoices 
      ${dateConditions}
      AND due_date < CURRENT_DATE
      AND status = 'pending'
    `;

    // Execute queries
    const [totals, status, monthly, vendors, overdue] = await Promise.all([
      dbUtils.executeQuery(totalsQuery, params),
      dbUtils.executeQuery(statusQuery, params),
      dbUtils.executeQuery(monthlyQuery, params),
      dbUtils.executeQuery(vendorsQuery, params),
      dbUtils.executeQuery(overdueQuery, params),
    ]);

    // Format response
    const dashboard = {
      totals: {
        invoices: parseInt(totals.rows[0]?.total_invoices || 0),
        amount: parseFloat(totals.rows[0]?.total_amount || 0),
        avg_amount: parseFloat(totals.rows[0]?.avg_amount || 0),
      },
      by_status: status.rows.reduce((acc, row) => {
        acc[row.status] = {
          count: parseInt(row.count),
          amount: parseFloat(row.total_amount || 0),
        };
        return acc;
      }, {}),
      monthly: monthly.rows.map(row => ({
        month: row.month,
        count: parseInt(row.count),
        amount: parseFloat(row.total_amount || 0),
      })),
      top_vendors: vendors.rows.map(row => ({
        vendor_name: row.vendor_name,
        invoice_count: parseInt(row.invoice_count),
        total_amount: parseFloat(row.total_amount || 0),
      })),
      overdue: {
        count: parseInt(overdue.rows[0]?.count || 0),
        amount: parseFloat(overdue.rows[0]?.total_amount || 0),
      },
    };

    res.json({
      success: true,
      data: {
        dashboard,
        date_range: {
          start_date: start_date || null,
          end_date: end_date || null,
        },
      },
    });

  } catch (error) {
    logger.error('Dashboard analytics failed', {
      userId: req.user.id,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Analytics failed',
      message: 'An error occurred while generating dashboard analytics',
    });
  }
}));

// @route   GET /api/analytics/reports
// @desc    Get detailed reports
// @access  Private
router.get('/reports', asyncHandler(async (req, res) => {
  const { report_type, start_date, end_date, format = 'json' } = req.query;

  if (!report_type) {
    return res.status(400).json({
      success: false,
      error: 'Report type required',
      message: 'Please specify the type of report to generate',
    });
  }

  try {
    // Build date conditions
    const dateConditions = start_date || end_date ? 'WHERE user_id = $1' : 'WHERE user_id = $1';
    const params = [req.user.id];
    let paramIndex = 2;

    if (start_date) {
      dateConditions += ` AND invoice_date >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      dateConditions += ` AND invoice_date <= $${paramIndex++}`;
      params.push(end_date);
    }

    let reportData = {};

    switch (report_type) {
      case 'aging':
        // Invoice aging report
        const agingQuery = `
          SELECT 
            CASE 
              WHEN due_date < CURRENT_DATE - INTERVAL '90 days' THEN '90+ days'
              WHEN due_date < CURRENT_DATE - INTERVAL '60 days' THEN '60-90 days'
              WHEN due_date < CURRENT_DATE - INTERVAL '30 days' THEN '30-60 days'
              WHEN due_date < CURRENT_DATE THEN '1-30 days'
              WHEN due_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Current'
              ELSE 'Future'
            END as aging_bucket,
            COUNT(*) as invoice_count,
            SUM(CASE WHEN total_amount IS NOT NULL THEN total_amount ELSE 0 END) as total_amount
          FROM invoices 
          ${dateConditions}
          AND due_date IS NOT NULL
          GROUP BY aging_bucket
          ORDER BY 
            CASE aging_bucket
              WHEN '90+ days' THEN 1
              WHEN '60-90 days' THEN 2
              WHEN '30-60 days' THEN 3
              WHEN '1-30 days' THEN 4
              WHEN 'Current' THEN 5
              WHEN 'Future' THEN 6
            END
        `;

        const aging = await dbUtils.executeQuery(agingQuery, params);
        reportData = {
          type: 'aging',
          data: aging.rows.map(row => ({
            aging_bucket: row.aging_bucket,
            invoice_count: parseInt(row.invoice_count),
            total_amount: parseFloat(row.total_amount || 0),
          })),
        };
        break;

      case 'vendor':
        // Vendor analysis report
        const vendorQuery = `
          SELECT 
            vendor_name,
            COUNT(*) as invoice_count,
            SUM(CASE WHEN total_amount IS NOT NULL THEN total_amount ELSE 0 END) as total_amount,
            AVG(CASE WHEN total_amount IS NOT NULL THEN total_amount ELSE NULL END) as avg_amount,
            MIN(invoice_date) as first_invoice,
            MAX(invoice_date) as last_invoice
          FROM invoices 
          ${dateConditions}
          AND vendor_name IS NOT NULL
          GROUP BY vendor_name
          ORDER BY total_amount DESC
        `;

        const vendors = await dbUtils.executeQuery(vendorQuery, params);
        reportData = {
          type: 'vendor',
          data: vendors.rows.map(row => ({
            vendor_name: row.vendor_name,
            invoice_count: parseInt(row.invoice_count),
            total_amount: parseFloat(row.total_amount || 0),
            avg_amount: parseFloat(row.avg_amount || 0),
            first_invoice: row.first_invoice,
            last_invoice: row.last_invoice,
          })),
        };
        break;

      case 'monthly':
        // Monthly trends report
        const monthlyQuery = `
          SELECT 
            DATE_TRUNC('month', invoice_date) as month,
            COUNT(*) as invoice_count,
            SUM(CASE WHEN total_amount IS NOT NULL THEN total_amount ELSE 0 END) as total_amount,
            AVG(CASE WHEN total_amount IS NOT NULL THEN total_amount ELSE NULL END) as avg_amount,
            COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
            SUM(CASE WHEN status = 'paid' AND total_amount IS NOT NULL THEN total_amount ELSE 0 END) as paid_amount
          FROM invoices 
          ${dateConditions}
          AND invoice_date IS NOT NULL
          GROUP BY DATE_TRUNC('month', invoice_date)
          ORDER BY month DESC
          LIMIT 24
        `;

        const monthly = await dbUtils.executeQuery(monthlyQuery, params);
        reportData = {
          type: 'monthly',
          data: monthly.rows.map(row => ({
            month: row.month,
            invoice_count: parseInt(row.invoice_count),
            total_amount: parseFloat(row.total_amount || 0),
            avg_amount: parseFloat(row.avg_amount || 0),
            paid_count: parseInt(row.paid_count),
            paid_amount: parseFloat(row.paid_amount || 0),
          })),
        };
        break;

      case 'processing':
        // Processing status report
        const processingQuery = `
          SELECT 
            processing_status,
            COUNT(*) as invoice_count,
            AVG(confidence_score) as avg_confidence,
            COUNT(CASE WHEN confidence_score >= 0.9 THEN 1 END) as high_confidence,
            COUNT(CASE WHEN confidence_score < 0.7 THEN 1 END) as low_confidence
          FROM invoices 
          ${dateConditions}
          GROUP BY processing_status
        `;

        const processing = await dbUtils.executeQuery(processingQuery, params);
        reportData = {
          type: 'processing',
          data: processing.rows.map(row => ({
            processing_status: row.processing_status,
            invoice_count: parseInt(row.invoice_count),
            avg_confidence: parseFloat(row.avg_confidence || 0),
            high_confidence: parseInt(row.high_confidence),
            low_confidence: parseInt(row.low_confidence),
          })),
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid report type',
          message: 'Supported report types: aging, vendor, monthly, processing',
        });
    }

    // Log report generation
    logger.info('Report generated', {
      userId: req.user.id,
      reportType: report_type,
      format,
      recordCount: reportData.data?.length || 0,
    });

    res.json({
      success: true,
      data: {
        report: reportData,
        generated_at: new Date().toISOString(),
        date_range: {
          start_date: start_date || null,
          end_date: end_date || null,
        },
      },
    });

  } catch (error) {
    logger.error('Report generation failed', {
      userId: req.user.id,
      reportType: report_type,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Report generation failed',
      message: 'An error occurred while generating the report',
    });
  }
}));

// @route   POST /api/analytics/export
// @desc    Export analytics data
// @access  Private
router.post('/export', asyncHandler(async (req, res) => {
  const { export_type, filters = {}, format = 'csv' } = req.body;

  if (!export_type) {
    return res.status(400).json({
      success: false,
      error: 'Export type required',
      message: 'Please specify the type of data to export',
    });
  }

  try {
    // Build query based on export type
    let query = '';
    const params = [req.user.id];

    switch (export_type) {
      case 'invoices':
        query = `
          SELECT 
            i.id,
            i.invoice_number,
            i.vendor_name,
            i.vendor_email,
            i.invoice_date,
            i.due_date,
            i.total_amount,
            i.currency,
            i.status,
            i.processing_status,
            i.confidence_score,
            i.created_at,
            i.updated_at
          FROM invoices i
          WHERE i.user_id = $1
          ORDER BY i.created_at DESC
        `;
        break;

      case 'line_items':
        query = `
          SELECT 
            li.id,
            li.invoice_id,
            li.description,
            li.quantity,
            li.unit_price,
            li.total_price,
            li.tax_amount,
            li.tax_rate,
            li.unit,
            li.sku,
            li.category,
            li.created_at,
            i.vendor_name,
            i.invoice_date
          FROM line_items li
          JOIN invoices i ON li.invoice_id = i.id
          WHERE i.user_id = $1
          ORDER BY li.created_at DESC
        `;
        break;

      case 'chat_history':
        query = `
          SELECT 
            id,
            session_id,
            message_type,
            content,
            tokens_used,
            processing_time_ms,
            created_at
          FROM messages
          WHERE user_id = $1
          ORDER BY created_at DESC
        `;
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid export type',
          message: 'Supported export types: invoices, line_items, chat_history',
        });
    }

    // Execute query
    const result = await dbUtils.executeQuery(query, params);

    // Log export
    logger.info('Data export completed', {
      userId: req.user.id,
      exportType: export_type,
      format,
      recordCount: result.rows.length,
    });

    res.json({
      success: true,
      data: {
        export_type,
        format,
        record_count: result.rows.length,
        download_url: `/api/analytics/download/${export_type}_${Date.now()}.${format}`,
        generated_at: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error('Data export failed', {
      userId: req.user.id,
      exportType: export_type,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Export failed',
      message: 'An error occurred while exporting the data',
    });
  }
}));

module.exports = router;