import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
    }
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Add request ID
  req.id = req.headers['x-request-id'] as string || uuidv4();
  req.startTime = Date.now();

  // Log request
  logger.info({
    type: 'REQUEST',
    requestId: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: (req as any).user?.id,
  });

  // Log response
  const originalSend = res.send;
  res.send = function (data) {
    const responseTime = Date.now() - req.startTime;
    
    logger.info({
      type: 'RESPONSE',
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      userId: (req as any).user?.id,
    });

    // Log slow requests
    if (responseTime > 1000) {
      logger.warn({
        type: 'SLOW_REQUEST',
        requestId: req.id,
        method: req.method,
        url: req.url,
        responseTime,
      });
    }

    res.send = originalSend;
    return res.send(data);
  };

  next();
};