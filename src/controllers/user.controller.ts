import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';

export class UserController {
  /**
   * Get all users (Admin only)
   * Omits password hashes from the response.
   */
  public getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.status(200).json({
        success: true,
        message: 'Users retrieved successfully',
        data: users,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update a user's role (Admin only)
   */
  public updateUserRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!['admin', 'user'].includes(role)) {
        res.status(400).json({
          success: false,
          message: 'Invalid role provided. Must be "admin" or "user".',
        });
        return;
      }

      // Prevent admin from demoting themselves to avoid accidental lockout
      // req.user should be populated by requireAuth middleware
      if (req.user && req.user.userId === id && role !== 'admin') {
         res.status(400).json({
          success: false,
          message: 'You cannot demote your own admin account.',
        });
        return;
      }

      const user = await prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          email: true,
          role: true,
        },
      });

      res.status(200).json({
        success: true,
        message: `User role updated to ${role} successfully`,
        data: user,
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
         res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }
      next(error);
    }
  };

  /**
   * Delete a user (Admin only)
   */
  public deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      // Prevent admin from deleting themselves
      if (req.user && req.user.userId === id) {
         res.status(400).json({
          success: false,
          message: 'You cannot delete your own admin account.',
        });
        return;
      }

      await prisma.user.delete({
        where: { id },
      });

      res.status(200).json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
         res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }
      next(error);
    }
  };
}

export const userController = new UserController();
