import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Redis } from 'ioredis';
import { requireAuth } from '../middleware/auth';
import {
  createSession,
  getSession,
} from '../services/sessionService';
import { config } from '../config';

export function createSessionsRouter(redis: Redis): Router {
  const router = Router();

  /**
   * POST /api/sessions
   * Requires Bearer JWT.
   * Creates a new screen-sharing session and returns a shareable link.
   */
  router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const token = uuidv4();

    const session = await createSession(redis, token);

    const expiresAt = new Date(
      Date.now() + config.sessionTtlSeconds * 1000,
    ).toISOString();

    res.status(201).json({
      token,
      link: `${config.frontendUrl}/session/${token}`,
      expiresAt,
      status: session.status,
    });
  });

  /**
   * GET /api/sessions/:token
   * Public — validates whether a session token is still alive.
   * Returns { valid: true, status } or { valid: false }.
   */
  router.get('/:token', async (req: Request, res: Response): Promise<void> => {
    const { token } = req.params as { token: string };

    if (!token) {
      res.status(400).json({ valid: false, error: 'token is required' });
      return;
    }

    const session = await getSession(redis, token);

    if (!session) {
      res.json({ valid: false });
      return;
    }

    res.json({
      valid: true,
      status: session.status,
      createdAt: session.createdAt,
    });
  });

  return router;
}
