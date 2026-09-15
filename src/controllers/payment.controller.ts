import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { env } from '../config/env.config';
import { flutterwaveService } from '../services/flutterwave.service';
import { hasActiveSubscription, activateSubscription } from '../utils/subscription.utils';

export class PaymentController {
  /**
   * POST /api/payments/checkout — create (or reuse pending) subscription + Flutterwave link.
   */
  public checkout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const email = req.user!.email;

      if (await hasActiveSubscription(userId)) {
        const sub = await prisma.subscription.findUnique({ where: { userId } });
        res.status(200).json({
          success: true,
          alreadySubscribed: true,
          message: 'You already have an active subscription',
          data: { status: sub?.status, currentPeriodEnd: sub?.currentPeriodEnd },
        });
        return;
      }

      const txRef = `sub_${userId}_${Date.now()}`;

      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          txRef,
          status: 'Pending',
          flwPlanId: Number(env.FLW_PAYMENT_PLAN_ID || 243392),
        },
        update: {
          txRef,
          status: 'Pending',
          flwPlanId: Number(env.FLW_PAYMENT_PLAN_ID || 243392),
        },
      });

      await prisma.paymentEvent.create({
        data: { txRef, event: 'checkout.initiated', payload: { userId, email } },
      });

      const paymentLink = await flutterwaveService.createSubscriptionLink({ email, txRef });

      res.status(200).json({
        success: true,
        message: 'Checkout link created',
        data: { paymentLink, txRef },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/payments/verify?transaction_id=...&tx_ref=... — server-side verify + activate.
   */
  public verify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const transactionId = String(req.query.transaction_id || '');
      const txRef = String(req.query.tx_ref || '');

      if (!transactionId || !txRef) {
        res.status(400).json({ success: false, message: 'transaction_id and tx_ref are required' });
        return;
      }

      const sub = await prisma.subscription.findUnique({ where: { userId } });
      if (!sub || sub.txRef !== txRef) {
        res.status(400).json({ success: false, message: 'Transaction reference does not match your subscription' });
        return;
      }

      let result;
      try {
        result = await flutterwaveService.verifyTransaction(transactionId);
      } catch (err: any) {
        await prisma.paymentEvent.create({
          data: { txRef, flwTxId: String(transactionId), event: 'verify.failed', payload: { error: err?.message } },
        });
        res.status(400).json({ success: false, message: 'Payment verification failed with Flutterwave' });
        return;
      }

      await prisma.paymentEvent.create({
        data: { txRef, flwTxId: String(result.flwTxId), event: 'verify.response', payload: result.raw },
      });

      const isSuccess =
        result.status === 'successful' &&
        result.txRef === txRef &&
        Number(result.amount) >= Number(env.SUBSCRIPTION_AMOUNT) &&
        String(result.currency).toUpperCase() === String(env.SUBSCRIPTION_CURRENCY).toUpperCase();

      if (!isSuccess) {
        res.status(400).json({ success: false, message: 'Payment was not successful or amount/currency mismatch' });
        return;
      }

      const updated = await activateSubscription(txRef, result.flwSubscriptionId);

      res.status(200).json({
        success: true,
        message: 'Subscription activated',
        data: { status: updated.status, currentPeriodEnd: updated.currentPeriodEnd },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/payments/webhook — public. verif-hash check, always fast 200.
   */
  public webhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signature = req.headers['verif-hash'];
      if (!env.FLW_WEBHOOK_SECRET_HASH || signature !== env.FLW_WEBHOOK_SECRET_HASH) {
        res.status(401).json({ success: false, message: 'Invalid webhook signature' });
        return;
      }

      const body: any = req.body || {};
      // Flutterwave sends either { event, data } or a flat charge object.
      const eventName: string = body.event || body['event.type'] || 'unknown';
      const txData: any = body.data || body;
      const txRef: string | undefined = txData?.tx_ref || txData?.txRef;
      const flwTxId: string | undefined =
        txData?.id !== undefined ? String(txData.id) : undefined;

      await prisma.paymentEvent.create({
        data: { txRef: txRef || null, flwTxId: flwTxId || null, event: `webhook.${eventName}`, payload: body },
      });

      // Always acknowledge fast to avoid Flutterwave retries.
      res.status(200).json({ success: true });

      // Async post-processing (fire-and-forget after response).
      try {
        if (eventName === 'charge.completed' && flwTxId && txRef) {
          const result = await flutterwaveService.verifyTransaction(flwTxId);
          const isSuccess =
            result.status === 'successful' &&
            result.txRef === txRef &&
            Number(result.amount) >= Number(env.SUBSCRIPTION_AMOUNT) &&
            String(result.currency).toUpperCase() === String(env.SUBSCRIPTION_CURRENCY).toUpperCase();
          if (isSuccess) {
            await activateSubscription(txRef, result.flwSubscriptionId);
          }
        } else if (
          (eventName.includes('cancel') || eventName.includes('fail') || eventName.includes('expire')) &&
          txRef
        ) {
          await prisma.subscription.updateMany({
            where: { txRef },
            data: {
              status: eventName.includes('cancel') ? 'Cancelled' : 'Expired',
            },
          });
        }
      } catch (postErr) {
        console.error('[Payments webhook post-processing failed]:', postErr);
      }
    } catch (error) {
      // Webhooks must still ack fast; log and return 200 unless signature failed above.
      console.error('[Payments webhook error]:', error);
      if (!res.headersSent) {
        res.status(200).json({ success: true });
      } else {
        next(error);
      }
    }
  };

  /**
   * GET /api/payments/status — current user's access snapshot.
   */
  public status = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const isAdmin = req.user!.role === 'admin';
      const sub = await prisma.subscription.findUnique({ where: { userId } });
      const hasAccess = isAdmin ? true : await hasActiveSubscription(userId);

      res.status(200).json({
        success: true,
        data: {
          hasAccess,
          status: isAdmin && !sub ? 'AdminBypass' : sub?.status || 'None',
          currentPeriodEnd: sub?.currentPeriodEnd || null,
          planId: Number(env.FLW_PAYMENT_PLAN_ID || 243392),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const paymentController = new PaymentController();
