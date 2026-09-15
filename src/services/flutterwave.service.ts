import axios from 'axios';
import { env } from '../config/env.config';

const FLW_BASE_URL = 'https://api.flutterwave.com/v3';

export interface CreateSubscriptionLinkParams {
  email: string;
  txRef: string;
}

export interface FlwVerifyResult {
  status: string;
  amount: number;
  currency: string;
  txRef: string;
  flwTxId: number | string;
  flwSubscriptionId?: number;
  customerEmail?: string;
  raw: any;
}

const authHeaders = () => ({
  Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
  'Content-Type': 'application/json',
});

/**
 * Flutterwave service (axios direct, no SDK).
 * Test mode is controlled by which keys are in env (test keys).
 */
export const flutterwaveService = {
  /**
   * Create a Standard payment link tied to the Dashboard Payment Plan.
   * Recurring billing is driven by `payment_plan` (plan 243392 / Monthly).
   */
  createSubscriptionLink: async ({ email, txRef }: CreateSubscriptionLinkParams): Promise<string> => {
    if (!env.FLW_SECRET_KEY) {
      throw new Error('Flutterwave misconfigured: FLW_SECRET_KEY is missing');
    }
    if (!env.FLW_PAYMENT_PLAN_ID) {
      throw new Error('Flutterwave misconfigured: FLW_PAYMENT_PLAN_ID is missing');
    }

    const payload = {
      tx_ref: txRef,
      amount: env.SUBSCRIPTION_AMOUNT,
      currency: env.SUBSCRIPTION_CURRENCY,
      redirect_url: `${env.FRONTEND_URL}/subscribe/callback`,
      customer: { email },
      payment_plan: Number(env.FLW_PAYMENT_PLAN_ID),
    };

    const { data } = await axios.post(`${FLW_BASE_URL}/payments`, payload, {
      headers: authHeaders(),
      timeout: 20000,
    });

    const link = data?.data?.link;
    if (!link) {
      throw new Error('Flutterwave did not return a payment link');
    }
    return link as string;
  },

  /**
   * Server-side verification: GET /v3/transactions/:id/verify
   * Never trust webhook/callback query params alone.
   */
  verifyTransaction: async (transactionId: string | number): Promise<FlwVerifyResult> => {
    if (!env.FLW_SECRET_KEY) {
      throw new Error('Flutterwave misconfigured: FLW_SECRET_KEY is missing');
    }

    const { data } = await axios.get(`${FLW_BASE_URL}/transactions/${transactionId}/verify`, {
      headers: authHeaders(),
      timeout: 20000,
    });

    const tx = data?.data;
    if (!tx) {
      throw new Error('Flutterwave verification returned no transaction data');
    }

    return {
      status: tx.status,
      amount: Number(tx.amount),
      currency: tx.currency,
      txRef: tx.tx_ref,
      flwTxId: tx.id,
      flwSubscriptionId: tx.subscription?.id ?? tx.payment_plan ?? undefined,
      customerEmail: tx.customer?.email,
      raw: data,
    };
  },
};
