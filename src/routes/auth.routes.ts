import { Router, Request, Response } from 'express';
import { authController } from '../controllers/auth.controller';
import { userController } from '../controllers/user.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// ==========================================
// Public Authentication Endpoints
// ==========================================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & issue Access Token + HTTP-Only Refresh Token Cookie
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Rotate Refresh Token & issue new Access Token + new Refresh Token Cookie
 * @access  Public (Requires Refresh Token Cookie)
 */
router.post('/refresh', authController.refresh);

/**
 * @route   POST /api/auth/logout
 * @desc    Revoke current refresh token and clear cookie
 * @access  Public
 */
router.post('/logout', authController.logout);

// ==========================================
// Protected Routes (Authentication & RBAC)
// ==========================================

/**
 * @route   GET /api/auth/profile
 * @desc    Get currently authenticated user's profile info
 * @access  Protected (Requires valid Access Token)
 */
router.get('/profile', requireAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'User profile retrieved successfully',
    data: {
      user: req.user,
    },
  });
});

/**
 * @route   GET /api/auth/admin-dashboard
 * @desc    Admin-only dashboard endpoint demonstrating RBAC
 * @access  Protected (Requires valid Access Token AND 'admin' role)
 */
router.get('/admin-dashboard', requireAuth, requireRole(['admin']), (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Admin Dashboard!',
    data: {
      adminUser: req.user,
      metrics: {
        systemStatus: 'healthy',
        activeSecurityProtocols: ['JWT_ACCESS_15M', 'REFRESH_ROTATION', 'REUSE_DETECTION', 'RBAC'],
      },
    },
  });
});

// ==========================================
// Admin User Management Routes
// ==========================================

/**
 * @route   GET /api/auth/users
 * @desc    Get all users
 * @access  Protected (Admin only)
 */
router.get('/users', requireAuth, requireRole(['admin']), userController.getAllUsers);

/**
 * @route   PUT /api/auth/users/:id/role
 * @desc    Update a user's role
 * @access  Protected (Admin only)
 */
router.put('/users/:id/role', requireAuth, requireRole(['admin']), userController.updateUserRole);

/**
 * @route   DELETE /api/auth/users/:id
 * @desc    Delete a user
 * @access  Protected (Admin only)
 */
router.delete('/users/:id', requireAuth, requireRole(['admin']), userController.deleteUser);

export default router;
