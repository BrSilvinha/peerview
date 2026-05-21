import { Redis } from 'ioredis';
import { config } from '../config';

export interface SessionData {
  status: 'waiting' | 'active' | 'ended';
  createdAt: string;
  hostSocketId: string | null;
}

function sessionKey(token: string): string {
  return `session:${token}`;
}

export async function createSession(redis: Redis, token: string): Promise<SessionData> {
  const session: SessionData = {
    status: 'waiting',
    createdAt: new Date().toISOString(),
    hostSocketId: null,
  };

  await redis.set(
    sessionKey(token),
    JSON.stringify(session),
    'EX',
    config.sessionTtlSeconds,
  );

  return session;
}

export async function getSession(redis: Redis, token: string): Promise<SessionData | null> {
  const raw = await redis.get(sessionKey(token));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export async function updateSession(
  redis: Redis,
  token: string,
  data: Partial<SessionData>,
): Promise<SessionData | null> {
  const existing = await getSession(redis, token);
  if (!existing) return null;

  const updated: SessionData = { ...existing, ...data };

  // Preserve remaining TTL so an update doesn't reset the clock
  const ttl = await redis.ttl(sessionKey(token));
  const remainingTtl = ttl > 0 ? ttl : config.sessionTtlSeconds;

  await redis.set(
    sessionKey(token),
    JSON.stringify(updated),
    'EX',
    remainingTtl,
  );

  return updated;
}

export async function deleteSession(redis: Redis, token: string): Promise<void> {
  await redis.del(sessionKey(token));
}
