import { Router } from 'express';
import { taskController } from '../controllers/task.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// All task routes require authentication
router.use(requireAuth);

/**
 * @route   GET /api/tasks
 * @desc    Fetch all tasks for the authenticated user
 * @access  Protected
 */
router.get('/', taskController.getTasks);

/**
 * @route   POST /api/tasks
 * @desc    Create a new task for the authenticated user
 * @access  Protected
 */
router.post('/', taskController.createTask);

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update a task's title or completion status (ownership verified)
 * @access  Protected
 */
router.put('/:id', taskController.updateTask);

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task (ownership verified)
 * @access  Protected
 */
router.delete('/:id', taskController.deleteTask);

export default router;
