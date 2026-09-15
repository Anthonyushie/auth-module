import { Router } from 'express';
import { articleController } from '../controllers/article.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// GET /api/articles — titles/metadata only (auth required, full paywall on body)
router.get('/', requireAuth, articleController.list);

// GET /api/articles/:idOrSlug — full body gated (402 without sub)
router.get('/:idOrSlug', requireAuth, articleController.detail);

// POST /api/articles — admin only
router.post('/', requireAuth, requireRole(['admin']), articleController.create);

// PUT /api/articles/:id — admin only
router.put('/:id', requireAuth, requireRole(['admin']), articleController.update);

// DELETE /api/articles/:id — admin only
router.delete('/:id', requireAuth, requireRole(['admin']), articleController.remove);

export default router;
