import { z } from 'zod';
import { logger } from '../utils/logger';

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('localhost'),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default('gpt-4-turbo-preview'),
  OPENAI_MAX_TOKENS: z.string().transform(Number).default('2000'),

  // Google Vision (optional for now)
  GOOGLE_VISION_API_KEY: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  // Email (optional for now)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().email().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // File Upload
  MAX_FILE_SIZE: z.string().transform(Number).default('10485760'),
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/gif,application/pdf'),

  // Redis (optional for now)
  REDIS_URL: z.string().optional(),
  REDIS_TTL: z.string().transform(Number).default('3600'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  LOG_DIR: z.string().default('logs'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  CORS_CREDENTIALS: z.string().transform(val => val === 'true').default('true'),

  // API Keys
  API_KEY_SALT: z.string().min(16).optional(),

  // Webhooks
  WEBHOOK_SECRET: z.string().min(16).optional(),

  // Monitoring (optional)
  SENTRY_DSN: z.string().optional(),
  NEW_RELIC_LICENSE_KEY: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const validateEnv = (): EnvConfig => {
  try {
    const validated = envSchema.parse(process.env);
    logger.info('Environment variables validated successfully');
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(e => e.path.join('.')).join(', ');
      logger.error(`Environment validation failed. Missing or invalid variables: ${missingVars}`);
      logger.error('Error details:', error.errors);
      
      // In development, log the errors but continue
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Running in development mode with invalid environment variables');
        return process.env as any;
      }
      
      process.exit(1);
    }
    throw error;
  }
};

// Export a typed config object
export const config = validateEnv();