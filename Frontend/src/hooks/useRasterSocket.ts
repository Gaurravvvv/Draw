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
import { sprayParticles } from '../components/RasterWhiteboard';
import type { StrokeCommand, StrokeLiveEvent, PointWithPressure, BrushOptions, DrawEventFill, DrawEventImage } from '../engine/types';
import { executeFloodFill } from '../engine/floodFill';
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

/** Replay an image command by drawing a dataURL onto the canvas */
function replayImageCommand(ctx: CanvasRenderingContext2D, cmd: { dataUrl: string; x: number; y: number; w: number; h: number }): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, cmd.x, cmd.y, cmd.w, cmd.h);
      resolve();
    };
    img.onerror = () => resolve(); // prevent hanging
    img.src = cmd.dataUrl;
  });
}

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
  nickname,
  isCreating,
}: UseRasterSocketOptions & { nickname?: string; isCreating?: boolean }) {
  const socketRef = useRef<Socket | null>(null);
  const { setIsConnected, showToast, setTexts, addText, updateText, removeText, setRoomUsers, setHostId, setIsLayerLocked, avatar, setSocketId } = useStore();
  const liveRafId = useRef<number | null>(null);
  const liveDirty = useRef(false);
  const lastMoveEmitTime = useRef(0);
  const commandsLogRef = useRef<any[]>([]);
  const baseLayerRef = useRef<any[]>([]);

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

    if (cmd.tool === 'pencil-spray') {
      const radius = cmd.size * 3;
      const density = 15;
      for (let i = 0; i < points.length; i++) {
        const sx = points[i][0];
        const sy = points[i][1];
        const seed = Math.floor(sx * 1000) + Math.floor(sy);
        sprayParticles(ctx, sx, sy, radius, density, cmd.color, seed);
      }
      return;
    }

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

  // ── Sequential Replay Engine (fixes image -> flood-fill async issues) ───────
  const replayAllCommandsSequential = useCallback(async (ctx: CanvasRenderingContext2D, commands: any[]) => {
    for (const cmd of commands) {
      if (cmd.type === 'stroke' || !cmd.type) {
        replayCommand(cmd.stroke || cmd);
      } else if (cmd.type === 'fill') {
        executeFloodFill(ctx, cmd.point.x, cmd.point.y, cmd.color, cmd.tolerance);
      } else if (cmd.type === 'image') {
        await replayImageCommand(ctx, cmd);
      }
    }
  }, [replayCommand]);

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
      setSocketId(socket.id || null);
      socket.emit('join-room', { roomId, nickname: nickname || 'Anonymous', avatar, isCreating });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setSocketId(null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on('reconnect' as any, () => {
      setIsConnected(true);
      showToast('Reconnected!', 'success');
      socket.emit('join-room', { roomId, nickname: nickname || 'Anonymous', avatar, isCreating });
    });

    socket.on('error', (err: { message: string }) => {
      showToast(err.message, 'error');
    });

    socket.on('room-not-found', (data: { message: string }) => {
      showToast(data.message, 'error');
      socket.disconnect();
      window.dispatchEvent(new CustomEvent('kicked-from-room'));
    });

    // --- Receive room users list ---
    socket.on('room-users', (data: any) => {
      // Support new format { users, hostId } and old format (array)
      if (Array.isArray(data)) {
        setRoomUsers(data);
      } else {
        setRoomUsers(data.users || []);
        setHostId(data.hostId || null);
      }
    });

    // --- Handle kicked event ---
    socket.on('kicked', (data: { message: string }) => {
      showToast(data.message, 'error');
      // The component will detect isConnected=false and redirect
      socket.disconnect();
      window.dispatchEvent(new CustomEvent('kicked-from-room'));
    });

    // --- Receive initial room state (command log) ---
    socket.on('initial-state', (state: any) => {
      // Backward compatibility if state is just commands array
      const commands = Array.isArray(state) ? state : (state?.commands || []);
      const texts = state?.texts || [];
      const baseCmds = state?.baseLayerCommands || [];

      commandsLogRef.current = [...commands];
      baseLayerRef.current = [...baseCmds];
      if (baseCmds.length > 0) setIsLayerLocked(true);

      const canvas = mainCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d')!;
      // Clear before replaying
      ctx.clearRect(0, 0, logicalW, logicalH);

      // Replay base layer first (protected), then current commands sequentially
      (async () => {
        await replayAllCommandsSequential(ctx, baseCmds);
        await replayAllCommandsSequential(ctx, commands);
        // Set texts after replay
        setTexts(texts);
      })();
    });

    // --- Receive draw events from remote users ---
    socket.on('draw-event', (data: any) => {
      if (data.type === 'stroke' || (data.type === 'stroke' && data.stroke)) {
        commandsLogRef.current.push(data);
        replayCommand(data.stroke || data);
      } else if (data.type === 'fill') {
        commandsLogRef.current.push(data);
        const canvas = mainCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d')!;
          executeFloodFill(ctx, data.point.x, data.point.y, data.color, data.tolerance);
        }
      } else if (data.type === 'image') {
        commandsLogRef.current.push(data);
        const canvas = mainCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d')!;
          replayImageCommand(ctx, data);
        }
      } else if (data.type === 'clear') {
        commandsLogRef.current = [];
        const canvas = mainCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d')!;
          ctx.clearRect(0, 0, logicalW, logicalH);
          // Re-draw base layer even on clear
          replayAllCommandsSequential(ctx, baseLayerRef.current);
        }
        setTexts([]);
      }
    });

    // --- Undo/Redo replay (user-scoped) ---
    socket.on('undo-replay', (data: { commands: any[]; baseLayerCommands: any[] }) => {
      commandsLogRef.current = [...data.commands];
      baseLayerRef.current = data.baseLayerCommands || baseLayerRef.current;

      const canvas = mainCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, logicalW, logicalH);

      // Replay sequentially so images load before flood fills
      (async () => {
        await replayAllCommandsSequential(ctx, baseLayerRef.current);
        await replayAllCommandsSequential(ctx, data.commands);
      })();
    });

    // --- Layer locked event ---
    socket.on('layer-locked', (data: { baseLayerCommands: any[] }) => {
      baseLayerRef.current = data.baseLayerCommands;
      commandsLogRef.current = [];
      setIsLayerLocked(true);
      showToast('Layer locked! Current drawing is now protected.', 'info');
    });

    socket.on('layer-unlocked', (data: { commands: any[] }) => {
      baseLayerRef.current = [];
      commandsLogRef.current = data.commands;
      setIsLayerLocked(false);
      showToast('Layer unlocked.', 'info');
      
      const canvas = mainCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, logicalW, logicalH);
      
      (async () => {
        await replayAllCommandsSequential(ctx, data.commands);
      })();
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

    // --- Cursor streaming ---
    socket.on('cursor-move', (data: any) => {
      // Dispatch custom event to be picked up by LiveCursors component
      window.dispatchEvent(new CustomEvent('remote-cursor-move', { detail: data }));
    });

    return () => {
      liveStrokes.clear();
      stopLiveRenderLoop();
      socket.disconnect();
    };
  }, [roomId, mainCanvasRef, draftCanvasRef, logicalW, logicalH, setIsConnected, showToast, replayCommand, startLiveRenderLoop, stopLiveRenderLoop]);

  // ── Undo/Redo Sync ────────────────────────────────────────────────────────
  useEffect(() => {
    let prevUndoTrigger = useStore.getState().undoTrigger;
    let prevRedoTrigger = useStore.getState().redoTrigger;
    
    const unsub = useStore.subscribe((state) => {
      if (state.undoTrigger !== prevUndoTrigger) {
        prevUndoTrigger = state.undoTrigger;
        // Emit undo (server will io.in().emit back to us so we process it in draw-event)
        socketRef.current?.emit('draw-event', { roomId, data: { type: 'undo' } });
      }
      
      if (state.redoTrigger !== prevRedoTrigger) {
        prevRedoTrigger = state.redoTrigger;
        // Emit redo
        socketRef.current?.emit('draw-event', { roomId, data: { type: 'redo' } });
      }
    });
    
    return () => unsub();
  }, [roomId]);

  // ── Emit helpers (exposed to the component) ─────────────────────────────────

  /** Emit a completed stroke command to the room */
  const emitDrawEvent = useCallback((stroke: StrokeCommand) => {
    const data = { type: 'stroke', stroke };
    commandsLogRef.current.push(data); // Push locally
    socketRef.current?.emit('draw-event', {
      roomId,
      data,
    });
  }, [roomId]);

  /** Emit a fill command to the room */
  const emitFillEvent = useCallback((event: DrawEventFill) => {
    commandsLogRef.current.push(event); // Push locally
    socketRef.current?.emit('draw-event', {
      roomId,
      data: event,
    });
  }, [roomId]);

  /** Emit a live stroke start */
  const emitStrokeLiveStart = useCallback((event: StrokeLiveEvent) => {
    socketRef.current?.emit('stroke-live', { roomId, data: event });
  }, [roomId]);

  /** Emit a live stroke move point */
  const emitStrokeLiveMove = useCallback((event: StrokeLiveEvent) => {
    const now = Date.now();
    if (now - lastMoveEmitTime.current > 32) { // ~30fps
      socketRef.current?.emit('stroke-live', { roomId, data: event });
      lastMoveEmitTime.current = now;
    }
  }, [roomId]);

  /** Emit a live stroke end */
  const emitStrokeLiveEnd = useCallback((event: StrokeLiveEvent) => {
    socketRef.current?.emit('stroke-live', { roomId, data: event });
  }, [roomId]);

  /** Emit text events */
  const emitTextEvent = useCallback((event: any) => {
    socketRef.current?.emit('text-event', { roomId, data: event });
  }, [roomId]);

  /** Emit cursor move */
  const emitCursorMove = useCallback((data: any) => {
    socketRef.current?.emit('cursor-move', { roomId, data });
  }, [roomId]);

  /** Emit an image (coloring book outline) to the room */
  const emitImageEvent = useCallback((event: DrawEventImage) => {
    commandsLogRef.current.push(event);
    socketRef.current?.emit('draw-event', {
      roomId,
      data: event,
    });
  }, [roomId]);

  return {
    socketRef,
    emitDrawEvent,
    emitFillEvent,
    emitImageEvent,
    emitStrokeLiveStart,
    emitStrokeLiveMove,
    emitStrokeLiveEnd,
    emitTextEvent,
    emitCursorMove,
  };
}
