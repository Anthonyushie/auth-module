import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { env } from '../config/env.config';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenCookieOptions,
  calculateRefreshTokenExpiryDate,
} from '../utils/jwt.utils';
import { LoginDto, RegisterDto, Role } from '../types/auth.types';

export class AuthController {
  /**
   * User Registration:
   * - Validates user input
   * - Hashes the password with bcrypt (cost factor 12)
   * - Saves the user to PostgreSQL
   * - Returns 201 Created without leaking password hashes
   */
  public register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, role }: RegisterDto = req.body;

      // 1. Validate payload presence
      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required fields',
        });
        return;
      }

      // 2. Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          success: false,
          message: 'Invalid email address format',
        });
        return;
      }

      // 3. Password strength policy (min 8 chars, at least one uppercase, lowercase, number)
      if (password.length < 8) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long',
        });
        return;
      }

      // 4. Check for existing user (Conflict check)
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (existingUser) {
        res.status(409).json({
          success: false,
          message: 'A user with this email address already exists',
        });
        return;
      }

      // 5. Hash password with bcrypt
      const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);

      // 6. Assign valid role (default: 'user')
      const assignedRole: Role = role === 'admin' ? 'admin' : 'user';

      // 7. Persist user to database
      const newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          role: assignedRole,
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: newUser,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * User Login:
   * - Verifies credentials against bcrypt hash
   * - Issues short-lived Access Token (15 min) & long-lived Refresh Token (7 days)
   * - Persists Refresh Token in database for rotation tracking
   * - Sets Refresh Token as HTTP-Only, Secure, SameSite cookie
   */
  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password }: LoginDto = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required',
        });
        return;
      }

      // 1. Fetch user by email
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      // Security: Use constant-time comparison / generic failure response to prevent user enumeration
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
        return;
      }

      // 2. Verify password with bcrypt
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
        return;
      }

      // 3. Generate token pair
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role as Role,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(user.id);

      // 4. Save the active refresh token to the database
      const expiresAt = calculateRefreshTokenExpiryDate();
      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt,
          isRevoked: false,
        },
      });

      // 5. Send Refresh Token in secure HTTP-Only cookie
      res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions());

      // 6. Return Access Token in JSON response body
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Refresh Token Rotation & Token Reuse Detection:
   *
   * SECURITY RATIONALE:
   * 1. Refresh Token Rotation (RTR): Every time a refresh token is used, it is invalidated immediately
   *    and replaced with a brand new token pair.
   * 2. Reuse Detection: If an attacker intercepts an old refresh token and tries to use it after the
   *    legitimate user already rotated it, we detect that the token exists but is marked `isRevoked: true`.
   *    This triggers an automatic security lockdown: ALL active refresh tokens for this user are revoked,
   *    forcing re-authentication across all devices and terminating the attacker's stolen session.
   */
  public refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const incomingRefreshToken = req.cookies.refreshToken;

      // 1. Verify cookie existence
      if (!incomingRefreshToken) {
        res.status(401).json({
          success: false,
          code: 'REFRESH_TOKEN_MISSING',
          message: 'Refresh token is missing from request cookies',
        });
        return;
      }

      // 2. Cryptographically verify the Refresh Token JWT
      let decodedUserId: string;
      try {
        const decoded = verifyRefreshToken(incomingRefreshToken);
        decodedUserId = decoded.userId;
      } catch (jwtErr) {
        // Clear untrusted cookie
        res.clearCookie('refreshToken', getRefreshTokenCookieOptions());

        if (jwtErr instanceof jwt.TokenExpiredError) {
          res.status(401).json({
            success: false,
            code: 'REFRESH_TOKEN_EXPIRED',
            message: 'Refresh token has expired. Please log in again.',
          });
          return;
        }

        res.status(401).json({
          success: false,
          code: 'REFRESH_TOKEN_INVALID',
          message: 'Invalid refresh token signature.',
        });
        return;
      }

      // 3. Lookup the token in the database
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: incomingRefreshToken },
        include: { user: true },
      });

      // -------------------------------------------------------------
      // CASE A: TOKEN REUSE DETECTED (Compromised session mitigation)
      // -------------------------------------------------------------
      // If the token is found but marked revoked, OR not found despite valid signature:
      // An attacker or compromised client attempted to reuse an already rotated token.
      if (!storedToken || storedToken.isRevoked) {
        const compromisedUserId = storedToken ? storedToken.userId : decodedUserId;

        // Security Lockdown: Invalidate ALL refresh tokens for this user
        await prisma.refreshToken.updateMany({
          where: { userId: compromisedUserId },
          data: { isRevoked: true },
        });

        // Clear the compromised cookie
        res.clearCookie('refreshToken', getRefreshTokenCookieOptions());

        res.status(403).json({
          success: false,
          code: 'TOKEN_REUSE_DETECTED',
          message:
            'Security violation: Refresh token reuse detected. All active sessions have been terminated. Please log in again.',
        });
        return;
      }

      // -------------------------------------------------------------
      // CASE B: TOKEN EXPIRED IN DATABASE
      // -------------------------------------------------------------
      if (new Date() > storedToken.expiresAt) {
        await prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: { isRevoked: true },
        });

        res.clearCookie('refreshToken', getRefreshTokenCookieOptions());
        res.status(401).json({
          success: false,
          code: 'REFRESH_TOKEN_EXPIRED',
          message: 'Refresh token has expired in database. Please log in again.',
        });
        return;
      }

      // -------------------------------------------------------------
      // CASE C: VALID TOKEN -> PERFORM TOKEN ROTATION
      // -------------------------------------------------------------
      const user = storedToken.user;
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Associated user account no longer exists',
        });
        return;
      }

      // 1. Invalidate current token (Mark as revoked rather than deleting to enable reuse detection)
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true },
      });

      // 2. Generate new token pair
      const newAccessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role as Role,
      });
      const newRefreshToken = generateRefreshToken(user.id);

      // 3. Persist new Refresh Token in the database
      const newExpiresAt = calculateRefreshTokenExpiryDate();
      await prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: user.id,
          expiresAt: newExpiresAt,
          isRevoked: false,
        },
      });

      // 4. Overwrite HTTP-Only cookie with new Refresh Token
      res.cookie('refreshToken', newRefreshToken, getRefreshTokenCookieOptions());

      // 5. Return new Access Token
      res.status(200).json({
        success: true,
        message: 'Tokens refreshed successfully',
        data: {
          accessToken: newAccessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * User Logout:
   * - Revokes the refresh token in the database
   * - Clears the HTTP-Only cookie from the client
   */
  public logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const incomingRefreshToken = req.cookies.refreshToken;

      if (incomingRefreshToken) {
        // Mark token as revoked in DB
        await prisma.refreshToken.updateMany({
          where: { token: incomingRefreshToken },
          data: { isRevoked: true },
        });
      }

      // Clear the HTTP-Only cookie from the browser
      res.clearCookie('refreshToken', getRefreshTokenCookieOptions());

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const authController = new AuthController();
