import { prisma } from './prisma';

/**
 * Subscription access check (single-tier model).
 * A user has access when they hold an Active subscription
 * whose current period has not ended. Admins bypass via role check at call sites.
 */
export const hasActiveSubscription = async (userId: string): Promise<boolean> => {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return false;
  if (sub.status !== 'Active') return false;
  if (sub.currentPeriodEnd && sub.currentPeriodEnd <= new Date()) return false;
  return true;
};

/**
 * Marks a subscription Active for one period (1 month from now).
 * Used by both the verify endpoint and the webhook handler after
 * a successful Flutterwave charge verification.
 */
export const activateSubscription = async (
  txRef: string,
  flwSubscriptionId?: number
) => {
  const currentPeriodEnd = new Date();
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

  return prisma.subscription.update({
    where: { txRef },
    data: {
      status: 'Active',
      currentPeriodEnd,
      ...(flwSubscriptionId !== undefined && { flwSubscriptionId }),
    },
  });
};
