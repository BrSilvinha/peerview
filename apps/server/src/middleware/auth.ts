import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../services/authService';

// Augment Express Request to carry the decoded JWT payload
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.slice(7); // remove "Bearer "

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof Error) {
      const isExpired = err.message.includes('expired');
      res.status(401).json({
        error: isExpired ? 'Token expired' : 'Invalid token',
      });
    } else {
      res.status(401).json({ error: 'Invalid token' });
    }
  }
}
