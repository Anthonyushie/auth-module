import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

interface EnvConfig {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  CLIENT_URL: string;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  ACCESS_TOKEN_EXPIRY: string;
  REFRESH_TOKEN_EXPIRY: string;
  REFRESH_TOKEN_COOKIE_MAX_AGE: number;
  BCRYPT_SALT_ROUNDS: number;
}

const getEnvOrThrow = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Environment configuration error: Missing required variable [${key}]`);
  }
  return value;
};

export const env: EnvConfig = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development',
  CLIENT_URL: (process.env.CLIENT_URL || 'http://localhost:3000').trim().replace(/\/+$/, ''),
  DATABASE_URL: getEnvOrThrow('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/auth_db?schema=public'),
  JWT_ACCESS_SECRET: getEnvOrThrow('JWT_ACCESS_SECRET', 'default-dev-access-secret-replace-in-prod'),
  JWT_REFRESH_SECRET: getEnvOrThrow('JWT_REFRESH_SECRET', 'default-dev-refresh-secret-replace-in-prod'),
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  // 7 days in milliseconds: 7 * 24 * 60 * 60 * 1000 = 604,800,000 ms
  REFRESH_TOKEN_COOKIE_MAX_AGE: parseInt(process.env.REFRESH_TOKEN_COOKIE_MAX_AGE || '604800000', 10),
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
};
