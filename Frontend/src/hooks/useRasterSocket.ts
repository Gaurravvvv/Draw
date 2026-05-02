/**
 * useRasterSocket — Real-time sync for the raster drawing engine
 *
 * Protocol:
 *   stroke-live  → Transient: broadcast in-progress stroke points (rAF updates)
 *   draw-event   → Persistent: broadcast completed stroke command (baked to canvas)
 *   initial-state → On join: receive command log to replay onto local canvas
 *
 * Zero Fabric.js dependencies.
 */

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '../store';
import { RasterBrush } from '../engine/RasterBrush';
import { drawShape, type ShapeKind } from '../engine/RasterShapes';
import type { StrokeCommand, StrokeLiveEvent, PointWithPressure, BrushOptions } from '../engine/types';
import getStroke from 'perfect-freehand';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ─── SVG Path from stroke (duplicated for isolation — shared with RasterBrush) ─

function getSvgPathFromStroke(points: number[][]): string {
  if (points.length === 0) return '';
  const len = points.length;
  if (len < 3) {
    const [x, y] = points[0];
    return `M ${x} ${y} L ${x + 0.01} ${y + 0.01} Z`;
  }
  let d = `M ${points[0][0]} ${points[0][1]} `;
  for (let i = 0; i < len - 1; i++) {
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    d += `Q ${cx} ${cy} ${(cx + nx) / 2} ${(cy + ny) / 2} `;
  }
  d += 'Z';
  return d;
}

// ─── Live stroke tracking (remote users' in-progress strokes) ─────────────────

interface LiveStroke {
  points: PointWithPressure[];
  color: string;
  size: number;
  opacity: number;
  isEraser: boolean;
  isHighlighter: boolean;
}

const liveStrokes = new Map<string, LiveStroke>();

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseRasterSocketOptions {
  roomId: string;
  mainCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  draftCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  logicalW: number;
  logicalH: number;
}

export function useRasterSocket({
  roomId,
  mainCanvasRef,
  draftCanvasRef,
  logicalW,
  logicalH,
}: UseRasterSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const { setIsConnected, showToast, setTexts, addText, updateText, removeText } = useStore();
  const liveRafId = useRef<number | null>(null);
  const liveDirty = useRef(false);

  // ── Replay a single stroke command onto mainCanvas ──────────────────────────

  const replayCommand = useCallback((cmd: StrokeCommand) => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Shape commands
    if (cmd.shape) {
      const s = cmd.shape;
      drawShape(ctx, s.kind as ShapeKind, s.x, s.y, s.w, s.h, cmd.color, cmd.size);
      return;
    }

    // Text commands
    if (cmd.text) {
      const t = cmd.text;
      ctx.save();
      ctx.font = `${t.fontSize}px ${t.fontFamily}`;
      ctx.fillStyle = cmd.color;
      ctx.textBaseline = 'top';
      const lines = t.content.split('\n');
      const lineHeight = t.fontSize * 1.3;
      lines.forEach((line, i) => {
        ctx.fillText(line, t.x, t.y + i * lineHeight);
      });
      ctx.restore();
      return;
    }

    // Stroke commands — unpack flat points → [x, y, pressure][]
    const points: PointWithPressure[] = [];
    for (let i = 0; i < cmd.points.length; i += 3) {
      points.push([cmd.points[i], cmd.points[i + 1], cmd.points[i + 2]]);
    }

    if (points.length === 0) return;

    const opts: BrushOptions = {
      color: cmd.color,
      size: cmd.size,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
      opacity: cmd.opacity,
      isEraser: cmd.isEraser,
      isHighlighter: cmd.isHighlighter,
      shadow: cmd.shadow,
    };

    RasterBrush.replayStroke(ctx, points, opts);
  }, [mainCanvasRef]);

  // ── Render live remote strokes onto draftCanvas ─────────────────────────────

  const renderLiveStrokes = useCallback(() => {
    const draftCanvas = draftCanvasRef.current;
    if (!draftCanvas) return;
    const ctx = draftCanvas.getContext('2d')!;

    // Clear the entire draft canvas each frame, then redraw all active live strokes.
    // The local RasterBrush also runs its own rAF loop which redraws the local
    // in-progress stroke every frame, so clearing here causes no visible flicker.
    ctx.clearRect(0, 0, logicalW, logicalH);

    liveStrokes.forEach((stroke) => {
      if (stroke.points.length === 0) return;

      const outlinePoints = getStroke(stroke.points, {
        size: stroke.size,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: false,
        start: { taper: 0, cap: true },
        end: { taper: stroke.size * 0.25, cap: true },
      });

      const svgPath = getSvgPathFromStroke(outlinePoints);
      if (!svgPath) return;

      const path2d = new Path2D(svgPath);

      ctx.save();
      if (stroke.isEraser) {
        // Red preview for remote eraser
        ctx.fillStyle = 'rgba(255, 50, 50, 0.35)';
      } else if (stroke.isHighlighter) {
        // Highlighter preview for remote
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = stroke.color;
        ctx.globalAlpha = stroke.opacity ?? 0.5;
      } else {
        ctx.fillStyle = stroke.color;
        ctx.globalAlpha = stroke.opacity;
      }
      ctx.fill(path2d);
      ctx.restore();
    });
  }, [draftCanvasRef, logicalW, logicalH]);

  // ── Live stroke render loop ─────────────────────────────────────────────────

  const startLiveRenderLoop = useCallback(() => {
    if (liveRafId.current !== null) return;

    const loop = () => {
      if (liveDirty.current) {
        renderLiveStrokes();
        liveDirty.current = false;
      }
      liveRafId.current = requestAnimationFrame(loop);
    };
    liveRafId.current = requestAnimationFrame(loop);
  }, [renderLiveStrokes]);

  const stopLiveRenderLoop = useCallback(() => {
    if (liveRafId.current !== null) {
      cancelAnimationFrame(liveRafId.current);
      liveRafId.current = null;
    }
  }, []);

  // ── Socket connection ───────────────────────────────────────────────────────

  useEffect(() => {
    const socket = io(API_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-room', roomId);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on('reconnect' as any, () => {
      setIsConnected(true);
      showToast('Reconnected!', 'success');
      socket.emit('join-room', roomId);
    });

    socket.on('error', (err: { message: string }) => {
      showToast(err.message, 'error');
    });

    // --- Receive initial room state (command log) ---
    socket.on('initial-state', (state: any) => {
      // Backward compatibility if state is just commands array
      const commands = Array.isArray(state) ? state : (state?.commands || []);
      const texts = state?.texts || [];

      const canvas = mainCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d')!;
      // Clear before replaying
      ctx.clearRect(0, 0, logicalW, logicalH);

      // Replay all commands
      commands.forEach((cmd: StrokeCommand) => {
        replayCommand(cmd);
      });

      // Set texts
      setTexts(texts);
    });

    // --- Receive draw events from remote users ---
    socket.on('draw-event', (data: { type: string; stroke?: StrokeCommand }) => {
      if (data.type === 'stroke' && data.stroke) {
        replayCommand(data.stroke);
      } else if (data.type === 'clear') {
        const canvas = mainCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d')!;
          ctx.clearRect(0, 0, logicalW, logicalH);
        }
        setTexts([]);
      }
    });

    // --- Receive text events ---
    socket.on('text-event', (data: any) => {
      if (data.type === 'add') {
        addText(data.text);
      } else if (data.type === 'update') {
        updateText(data.text.id, data.text);
      } else if (data.type === 'remove') {
        removeText(data.id);
      }
    });

    // --- Live stroke streaming (remote users' in-progress strokes) ---
    socket.on('stroke-live', (msg: StrokeLiveEvent) => {
      if (msg.type === 'start') {
        liveStrokes.set(msg.strokeId, {
          points: [[msg.point.x, msg.point.y, msg.point.pressure]],
          color: msg.color,
          size: msg.size,
          opacity: msg.opacity,
          isEraser: msg.isEraser || false,
          isHighlighter: msg.isHighlighter || false,
        });
        liveDirty.current = true;
        startLiveRenderLoop();
      } else if (msg.type === 'move') {
        const stroke = liveStrokes.get(msg.strokeId);
        if (stroke) {
          stroke.points.push([msg.point.x, msg.point.y, msg.point.pressure]);
          liveDirty.current = true;
        }
      } else if (msg.type === 'end') {
        liveStrokes.delete(msg.strokeId);

        // Clear draft canvas to remove the completed live stroke preview,
        // then re-render any remaining active live strokes
        const draftCanvas = draftCanvasRef.current;
        if (draftCanvas) {
          const ctx = draftCanvas.getContext('2d')!;
          ctx.clearRect(0, 0, logicalW, logicalH);
        }

        if (liveStrokes.size > 0) {
          renderLiveStrokes();
        } else {
          stopLiveRenderLoop();
        }
      }
    });

    return () => {
      liveStrokes.clear();
      stopLiveRenderLoop();
      socket.disconnect();
    };
  }, [roomId, mainCanvasRef, draftCanvasRef, logicalW, logicalH, setIsConnected, showToast, replayCommand, startLiveRenderLoop, stopLiveRenderLoop]);

  // ── Emit helpers (exposed to the component) ─────────────────────────────────

  /** Emit a completed stroke command to the room */
  const emitDrawEvent = useCallback((stroke: StrokeCommand) => {
    socketRef.current?.emit('draw-event', {
      roomId,
      data: { type: 'stroke', stroke },
    });
  }, [roomId]);

  /** Emit a live stroke start */
  const emitStrokeLiveStart = useCallback((event: StrokeLiveEvent) => {
    socketRef.current?.emit('stroke-live', { roomId, data: event });
  }, [roomId]);

  /** Emit a live stroke move point */
  const emitStrokeLiveMove = useCallback((event: StrokeLiveEvent) => {
    socketRef.current?.emit('stroke-live', { roomId, data: event });
  }, [roomId]);

  /** Emit a live stroke end */
  const emitStrokeLiveEnd = useCallback((event: StrokeLiveEvent) => {
    socketRef.current?.emit('stroke-live', { roomId, data: event });
  }, [roomId]);

  /** Emit text events */
  const emitTextEvent = useCallback((event: any) => {
    socketRef.current?.emit('text-event', { roomId, data: event });
  }, [roomId]);

  return {
    socketRef,
    emitDrawEvent,
    emitStrokeLiveStart,
    emitStrokeLiveMove,
    emitStrokeLiveEnd,
    emitTextEvent,
  };
}
