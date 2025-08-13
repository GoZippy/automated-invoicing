import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

// Create transporter
const createTransporter = () => {
  if (process.env.NODE_ENV === 'test') {
    // Use Ethereal for testing
    return nodemailer.createTransporter({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'ethereal.user@ethereal.email',
        pass: 'ethereal.pass',
      },
    });
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn('Email service not configured. Emails will not be sent.');
    return null;
  }

  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const transporter = createTransporter();

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  if (!transporter) {
    logger.warn('Email not sent - email service not configured:', {
      to: options.to,
      subject: options.subject,
    });
    return;
  }

  try {
    const mailOptions = {
      from: options.from || process.env.EMAIL_FROM || 'noreply@intelligentinvoicing.com',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info('Email sent successfully:', {
      messageId: info.messageId,
      to: options.to,
      subject: options.subject,
    });

    // Log preview URL in development
    if (process.env.NODE_ENV === 'development') {
      logger.info('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    logger.error('Failed to send email:', error);
    throw new Error('Failed to send email');
  }
};

// Email templates
export const emailTemplates = {
  welcome: (name: string) => ({
    subject: 'Welcome to Intelligent Invoicing',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Welcome to Intelligent Invoicing!</h1>
        <p>Hi ${name},</p>
        <p>Thank you for signing up. We're excited to help you streamline your invoice management process.</p>
        <p>Get started by:</p>
        <ul>
          <li>Uploading your first invoice</li>
          <li>Exploring the AI chat assistant</li>
          <li>Checking out the dashboard</li>
        </ul>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Best regards,<br>The Intelligent Invoicing Team</p>
      </div>
    `,
  }),

  invoiceProcessed: (invoiceNumber: string, status: string) => ({
    subject: `Invoice ${invoiceNumber} has been processed`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Invoice Processing Complete</h2>
        <p>Your invoice <strong>${invoiceNumber}</strong> has been successfully processed.</p>
        <p>Status: <strong>${status}</strong></p>
        <p>You can view the invoice details in your dashboard.</p>
        <p>Best regards,<br>The Intelligent Invoicing Team</p>
      </div>
    `,
  }),

  paymentReminder: (invoiceNumber: string, dueDate: string, amount: string) => ({
    subject: `Payment reminder for invoice ${invoiceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Payment Reminder</h2>
        <p>This is a friendly reminder that payment for invoice <strong>${invoiceNumber}</strong> is due on <strong>${dueDate}</strong>.</p>
        <p>Amount due: <strong>${amount}</strong></p>
        <p>Please ensure payment is made by the due date to avoid any late fees.</p>
        <p>If you have already made the payment, please disregard this reminder.</p>
        <p>Best regards,<br>The Intelligent Invoicing Team</p>
      </div>
    `,
  }),

  monthlyReport: (userName: string, stats: any) => ({
    subject: 'Your Monthly Invoice Report',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Monthly Invoice Report</h1>
        <p>Hi ${userName},</p>
        <p>Here's your invoice summary for the past month:</p>
        <ul>
          <li>Total invoices: ${stats.totalInvoices}</li>
          <li>Total revenue: ${stats.totalRevenue}</li>
          <li>Paid invoices: ${stats.paidInvoices}</li>
          <li>Pending payments: ${stats.pendingPayments}</li>
          <li>Overdue invoices: ${stats.overdueInvoices}</li>
        </ul>
        <p>Log in to your dashboard for detailed insights.</p>
        <p>Best regards,<br>The Intelligent Invoicing Team</p>
      </div>
    `,
  }),
};

// Queue email for batch sending (placeholder for future implementation)
export const queueEmail = async (options: EmailOptions): Promise<void> => {
  // In production, this would add the email to a queue (Redis, RabbitMQ, etc.)
  // For now, send immediately
  await sendEmail(options);
};