import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

interface EnvConfig {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  CLIENT_URL: string;
  FRONTEND_URL: string;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  ACCESS_TOKEN_EXPIRY: string;
  REFRESH_TOKEN_EXPIRY: string;
  REFRESH_TOKEN_COOKIE_MAX_AGE: number;
  BCRYPT_SALT_ROUNDS: number;
  FLW_PUBLIC_KEY: string;
  FLW_SECRET_KEY: string;
  FLW_ENCRYPTION_KEY: string;
  FLW_PAYMENT_PLAN_ID: string;
  FLW_WEBHOOK_SECRET_HASH: string;
  SUBSCRIPTION_AMOUNT: number;
  SUBSCRIPTION_CURRENCY: string;
}

const getEnvOrThrow = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error('Environment configuration error: Missing required variable [' + key + ']');
  }
  return value;
};

const getEnvOptional = (key: string, defaultValue: string = ''): string => {
  return process.env[key] || defaultValue;
};

export const env: EnvConfig = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development',
  CLIENT_URL: (process.env.CLIENT_URL || 'http://localhost:3000').trim().replace(/\/+$/, ''),
  FRONTEND_URL: (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000').trim().replace(/\/+$/, ''),
  DATABASE_URL: getEnvOrThrow('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/auth_db?schema=public'),
  JWT_ACCESS_SECRET: getEnvOrThrow('JWT_ACCESS_SECRET', 'default-dev-access-secret-replace-in-prod'),
  JWT_REFRESH_SECRET: getEnvOrThrow('JWT_REFRESH_SECRET', 'default-dev-refresh-secret-replace-in-prod'),
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  REFRESH_TOKEN_COOKIE_MAX_AGE: parseInt(process.env.REFRESH_TOKEN_COOKIE_MAX_AGE || '604800000', 10),
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  FLW_PUBLIC_KEY: getEnvOptional('FLW_PUBLIC_KEY'),
  FLW_SECRET_KEY: getEnvOptional('FLW_SECRET_KEY'),
  FLW_ENCRYPTION_KEY: getEnvOptional('FLW_ENCRYPTION_KEY'),
  FLW_PAYMENT_PLAN_ID: getEnvOptional('FLW_PAYMENT_PLAN_ID'),
  FLW_WEBHOOK_SECRET_HASH: getEnvOptional('FLW_WEBHOOK_SECRET_HASH'),
  SUBSCRIPTION_AMOUNT: parseInt(process.env.SUBSCRIPTION_AMOUNT || '5000', 10),
  SUBSCRIPTION_CURRENCY: process.env.SUBSCRIPTION_CURRENCY || 'NGN',
};
