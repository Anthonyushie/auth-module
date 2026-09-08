import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';

export class TaskController {
  /**
   * GET /api/tasks
   * Fetch all tasks belonging to the authenticated user.
   */
  public getTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;

      const tasks = await prisma.task.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          completed: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.status(200).json({
        success: true,
        message: 'Tasks retrieved successfully',
        data: tasks,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/tasks
   * Create a new task linked to the authenticated user.
   */
  public createTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { title } = req.body;

      // Validate required field
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Task title is required and must be a non-empty string',
        });
        return;
      }

      const task = await prisma.task.create({
        data: {
          title: title.trim(),
          userId,
        },
        select: {
          id: true,
          title: true,
          completed: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Task created successfully',
        data: task,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/tasks/:id
   * Update a task's title or completion status.
   * Ownership is verified before any mutation.
   */
  public updateTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const { title, completed } = req.body;

      // 1. Verify the task exists AND belongs to the authenticated user
      const existingTask = await prisma.task.findUnique({ where: { id } });

      if (!existingTask || existingTask.userId !== userId) {
        res.status(404).json({
          success: false,
          message: 'Task not found',
        });
        return;
      }

      // 2. Build the update payload (only include fields that were provided)
      const updateData: { title?: string; completed?: boolean } = {};

      if (title !== undefined) {
        if (typeof title !== 'string' || title.trim().length === 0) {
          res.status(400).json({
            success: false,
            message: 'Task title must be a non-empty string',
          });
          return;
        }
        updateData.title = title.trim();
      }

      if (completed !== undefined) {
        if (typeof completed !== 'boolean') {
          res.status(400).json({
            success: false,
            message: 'Completed must be a boolean value',
          });
          return;
        }
        updateData.completed = completed;
      }

      // 3. Ensure at least one field is being updated
      if (Object.keys(updateData).length === 0) {
        res.status(400).json({
          success: false,
          message: 'At least one field (title or completed) must be provided for update',
        });
        return;
      }

      // 4. Perform the update
      const updatedTask = await prisma.task.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          title: true,
          completed: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.status(200).json({
        success: true,
        message: 'Task updated successfully',
        data: updatedTask,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/tasks/:id
   * Delete a task. Ownership is verified before deletion.
   */
  public deleteTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      // 1. Verify the task exists AND belongs to the authenticated user
      const existingTask = await prisma.task.findUnique({ where: { id } });

      if (!existingTask || existingTask.userId !== userId) {
        res.status(404).json({
          success: false,
          message: 'Task not found',
        });
        return;
      }

      // 2. Delete the task
      await prisma.task.delete({ where: { id } });

      res.status(200).json({
        success: true,
        message: 'Task deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const taskController = new TaskController();
