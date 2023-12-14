import { Response, Request, NextFunction } from 'express';
import { AppError } from './appError';

export function handleError(error: AppError, request: Request, response: Response, next: NextFunction): void {
  response.status(error.status);

  if (!error.isOperational) {
    throw error;
  }

  next();
}
