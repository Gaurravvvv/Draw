/**
 * Server-side timer — authoritative countdown that cannot be manipulated by clients.
 * Emits tick events every second to all players in a room.
 */

import { Server } from 'socket.io';

export interface GameTimer {
  remaining: number;
  intervalId: NodeJS.Timeout | null;
  stop: () => void;
}

/**
 * Start a countdown timer that emits 'timer-tick' every second.
 * Returns a GameTimer object with a stop() method.
 */
export function startTimer(
  io: Server,
  roomCode: string,
  durationSeconds: number,
  onTick?: (remaining: number) => void,
  onComplete?: () => void,
): GameTimer {
  const timer: GameTimer = {
    remaining: durationSeconds,
    intervalId: null,
    stop: () => {
      if (timer.intervalId) {
        clearInterval(timer.intervalId);
        timer.intervalId = null;
      }
    },
  };

  // Emit initial tick
  io.to(`game:${roomCode}`).emit('timer-tick', { remaining: timer.remaining });
  onTick?.(timer.remaining);

  timer.intervalId = setInterval(() => {
    timer.remaining--;

    io.to(`game:${roomCode}`).emit('timer-tick', { remaining: timer.remaining });
    onTick?.(timer.remaining);

    if (timer.remaining <= 0) {
      timer.stop();
      onComplete?.();
    }
  }, 1000);

  return timer;
}

/**
 * Run a short countdown (e.g., 3...2...1) with a specific event name.
 */
export function startCountdown(
  io: Server,
  roomCode: string,
  count: number,
  eventName: string,
): Promise<void> {
  return new Promise((resolve) => {
    let remaining = count;

    const emit = () => {
      io.to(`game:${roomCode}`).emit(eventName, { count: remaining });
      remaining--;

      if (remaining < 0) {
        resolve();
      } else {
        setTimeout(emit, 1000);
      }
    };

    emit();
  });
}
