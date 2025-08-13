import nodemailer from 'nodemailer';
import emailService from '../email.service';
import { logger } from '../../utils/logger';

// Mock nodemailer
jest.mock('nodemailer');

describe('Email Service', () => {
  let mockTransporter: any;
  let mockSendMail: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock transporter
    mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-message-id' });
    mockTransporter = {
      sendMail: mockSendMail,
      verify: jest.fn().mockResolvedValue(true),
    };
    
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
    (nodemailer.createTestAccount as jest.Mock).mockResolvedValue({
      user: 'test@ethereal.email',
      pass: 'test-password',
    });
  });

  describe('Transporter Initialization', () => {
    it('should create transporter with environment variables in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_PORT = '587';
      process.env.EMAIL_USER = 'user@example.com';
      process.env.EMAIL_PASS = 'password';
      process.env.EMAIL_SECURE = 'true';

      jest.resetModules();
      require('../email.service');

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: true,
        auth: {
          user: 'user@example.com',
          pass: 'password',
        },
      });
    });

    it('should create test transporter in development', async () => {
      process.env.NODE_ENV = 'development';
      
      jest.resetModules();
      await require('../email.service');

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(nodemailer.createTestAccount).toHaveBeenCalled();
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: 'test@ethereal.email',
          pass: 'test-password',
        },
      });
    });
  });

  describe('sendEmail', () => {
    const defaultEmailOptions = {
      to: 'recipient@example.com',
      subject: 'Test Email',
      html: '<p>Test email content</p>',
    };

    it('should send email successfully', async () => {
      const result = await emailService.sendEmail(defaultEmailOptions);

      expect(mockSendMail).toHaveBeenCalledWith({
        from: process.env.EMAIL_FROM || 'noreply@invoiceai.com',
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test email content</p>',
      });

      expect(result).toEqual({ 
        success: true, 
        messageId: 'test-message-id' 
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Email sent successfully',
        { 
          messageId: 'test-message-id',
          to: 'recipient@example.com',
          subject: 'Test Email',
        }
      );
    });

    it('should send email with text content', async () => {
      const emailOptions = {
        ...defaultEmailOptions,
        text: 'Plain text content',
        html: undefined,
      };

      await emailService.sendEmail(emailOptions);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Plain text content',
          html: undefined,
        })
      );
    });

    it('should send email with custom from address', async () => {
      const emailOptions = {
        ...defaultEmailOptions,
        from: 'custom@example.com',
      };

      await emailService.sendEmail(emailOptions);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'custom@example.com',
        })
      );
    });

    it('should send email with attachments', async () => {
      const attachments = [
        {
          filename: 'invoice.pdf',
          content: Buffer.from('PDF content'),
        },
      ];

      const emailOptions = {
        ...defaultEmailOptions,
        attachments,
      };

      await emailService.sendEmail(emailOptions);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments,
        })
      );
    });

    it('should handle email sending errors', async () => {
      const error = new Error('SMTP connection failed');
      mockSendMail.mockRejectedValue(error);

      const result = await emailService.sendEmail(defaultEmailOptions);

      expect(result).toEqual({
        success: false,
        error: 'SMTP connection failed',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send email',
        {
          error: error.message,
          to: 'recipient@example.com',
          subject: 'Test Email',
        }
      );
    });

    it('should log test email URL in development', async () => {
      process.env.NODE_ENV = 'development';
      (nodemailer.getTestMessageUrl as jest.Mock).mockReturnValue('https://ethereal.email/message/123');

      await emailService.sendEmail(defaultEmailOptions);

      expect(logger.info).toHaveBeenCalledWith(
        'Preview URL: https://ethereal.email/message/123'
      );
    });
  });

  describe('Email Templates', () => {
    it('should send welcome email', async () => {
      await emailService.sendWelcomeEmail('user@example.com', 'John Doe');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Welcome to InvoiceAI',
          html: expect.stringContaining('Welcome to InvoiceAI, John Doe!'),
        })
      );
    });

    it('should send password reset email', async () => {
      const resetLink = 'https://example.com/reset?token=abc123';
      
      await emailService.sendPasswordResetEmail('user@example.com', resetLink);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Password Reset Request',
          html: expect.stringContaining(resetLink),
        })
      );
    });

    it('should send invoice notification email', async () => {
      const invoiceData = {
        invoiceNumber: 'INV-001',
        amount: 1000,
        dueDate: '2024-12-31',
      };

      await emailService.sendInvoiceNotification('user@example.com', invoiceData);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'New Invoice: INV-001',
          html: expect.stringContaining('INV-001'),
        })
      );
    });

    it('should send payment reminder email', async () => {
      const invoiceData = {
        invoiceNumber: 'INV-001',
        amount: 1000,
        dueDate: '2024-12-31',
        daysOverdue: 5,
      };

      await emailService.sendPaymentReminder('user@example.com', invoiceData);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Payment Reminder: Invoice INV-001',
          html: expect.stringContaining('5 days overdue'),
        })
      );
    });

    it('should send payment confirmation email', async () => {
      const paymentData = {
        invoiceNumber: 'INV-001',
        amount: 1000,
        paymentDate: '2024-01-15',
        paymentMethod: 'Credit Card',
      };

      await emailService.sendPaymentConfirmation('user@example.com', paymentData);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Payment Received: Invoice INV-001',
          html: expect.stringContaining('Credit Card'),
        })
      );
    });
  });

  describe('Batch Email Sending', () => {
    it('should send emails to multiple recipients', async () => {
      const recipients = ['user1@example.com', 'user2@example.com', 'user3@example.com'];
      const emailOptions = {
        subject: 'Bulk Email',
        html: '<p>Bulk email content</p>',
      };

      const results = await emailService.sendBulkEmails(recipients, emailOptions);

      expect(mockSendMail).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle partial failures in bulk sending', async () => {
      const recipients = ['user1@example.com', 'user2@example.com'];
      mockSendMail
        .mockResolvedValueOnce({ messageId: 'msg-1' })
        .mockRejectedValueOnce(new Error('Failed to send'));

      const results = await emailService.sendBulkEmails(recipients, {
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(results).toEqual([
        { recipient: 'user1@example.com', success: true, messageId: 'msg-1' },
        { recipient: 'user2@example.com', success: false, error: 'Failed to send' },
      ]);
    });
  });

  describe('Email Validation', () => {
    it('should validate email format', () => {
      expect(emailService.isValidEmail('valid@example.com')).toBe(true);
      expect(emailService.isValidEmail('invalid-email')).toBe(false);
      expect(emailService.isValidEmail('')).toBe(false);
      expect(emailService.isValidEmail('user@')).toBe(false);
      expect(emailService.isValidEmail('@example.com')).toBe(false);
    });
  });

  describe('Email Queue', () => {
    it('should queue emails when rate limited', async () => {
      // Simulate rate limiting
      emailService.setRateLimit(1, 1000); // 1 email per second

      const promises = [
        emailService.sendEmail({ to: 'user1@example.com', subject: 'Test 1', html: '<p>1</p>' }),
        emailService.sendEmail({ to: 'user2@example.com', subject: 'Test 2', html: '<p>2</p>' }),
      ];

      const startTime = Date.now();
      await Promise.all(promises);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(1000);
      expect(mockSendMail).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed emails', async () => {
      mockSendMail
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ messageId: 'success-id' });

      const result = await emailService.sendEmailWithRetry(
        { to: 'user@example.com', subject: 'Test', html: '<p>Test</p>' },
        { maxRetries: 3, retryDelay: 100 }
      );

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      mockSendMail.mockRejectedValue(new Error('Persistent failure'));

      const result = await emailService.sendEmailWithRetry(
        { to: 'user@example.com', subject: 'Test', html: '<p>Test</p>' },
        { maxRetries: 2, retryDelay: 100 }
      );

      expect(result.success).toBe(false);
      expect(mockSendMail).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
});