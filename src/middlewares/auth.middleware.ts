import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyAccessToken } from '../utils/jwt.utils';
import { Role } from '../types/auth.types';

/**
 * Authentication Middleware:
 * Verifies the short-lived JWT Access Token provided in the `Authorization: Bearer <token>` header.
 * Attaches the authenticated user payload to `req.user`.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  // 1. Check for presence of Authorization header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Authentication required. Authorization header missing or format is not Bearer <token>',
    });
    return;
  }

  // 2. Extract Bearer token string
  const token = authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Malformed authorization token',
    });
    return;
  }

  try {
    // 3. Verify signature, structure, and expiration
    const decoded = verifyAccessToken(token);

    // 4. Attach decoded payload to Express request context
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    // 5. Handle token expiration and validation errors gracefully
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Access token has expired. Please refresh your session.',
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        code: 'TOKEN_INVALID',
        message: 'Invalid or corrupted access token.',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication verification',
    });
  }
};

/**
 * Role-Based Access Control (RBAC) Middleware:
 * Verifies that the authenticated user possesses at least one of the permitted roles.
 * Must be mounted AFTER `requireAuth`.
 *
 * @param allowedRoles - Array of roles permitted to access the route
 */
export const requireRole = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 1. Ensure user has passed authentication middleware
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: User authentication context not found',
      });
      return;
    }

    // 2. Check if user's role is in the allowed whitelist
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: `Forbidden: User role '${req.user.role}' lacks sufficient permissions. Required roles: [${allowedRoles.join(', ')}]`,
      });
      return;
    }

    next();
  };
};
