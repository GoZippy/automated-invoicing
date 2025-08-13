import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '@/middleware/errorHandler';

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};