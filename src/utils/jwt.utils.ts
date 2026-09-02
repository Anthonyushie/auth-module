import jwt, { SignOptions } from 'jsonwebtoken';
import { CookieOptions } from 'express';
import { env } from '../config/env.config';
import { AccessTokenPayload, AuthUserPayload, RefreshTokenPayload } from '../types/auth.types';

/**
 * Generates a short-lived signed JWT Access Token (default 15 minutes).
 * Contains minimal user claims (userId, email, role).
 */
export const generateAccessToken = (user: AuthUserPayload): string => {
  const payload: AccessTokenPayload = {
    userId: user.userId,
    email: user.email,
    role: user.role,
    tokenType: 'access',
  };

  const options: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_EXPIRY as unknown as number, // Cast for jwt.SignOptions
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
};

/**
 * Generates a long-lived signed JWT Refresh Token (default 7 days).
 * Contains only the subject/userId to minimize exposure if token is decoded.
 */
export const generateRefreshToken = (userId: string): string => {
  const payload: RefreshTokenPayload = {
    userId,
    tokenType: 'refresh',
  };

  const options: SignOptions = {
    expiresIn: env.REFRESH_TOKEN_EXPIRY as unknown as number,
  };

  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
};

/**
 * Verifies and decodes an Access Token.
 * Throws JsonWebTokenError or TokenExpiredError if invalid.
 */
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  if (decoded.tokenType !== 'access') {
    throw new jwt.JsonWebTokenError('Invalid token type: Expected access token');
  }
  return decoded;
};

/**
 * Verifies and decodes a Refresh Token.
 * Throws JsonWebTokenError or TokenExpiredError if invalid.
 */
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  if (decoded.tokenType !== 'refresh') {
    throw new jwt.JsonWebTokenError('Invalid token type: Expected refresh token');
  }
  return decoded;
};

/**
 * Standard HTTP-Only Cookie options for storing the Refresh Token.
 *
 * Security rationale:
 * 1. httpOnly: true -> Inaccessible to JavaScript (document.cookie), mitigating XSS token theft.
 * 2. secure: true (in prod) -> Ensures cookie is only transmitted over encrypted HTTPS connections.
 * 3. sameSite: 'strict' (or 'lax') -> Protects against Cross-Site Request Forgery (CSRF).
 * 4. maxAge -> Explicit lifetime matching the refresh token validity.
 * 5. path: '/api/auth' -> Restricts cookie dispatch only to authentication endpoints.
 */
export const getRefreshTokenCookieOptions = (): CookieOptions => {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: env.REFRESH_TOKEN_COOKIE_MAX_AGE,
    path: '/api/auth', // Scopes cookie only to auth endpoints to minimize unnecessary transmission
  };
};

/**
 * Calculates the exact expiration Date object for saving into the database.
 */
export const calculateRefreshTokenExpiryDate = (): Date => {
  return new Date(Date.now() + env.REFRESH_TOKEN_COOKIE_MAX_AGE);
};
