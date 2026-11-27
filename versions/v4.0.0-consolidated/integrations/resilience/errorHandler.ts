// IMPORTED INTO CHRONOS v4.0.0 (consolidation, 2026-11-24)
// Source: vinnieboy707/Vip-Registatiom  |  Original path: Vip-Registatiom/backend/src/middleware/errorHandler.ts  |  imported verbatim

import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/**
 * Error handling middleware
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Not found middleware
 */
export const notFound = (req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.url}`,
  });
};

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });

  next();
};

/**
 * Audit logging middleware
 */
export const auditLog = (action: string, resource: string) => {
  return (req: any, res: Response, next: NextFunction): void => {
    // Log the action after response is sent
    res.on('finish', () => {
      if (req.user) {
        const db = require('../config/database').default;
        db.run(
          `INSERT INTO audit_logs (user_id, action, resource, resource_id, ip_address, details) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            action,
            resource,
            req.params.id || null,
            req.ip,
            JSON.stringify({ method: req.method, body: req.body }),
          ],
          (err: Error) => {
            if (err) {
              logger.error('Audit log error:', err);
            }
          }
        );
      }
    });

    next();
  };
};
