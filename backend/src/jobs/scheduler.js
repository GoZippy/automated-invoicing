const cron = require('node-cron');
const { dbUtils } = require('../database/connection');
const logger = require('../utils/logger');

// Background job scheduler
class JobScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  // Start the scheduler
  start() {
    if (this.isRunning) {
      logger.warn('Job scheduler is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting job scheduler');

    // Schedule jobs
    this.scheduleInvoiceProcessing();
    this.scheduleDataCleanup();
    this.scheduleReportGeneration();
    this.scheduleHealthChecks();
    this.scheduleNotificationCleanup();

    logger.info('Job scheduler started successfully');
  }

  // Stop the scheduler
  stop() {
    if (!this.isRunning) {
      logger.warn('Job scheduler is not running');
      return;
    }

    this.isRunning = false;
    
    // Stop all scheduled jobs
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped job: ${name}`);
    });

    this.jobs.clear();
    logger.info('Job scheduler stopped');
  }

  // Schedule invoice processing jobs
  scheduleInvoiceProcessing() {
    // Process pending invoices every 5 minutes
    const invoiceProcessingJob = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.processPendingInvoices();
      } catch (error) {
        logger.error('Invoice processing job failed', {
          error: error.message,
        });
      }
    });

    this.jobs.set('invoice_processing', invoiceProcessingJob);
    logger.info('Scheduled invoice processing job (every 5 minutes)');

    // Check for overdue invoices daily at 9 AM
    const overdueCheckJob = cron.schedule('0 9 * * *', async () => {
      try {
        await this.checkOverdueInvoices();
      } catch (error) {
        logger.error('Overdue invoice check job failed', {
          error: error.message,
        });
      }
    });

    this.jobs.set('overdue_check', overdueCheckJob);
    logger.info('Scheduled overdue invoice check job (daily at 9 AM)');
  }

  // Schedule data cleanup jobs
  scheduleDataCleanup() {
    // Clean up old sessions daily at 2 AM
    const sessionCleanupJob = cron.schedule('0 2 * * *', async () => {
      try {
        await this.cleanupExpiredSessions();
      } catch (error) {
        logger.error('Session cleanup job failed', {
          error: error.message,
        });
      }
    });

    this.jobs.set('session_cleanup', sessionCleanupJob);
    logger.info('Scheduled session cleanup job (daily at 2 AM)');

    // Clean up old audit logs weekly on Sunday at 3 AM
    const auditCleanupJob = cron.schedule('0 3 * * 0', async () => {
      try {
        await this.cleanupOldAuditLogs();
      } catch (error) {
        logger.error('Audit log cleanup job failed', {
          error: error.message,
        });
      }
    });

    this.jobs.set('audit_cleanup', auditCleanupJob);
    logger.info('Scheduled audit log cleanup job (weekly on Sunday at 3 AM)');
  }

  // Schedule report generation jobs
  scheduleReportGeneration() {
    // Generate daily reports at 6 AM
    const dailyReportJob = cron.schedule('0 6 * * *', async () => {
      try {
        await this.generateDailyReports();
      } catch (error) {
        logger.error('Daily report generation job failed', {
          error: error.message,
        });
      }
    });

    this.jobs.set('daily_reports', dailyReportJob);
    logger.info('Scheduled daily report generation job (daily at 6 AM)');

    // Generate weekly reports on Monday at 7 AM
    const weeklyReportJob = cron.schedule('0 7 * * 1', async () => {
      try {
        await this.generateWeeklyReports();
      } catch (error) {
        logger.error('Weekly report generation job failed', {
          error: error.message,
        });
      }
    });

    this.jobs.set('weekly_reports', weeklyReportJob);
    logger.info('Scheduled weekly report generation job (weekly on Monday at 7 AM)');
  }

  // Schedule health check jobs
  scheduleHealthChecks() {
    // Health check every 10 minutes
    const healthCheckJob = cron.schedule('*/10 * * * *', async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Health check job failed', {
          error: error.message,
        });
      }
    });

    this.jobs.set('health_check', healthCheckJob);
    logger.info('Scheduled health check job (every 10 minutes)');
  }

  // Schedule notification cleanup jobs
  scheduleNotificationCleanup() {
    // Clean up old notifications daily at 4 AM
    const notificationCleanupJob = cron.schedule('0 4 * * *', async () => {
      try {
        await this.cleanupOldNotifications();
      } catch (error) {
        logger.error('Notification cleanup job failed', {
          error: error.message,
        });
      }
    });

    this.jobs.set('notification_cleanup', notificationCleanupJob);
    logger.info('Scheduled notification cleanup job (daily at 4 AM)');
  }

  // Process pending invoices
  async processPendingInvoices() {
    try {
      // Get pending invoices that haven't been processed
      const pendingInvoices = await dbUtils.find('invoices', {
        processing_status: 'pending',
      }, {
        orderBy: 'created_at ASC',
        limit: 10, // Process 10 at a time
      });

      if (pendingInvoices.length === 0) {
        return;
      }

      logger.info('Processing pending invoices', {
        count: pendingInvoices.length,
      });

      for (const invoice of pendingInvoices) {
        try {
          // Update status to processing
          await dbUtils.update('invoices', invoice.id, {
            processing_status: 'processing',
            updated_at: new Date(),
          });

          // TODO: Trigger AI processing workflow
          // await triggerInvoiceProcessing(invoice.id);

          logger.info('Invoice processing triggered', {
            invoiceId: invoice.id,
          });

        } catch (error) {
          logger.error('Failed to process invoice', {
            invoiceId: invoice.id,
            error: error.message,
          });

          // Mark as failed
          await dbUtils.update('invoices', invoice.id, {
            processing_status: 'failed',
            error_message: error.message,
            updated_at: new Date(),
          });
        }
      }

    } catch (error) {
      logger.error('Invoice processing job error', {
        error: error.message,
      });
    }
  }

  // Check for overdue invoices
  async checkOverdueInvoices() {
    try {
      const overdueInvoices = await dbUtils.executeQuery(`
        SELECT id, user_id, vendor_name, due_date, total_amount
        FROM invoices
        WHERE due_date < CURRENT_DATE
        AND status = 'pending'
        AND processing_status = 'completed'
      `);

      if (overdueInvoices.rows.length === 0) {
        return;
      }

      logger.info('Found overdue invoices', {
        count: overdueInvoices.rows.length,
      });

      for (const invoice of overdueInvoices.rows) {
        try {
          // Update status to overdue
          await dbUtils.update('invoices', invoice.id, {
            status: 'overdue',
            updated_at: new Date(),
          });

          // TODO: Send notification to user
          // await sendOverdueNotification(invoice.user_id, invoice);

          logger.info('Marked invoice as overdue', {
            invoiceId: invoice.id,
            userId: invoice.user_id,
          });

        } catch (error) {
          logger.error('Failed to process overdue invoice', {
            invoiceId: invoice.id,
            error: error.message,
          });
        }
      }

    } catch (error) {
      logger.error('Overdue invoice check job error', {
        error: error.message,
      });
    }
  }

  // Clean up expired sessions
  async cleanupExpiredSessions() {
    try {
      const result = await dbUtils.executeQuery(`
        DELETE FROM sessions
        WHERE expires_at < NOW()
      `);

      logger.info('Cleaned up expired sessions', {
        deletedCount: result.rowCount,
      });

    } catch (error) {
      logger.error('Session cleanup job error', {
        error: error.message,
      });
    }
  }

  // Clean up old audit logs
  async cleanupOldAuditLogs() {
    try {
      const result = await dbUtils.executeQuery(`
        DELETE FROM audit_logs
        WHERE created_at < NOW() - INTERVAL '90 days'
      `);

      logger.info('Cleaned up old audit logs', {
        deletedCount: result.rowCount,
      });

    } catch (error) {
      logger.error('Audit log cleanup job error', {
        error: error.message,
      });
    }
  }

  // Generate daily reports
  async generateDailyReports() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Get daily statistics
      const stats = await dbUtils.executeQuery(`
        SELECT 
          COUNT(*) as total_invoices,
          SUM(CASE WHEN total_amount IS NOT NULL THEN total_amount ELSE 0 END) as total_amount,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
        FROM invoices
        WHERE DATE(created_at) = DATE($1)
      `, [yesterday]);

      logger.info('Generated daily report', {
        date: yesterday.toISOString().split('T')[0],
        stats: stats.rows[0],
      });

      // TODO: Send daily report to users
      // await sendDailyReport(stats.rows[0]);

    } catch (error) {
      logger.error('Daily report generation job error', {
        error: error.message,
      });
    }
  }

  // Generate weekly reports
  async generateWeeklyReports() {
    try {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      // Get weekly statistics
      const stats = await dbUtils.executeQuery(`
        SELECT 
          COUNT(*) as total_invoices,
          SUM(CASE WHEN total_amount IS NOT NULL THEN total_amount ELSE 0 END) as total_amount,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count
        FROM invoices
        WHERE created_at >= $1
      `, [lastWeek]);

      logger.info('Generated weekly report', {
        startDate: lastWeek.toISOString().split('T')[0],
        stats: stats.rows[0],
      });

      // TODO: Send weekly report to users
      // await sendWeeklyReport(stats.rows[0]);

    } catch (error) {
      logger.error('Weekly report generation job error', {
        error: error.message,
      });
    }
  }

  // Perform health check
  async performHealthCheck() {
    try {
      // Check database connection
      const dbHealth = await dbUtils.executeQuery('SELECT NOW() as timestamp');
      
      // Check system resources
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: {
          status: 'connected',
          timestamp: dbHealth.rows[0].timestamp,
        },
        system: {
          memory: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          },
          uptime: Math.round(uptime),
        },
      };

      logger.info('Health check completed', healthStatus);

      // TODO: Send health status to monitoring service
      // await sendHealthStatus(healthStatus);

    } catch (error) {
      logger.error('Health check failed', {
        error: error.message,
      });

      // TODO: Send alert to monitoring service
      // await sendHealthAlert(error);
    }
  }

  // Clean up old notifications
  async cleanupOldNotifications() {
    try {
      const result = await dbUtils.executeQuery(`
        DELETE FROM notifications
        WHERE created_at < NOW() - INTERVAL '30 days'
        AND is_read = true
      `);

      logger.info('Cleaned up old notifications', {
        deletedCount: result.rowCount,
      });

    } catch (error) {
      logger.error('Notification cleanup job error', {
        error: error.message,
      });
    }
  }

  // Get job status
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.jobs.keys()),
      jobCount: this.jobs.size,
    };
  }
}

// Create singleton instance
const scheduler = new JobScheduler();

module.exports = scheduler;