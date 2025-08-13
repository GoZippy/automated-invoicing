import { Request, Response } from 'express';

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: {
      message: 'Resource not found',
      code: 'NOT_FOUND',
      statusCode: 404,
      path: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
    },
  });
};