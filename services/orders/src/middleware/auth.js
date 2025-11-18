// Authentication middleware for orders service
import jwt from 'jsonwebtoken';
import logger from '@ecomm/logger';

// Verify JWT token
export function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    // Attach user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    logger.error('JWT verification failed', { error: error.message });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

