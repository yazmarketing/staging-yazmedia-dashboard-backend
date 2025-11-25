import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IJWTPayload } from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: IJWTPayload;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    const token = authHeader?.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as IJWTPayload;
    
    // Map ADMIN role to MANAGEMENT for backward compatibility
    // This ensures existing tokens with ADMIN role still work
    // Compare as string since JWT tokens contain string values, not enum values
    if (String(decoded.role) === 'ADMIN') {
      (decoded as any).role = 'MANAGEMENT' as any;
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Map ADMIN to MANAGEMENT for backward compatibility
    // Compare as string since JWT tokens may contain 'ADMIN' as string value
    const userRole = String(req.user.role) === 'ADMIN' ? 'MANAGEMENT' : req.user.role;
    
    // MANAGEMENT role has access to everything (superset of all other roles)
    // So if MANAGEMENT is in required roles, allow access
    if (roles.includes('MANAGEMENT') && userRole === 'MANAGEMENT') {
      next();
      return;
    }

    if (!roles.includes(userRole)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  };
};

