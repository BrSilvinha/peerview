import { Router, Request, Response } from 'express';
import { login } from '../services/authService';

const router = Router();

/**
 * POST /api/auth/login
 * Body: { email: string, password: string }
 * Returns: { token: string, expiresIn: string }
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'email is required' });
    return;
  }

  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'password is required' });
    return;
  }

  try {
    const result = await login(email, password);
    res.json(result);
  } catch (err) {
    // Use generic message to avoid leaking whether the email exists
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

export default router;
