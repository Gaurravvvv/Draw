/**
 * AudioEngine — Synthesized sound effects using Web Audio API
 *
 * No external audio files needed. All sounds are generated procedurally
 * using oscillators, noise buffers, and gain envelopes.
 */

let audioCtx: AudioContext | null = null;
let isMuted = false;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Master volume (0–1) */
const MASTER_VOLUME = 0.3;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Bloop — A quick rising sine wave.
 * Used for: Avatar editor clicks, button interactions.
 */
export function playBloop(): void {
  if (isMuted) return;
  const ctx = getCtx();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);

  gain.gain.setValueAtTime(MASTER_VOLUME * 0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.15);
}

/**
 * Splash — A filtered noise burst.
 * Used for: Flood Fill tool activation.
 */
export function playSplash(): void {
  if (isMuted) return;
  const ctx = getCtx();
  const now = ctx.currentTime;
  const duration = 0.25;

  // Create noise buffer
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  // Low-pass filter for a "wet" splash sound
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000, now);
  filter.frequency.exponentialRampToValueAtTime(200, now + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(MASTER_VOLUME * 0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + duration);
}

/**
 * Ding — A clear bell-like triangle wave.
 * Used for: User joining the room.
 */
export function playDing(): void {
  if (isMuted) return;
  const ctx = getCtx();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(880, now);

  gain.gain.setValueAtTime(MASTER_VOLUME * 0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.5);
}

/**
 * Pop — A quick downward frequency pop.
 * Used for: Undo/Redo actions.
 */
export function playPop(): void {
  if (isMuted) return;
  const ctx = getCtx();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);

  gain.gain.setValueAtTime(MASTER_VOLUME * 0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.12);
}

/**
 * Click — A very subtle, short click.
 * Used for: Tool selection, general button clicks.
 */
export function playClick(): void {
  if (isMuted) return;
  const ctx = getCtx();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(1200, now);

  gain.gain.setValueAtTime(MASTER_VOLUME * 0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.03);
}

/**
 * Success — A two-note rising chime.
 * Used for: Export complete, copy room ID.
 */
export function playSuccess(): void {
  if (isMuted) return;
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Note 1
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(523, now); // C5
  gain1.gain.setValueAtTime(MASTER_VOLUME * 0.3, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.2);

  // Note 2
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(659, now + 0.1); // E5
  gain2.gain.setValueAtTime(0.001, now);
  gain2.gain.setValueAtTime(MASTER_VOLUME * 0.3, now + 0.1);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.1);
  osc2.stop(now + 0.35);
}

// ─── Mute Toggle ──────────────────────────────────────────────────────────────

export function toggleMute(): boolean {
  isMuted = !isMuted;
  return isMuted;
}

export function getMuted(): boolean {
  return isMuted;
}
