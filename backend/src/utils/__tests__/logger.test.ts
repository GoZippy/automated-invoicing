import winston from 'winston';
import { logger, logAudit, logPerformance } from '../logger';
import fs from 'fs';
import path from 'path';

// Mock winston transports
jest.mock('winston', () => {
  const actualWinston = jest.requireActual('winston');
  return {
    ...actualWinston,
    transports: {
      File: jest.fn(),
      Console: jest.fn(),
    },
    createLogger: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    })),
  };
});

jest.mock('fs');
jest.mock('path');

describe('Logger Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env.LOG_LEVEL = 'info';
    process.env.NODE_ENV = 'test';
  });

  describe('Logger Configuration', () => {
    it('should create logger with correct configuration', () => {
      const { createLogger } = require('winston');
      expect(createLogger).toHaveBeenCalled();
      
      const loggerConfig = (createLogger as jest.Mock).mock.calls[0][0];
      expect(loggerConfig.level).toBe('info');
      expect(loggerConfig.defaultMeta).toEqual({ service: 'invoice-api' });
    });

    it('should use error log level in test environment', () => {
      process.env.NODE_ENV = 'test';
      jest.resetModules();
      require('../logger');
      
      const { createLogger } = require('winston');
      const loggerConfig = (createLogger as jest.Mock).mock.calls[0][0];
      expect(loggerConfig.level).toBe('error');
    });
  });

  describe('Log Methods', () => {
    it('should log info messages', () => {
      const testMessage = 'Test info message';
      const testMeta = { userId: '123' };
      
      logger.info(testMessage, testMeta);
      
      expect(logger.info).toHaveBeenCalledWith(testMessage, testMeta);
    });

    it('should log error messages with stack trace', () => {
      const testError = new Error('Test error');
      const testMeta = { requestId: 'abc123' };
      
      logger.error(testError.message, { ...testMeta, stack: testError.stack });
      
      expect(logger.error).toHaveBeenCalledWith(
        testError.message,
        expect.objectContaining({
          requestId: 'abc123',
          stack: expect.any(String),
        })
      );
    });

    it('should log warning messages', () => {
      const testMessage = 'Test warning';
      
      logger.warn(testMessage);
      
      expect(logger.warn).toHaveBeenCalledWith(testMessage);
    });

    it('should log debug messages', () => {
      const testMessage = 'Test debug message';
      const testData = { debug: true };
      
      logger.debug(testMessage, testData);
      
      expect(logger.debug).toHaveBeenCalledWith(testMessage, testData);
    });
  });

  describe('Audit Logging', () => {
    it('should log audit events with correct structure', () => {
      const action = 'USER_LOGIN';
      const userId = 'user-123';
      const details = { ip: '192.168.1.1', userAgent: 'Mozilla/5.0' };
      
      logAudit(action, userId, details);
      
      expect(logger.info).toHaveBeenCalledWith({
        type: 'AUDIT',
        action,
        userId,
        timestamp: expect.any(String),
        details,
      });
    });

    it('should handle audit logging without details', () => {
      const action = 'USER_LOGOUT';
      const userId = 'user-456';
      
      logAudit(action, userId);
      
      expect(logger.info).toHaveBeenCalledWith({
        type: 'AUDIT',
        action,
        userId,
        timestamp: expect.any(String),
        details: {},
      });
    });

    it('should include timestamp in ISO format', () => {
      const action = 'INVOICE_CREATED';
      const userId = 'user-789';
      
      logAudit(action, userId);
      
      const logCall = (logger.info as jest.Mock).mock.calls[0][0];
      expect(new Date(logCall.timestamp).toISOString()).toBe(logCall.timestamp);
    });
  });

  describe('Performance Logging', () => {
    it('should log performance metrics', () => {
      const operation = 'database_query';
      const duration = 150;
      const metadata = { query: 'SELECT * FROM invoices', rows: 10 };
      
      logPerformance(operation, duration, metadata);
      
      expect(logger.info).toHaveBeenCalledWith({
        type: 'PERFORMANCE',
        operation,
        duration,
        timestamp: expect.any(String),
        metadata,
      });
    });

    it('should warn for slow operations', () => {
      const operation = 'api_request';
      const duration = 1500; // Over 1 second
      
      logPerformance(operation, duration);
      
      expect(logger.warn).toHaveBeenCalledWith({
        type: 'SLOW_OPERATION',
        operation,
        duration,
        timestamp: expect.any(String),
        metadata: {},
      });
    });

    it('should handle performance logging without metadata', () => {
      const operation = 'cache_lookup';
      const duration = 50;
      
      logPerformance(operation, duration);
      
      expect(logger.info).toHaveBeenCalledWith({
        type: 'PERFORMANCE',
        operation,
        duration,
        timestamp: expect.any(String),
        metadata: {},
      });
    });
  });

  describe('File Transport', () => {
    it('should create logs directory if it does not exist', () => {
      const mkdirSyncSpy = fs.mkdirSync as jest.Mock;
      const existsSyncSpy = fs.existsSync as jest.Mock;
      
      existsSyncSpy.mockReturnValue(false);
      
      jest.resetModules();
      require('../logger');
      
      expect(existsSyncSpy).toHaveBeenCalledWith(expect.stringContaining('logs'));
      expect(mkdirSyncSpy).toHaveBeenCalledWith(
        expect.stringContaining('logs'),
        { recursive: true }
      );
    });

    it('should not create logs directory if it already exists', () => {
      const mkdirSyncSpy = fs.mkdirSync as jest.Mock;
      const existsSyncSpy = fs.existsSync as jest.Mock;
      
      existsSyncSpy.mockReturnValue(true);
      mkdirSyncSpy.mockClear();
      
      jest.resetModules();
      require('../logger');
      
      expect(existsSyncSpy).toHaveBeenCalledWith(expect.stringContaining('logs'));
      expect(mkdirSyncSpy).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle circular references in logged objects', () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      
      expect(() => {
        logger.info('Circular reference test', circular);
      }).not.toThrow();
      
      expect(logger.info).toHaveBeenCalled();
    });

    it('should handle undefined and null values', () => {
      expect(() => {
        logger.info('Null test', null);
        logger.info('Undefined test', undefined);
      }).not.toThrow();
      
      expect(logger.info).toHaveBeenCalledTimes(2);
    });
  });
});