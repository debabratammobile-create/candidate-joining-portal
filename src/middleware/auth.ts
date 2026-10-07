import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];

  // Support verified Firebase ID tokens as well as authorized admin session tokens
  if (token.startsWith('doorbly-admin-session:')) {
    const parts = token.split(':');
    const email = (parts[1] || '').trim().toLowerCase();
    const uid = parts[2] || 'admin-super-tribune';
    if (email !== 'debabrata.tribune@gmail.com') {
      return res.status(403).json({ error: 'Forbidden: Unauthorized administrator account.' });
    }
    req.user = {
      uid,
      email,
      name: 'Debabrata Mohanta',
    } as unknown as DecodedIdToken;
    return next();
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    if ((decodedToken.email || '').trim().toLowerCase() !== 'debabrata.tribune@gmail.com') {
      return res.status(403).json({ error: 'Forbidden: Unauthorized administrator account.' });
    }
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
