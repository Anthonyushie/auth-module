import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { hasActiveSubscription } from '../utils/subscription.utils';

const SUBSCRIBE_URL = '/api/payments/checkout';

const slugify = (title: string): string => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
};

const generateUniqueSlug = async (title: string): Promise<string> => {
  const base = slugify(title) || 'article';
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 8);
    const slug = `${base}-${suffix}`;
    const existing = await prisma.article.findUnique({ where: { slug } });
    if (!existing) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
};

const toListItem = (a: any, hasAccess: boolean) => ({
  id: a.id,
  title: a.title,
  slug: a.slug,
  coverImageUrl: a.coverImageUrl,
  authorEmail: a.author?.email,
  createdAt: a.createdAt,
  hasAccess,
});

export class ArticleController {
  /**
   * GET /api/articles — titles/metadata only, body never sent.
   * ?status=published (default) | draft (admin only) | all (admin only)
   */
  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const isAdmin = req.user!.role === 'admin';
      const statusParam = String(req.query.status || 'published').toLowerCase();

      let where: any = { status: 'Published' };
      if (statusParam === 'draft') {
        if (!isAdmin) {
          res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Drafts are visible to admins only' });
          return;
        }
        where = { status: 'Draft' };
      } else if (statusParam === 'all') {
        if (!isAdmin) {
          res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'All-articles view is admin only' });
          return;
        }
        where = {};
      }

      const articles = await prisma.article.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          coverImageUrl: true,
          createdAt: true,
          author: { select: { email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const hasAccess = isAdmin ? true : await hasActiveSubscription(userId);

      res.status(200).json({
        success: true,
        message: 'Articles retrieved successfully',
        data: articles.map((a) => toListItem(a, hasAccess)),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/articles/:idOrSlug — full body only with active sub or admin.
   * Else 402 + subscribeUrl. Body never leaks without access.
   */
  public detail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const isAdmin = req.user!.role === 'admin';
      const { idOrSlug } = req.params;

      const article = await prisma.article.findFirst({
        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
        include: { author: { select: { email: true } } },
      });

      if (!article) {
        res.status(404).json({ success: false, message: 'Article not found' });
        return;
      }

      if (article.status !== 'Published' && !isAdmin) {
        res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'This article is not published' });
        return;
      }

      const hasAccess = isAdmin ? true : await hasActiveSubscription(userId);
      if (!hasAccess) {
        res.status(402).json({
          success: false,
          code: 'PAYMENT_REQUIRED',
          message: 'Active subscription required to read this article',
          subscribeUrl: SUBSCRIBE_URL,
          data: {
            id: article.id,
            title: article.title,
            slug: article.slug,
            coverImageUrl: article.coverImageUrl,
            authorEmail: (article as any).author?.email,
            createdAt: article.createdAt,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Article retrieved successfully',
        data: {
          id: article.id,
          title: article.title,
          slug: article.slug,
          body: article.body,
          coverImageUrl: article.coverImageUrl,
          status: article.status,
          authorEmail: (article as any).author?.email,
          createdAt: article.createdAt,
          updatedAt: article.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/articles — admin only. title>=3, body>=50.
   */
  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { title, body, coverImageUrl, status } = req.body;

      if (!title || String(title).trim().length < 3) {
        res.status(400).json({ success: false, message: 'Title must be at least 3 characters long' });
        return;
      }
      if (!body || String(body).trim().length < 50) {
        res.status(400).json({ success: false, message: 'Body must be at least 50 characters long' });
        return;
      }
      if (status && !['Draft', 'Published'].includes(status)) {
        res.status(400).json({ success: false, message: 'Status must be Draft or Published' });
        return;
      }

      const slug = await generateUniqueSlug(String(title));

      const article = await prisma.article.create({
        data: {
          title: String(title).trim(),
          slug,
          body: String(body),
          coverImageUrl: coverImageUrl || null,
          status: status || 'Draft',
          authorId: req.user!.userId,
        },
      });

      res.status(201).json({ success: true, message: 'Article created successfully', data: article });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/articles/:id — admin only.
   */
  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { title, body, coverImageUrl, status } = req.body;

      const data: any = {};
      if (title !== undefined) {
        if (String(title).trim().length < 3) {
          res.status(400).json({ success: false, message: 'Title must be at least 3 characters long' });
          return;
        }
        data.title = String(title).trim();
      }
      if (body !== undefined) {
        if (String(body).trim().length < 50) {
          res.status(400).json({ success: false, message: 'Body must be at least 50 characters long' });
          return;
        }
        data.body = String(body);
      }
      if (coverImageUrl !== undefined) data.coverImageUrl = coverImageUrl || null;
      if (status !== undefined) {
        if (!['Draft', 'Published'].includes(status)) {
          res.status(400).json({ success: false, message: 'Status must be Draft or Published' });
          return;
        }
        data.status = status;
      }

      const article = await prisma.article.update({ where: { id }, data });
      res.status(200).json({ success: true, message: 'Article updated successfully', data: article });
    } catch (error: any) {
      if (error.code === 'P2025') {
        res.status(404).json({ success: false, message: 'Article not found' });
        return;
      }
      next(error);
    }
  };

  /**
   * DELETE /api/articles/:id — admin only.
   */
  public remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await prisma.article.delete({ where: { id } });
      res.status(200).json({ success: true, message: 'Article deleted successfully' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        res.status(404).json({ success: false, message: 'Article not found' });
        return;
      }
      next(error);
    }
  };
}

export const articleController = new ArticleController();
