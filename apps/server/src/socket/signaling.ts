import { Server as SocketIOServer, Socket } from 'socket.io';
import { Redis } from 'ioredis';
import { getSession, updateSession, deleteSession } from '../services/sessionService';

// ---------------------------------------------------------------------------
// Types for event payloads
// ---------------------------------------------------------------------------

interface SdpInit {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

interface IceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

interface JoinHostPayload {
  token: string;
}

interface JoinClientPayload {
  token: string;
}

interface OfferPayload {
  token: string;
  sdp: SdpInit;
}

interface AnswerPayload {
  token: string;
  sdp: SdpInit;
}

interface IceCandidatePayload {
  token: string;
  candidate: IceCandidateInit;
}

interface SessionEndPayload {
  token: string;
}

// ---------------------------------------------------------------------------
// Room name helpers
// ---------------------------------------------------------------------------

const hostRoom = (token: string) => `host:${token}`;
const clientRoom = (token: string) => `client:${token}`;

// ---------------------------------------------------------------------------
// Main signaling setup
// ---------------------------------------------------------------------------

export function setupSignaling(io: SocketIOServer, redis: Redis): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[signaling] socket connected: ${socket.id}`);

    // ------------------------------------------------------------------
    // join-host: Host connects and takes ownership of a session
    // ------------------------------------------------------------------
    socket.on('join-host', async (payload: JoinHostPayload) => {
      const { token } = payload;

      if (!token) {
        socket.emit('error', { message: 'token is required' });
        return;
      }

      const session = await getSession(redis, token);
      if (!session) {
        socket.emit('error', { message: 'Session not found or expired' });
        return;
      }

      // Join the host room for this token
      await socket.join(hostRoom(token));

      // Record the host socket ID in Redis
      await updateSession(redis, token, {
        hostSocketId: socket.id,
        status: 'waiting',
      });

      socket.emit('host-joined', { token, status: 'waiting' });
      console.log(`[signaling] host ${socket.id} joined session ${token}`);
    });

    // ------------------------------------------------------------------
    // join-client: Viewer connects to an existing session
    // ------------------------------------------------------------------
    socket.on('join-client', async (payload: JoinClientPayload) => {
      const { token } = payload;

      if (!token) {
        socket.emit('error', { message: 'token is required' });
        return;
      }

      const session = await getSession(redis, token);
      if (!session) {
        socket.emit('error', { message: 'Session not found or expired' });
        return;
      }

      if (session.status === 'ended') {
        socket.emit('error', { message: 'Session has ended' });
        return;
      }

      // Join the client room for this token
      await socket.join(clientRoom(token));

      // Update session status to active
      await updateSession(redis, token, { status: 'active' });

      // Notify the client that it joined successfully
      socket.emit('client-joined', { token, status: 'active' });

      // Notify the host that a viewer connected
      io.to(hostRoom(token)).emit('client-connected', {
        token,
        clientSocketId: socket.id,
      });

      console.log(`[signaling] client ${socket.id} joined session ${token}`);
    });

    // ------------------------------------------------------------------
    // offer: Host sends WebRTC offer SDP to client
    // ------------------------------------------------------------------
    socket.on('offer', (payload: OfferPayload) => {
      const { token, sdp } = payload;
      console.log(`[signaling] offer from ${socket.id} for session ${token}`);

      // Relay to all sockets in the client room
      socket.to(clientRoom(token)).emit('offer', { sdp, token });
    });

    // ------------------------------------------------------------------
    // answer: Client sends WebRTC answer SDP back to host
    // ------------------------------------------------------------------
    socket.on('answer', (payload: AnswerPayload) => {
      const { token, sdp } = payload;
      console.log(`[signaling] answer from ${socket.id} for session ${token}`);

      // Relay to the host room
      socket.to(hostRoom(token)).emit('answer', { sdp, token });
    });

    // ------------------------------------------------------------------
    // ice-candidate: Both sides exchange ICE candidates
    // ------------------------------------------------------------------
    socket.on('ice-candidate', (payload: IceCandidatePayload) => {
      const { token, candidate } = payload;

      // Determine which rooms this socket is in to route correctly
      const rooms = Array.from(socket.rooms);
      const isHost = rooms.includes(hostRoom(token));

      if (isHost) {
        // Host is sending a candidate → forward to client
        socket.to(clientRoom(token)).emit('ice-candidate', { candidate, token });
      } else {
        // Client is sending a candidate → forward to host
        socket.to(hostRoom(token)).emit('ice-candidate', { candidate, token });
      }
    });

    // ------------------------------------------------------------------
    // session-end: Either party explicitly ends the session
    // ------------------------------------------------------------------
    socket.on('session-end', async (payload: SessionEndPayload) => {
      const { token } = payload;
      console.log(`[signaling] session-end for ${token} from ${socket.id}`);

      await deleteSession(redis, token);

      // Notify both rooms
      io.to(hostRoom(token)).emit('session-ended', { token });
      io.to(clientRoom(token)).emit('session-ended', { token });

      // Make all sockets in both rooms leave
      const hostSockets = await io.in(hostRoom(token)).fetchSockets();
      const clientSockets = await io.in(clientRoom(token)).fetchSockets();

      for (const s of [...hostSockets, ...clientSockets]) {
        s.leave(hostRoom(token));
        s.leave(clientRoom(token));
      }
    });

    // ------------------------------------------------------------------
    // disconnect: Clean up when a socket drops
    // ------------------------------------------------------------------
    socket.on('disconnect', async (reason: string) => {
      console.log(`[signaling] socket disconnected: ${socket.id} (${reason})`);

      // Inspect all rooms the socket was in to find any session token
      const rooms = Array.from(socket.rooms);

      for (const room of rooms) {
        if (room.startsWith('host:')) {
          const token = room.slice(5); // strip "host:"

          const session = await getSession(redis, token);
          if (!session) continue;

          // Mark session as ended when the host drops
          await updateSession(redis, token, { status: 'ended', hostSocketId: null });

          // Notify any connected clients
          io.to(clientRoom(token)).emit('host-disconnected', {
            token,
            reason: 'Host disconnected unexpectedly',
          });
        } else if (room.startsWith('client:')) {
          const token = room.slice(7); // strip "client:"

          const session = await getSession(redis, token);
          if (!session) continue;

          // If session was active, revert to waiting
          if (session.status === 'active') {
            await updateSession(redis, token, { status: 'waiting' });
          }

          // Notify the host
          io.to(hostRoom(token)).emit('client-disconnected', {
            token,
            clientSocketId: socket.id,
            reason,
          });
        }
      }
    });
  });
}
