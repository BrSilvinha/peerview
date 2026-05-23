import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';

import { config } from './config';
import authRouter from './routes/auth';
import { createSessionsRouter } from './routes/sessions';
import { setupSignaling } from './socket/signaling';

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

app.use(
  cors({
    origin: config.frontendUrl,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Redis
// ---------------------------------------------------------------------------

const redis = new Redis(config.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => console.log('[redis] connected'));
redis.on('error', (err: Error) => console.error('[redis] error:', err.message));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use('/api/auth', authRouter);
app.use('/api/sessions', createSessionsRouter(redis));

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---------------------------------------------------------------------------
// HTTP server + Socket.IO
// ---------------------------------------------------------------------------

const httpServer = http.createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    // Allow the frontend and Chrome/Firefox extensions (which connect from
    // chrome-extension:// origins that don't match the frontend URL).
    origin: (origin, callback) => {
      if (
        !origin ||
        origin === config.frontendUrl ||
        /^chrome-extension:\/\//.test(origin) ||
        /^moz-extension:\/\//.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed`));
      }
    },
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

setupSignaling(io, redis);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function start(): Promise<void> {
  try {
    await redis.connect();
    console.log('[redis] connection established');
  } catch (err) {
    console.error('[redis] failed to connect:', err);
    process.exit(1);
  }

  httpServer.listen(config.port, () => {
    console.log(`[server] PeerView backend listening on port ${config.port}`);
    console.log(`[server] Frontend origin: ${config.frontendUrl}`);
  });
}

start();
