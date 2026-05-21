import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface LoginResult {
  token: string;
  expiresIn: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'admin';
  iat?: number;
  exp?: number;
}

const TOKEN_EXPIRES_IN = '8h';

/**
 * Attempt to log in with email + password.
 * Uses a single hardcoded admin account sourced from environment variables.
 * The ADMIN_PASSWORD env var should be the plaintext password; bcrypt comparison
 * handles both plain and pre-hashed values correctly because bcrypt.compare
 * accepts a plaintext candidate against a stored hash. For development
 * convenience the password is compared directly against the env value when it
 * does not look like a bcrypt hash (does not start with "$2").
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  if (email.toLowerCase() !== config.adminEmail.toLowerCase()) {
    throw new Error('Invalid credentials');
  }

  const storedPassword = config.adminPassword;

  let passwordValid: boolean;

  if (storedPassword.startsWith('$2')) {
    // Stored value is already a bcrypt hash
    passwordValid = await bcrypt.compare(password, storedPassword);
  } else {
    // Stored value is plaintext (development only) — compare directly
    passwordValid = password === storedPassword;
  }

  if (!passwordValid) {
    throw new Error('Invalid credentials');
  }

  const payload: JwtPayload = {
    sub: 'admin',
    email: config.adminEmail,
    role: 'admin',
  };

  const token = jwt.sign(payload, config.jwtSecret, {
    expiresIn: TOKEN_EXPIRES_IN,
  });

  return { token, expiresIn: TOKEN_EXPIRES_IN };
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwtSecret);
  return decoded as JwtPayload;
}

/**
 * Utility to generate a bcrypt hash of a password.
 * Useful for seeding ADMIN_PASSWORD in production.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 12);
}
