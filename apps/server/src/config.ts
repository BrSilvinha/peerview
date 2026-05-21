import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  redisUrl: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  jwtSecret: requireEnv('JWT_SECRET'),
  adminEmail: requireEnv('ADMIN_EMAIL'),
  adminPassword: requireEnv('ADMIN_PASSWORD'),
  frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
  sessionTtlSeconds: 1800, // 30 minutes
} as const;
