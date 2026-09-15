import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// POST /api/payments/checkout — authenticated user starts subscription
router.post('/checkout', requireAuth, paymentController.checkout);

// GET /api/payments/verify — callback verification (authenticated)
router.get('/verify', requireAuth, paymentController.verify);

// POST /api/payments/webhook — public (verif-hash header check inside controller)
router.post('/webhook', paymentController.webhook);

// GET /api/payments/status — access snapshot
router.get('/status', requireAuth, paymentController.status);

export default router;
