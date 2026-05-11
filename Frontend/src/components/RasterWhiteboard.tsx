/**
 * RasterWhiteboard — Three-canvas raster drawing component
 *
 * Architecture:
 *   Layer 3: cursorCanvas  — custom cursor (pointer-events: none)
 *   Layer 2: draftCanvas   — active stroke preview (rAF loop, clearRect every frame)
 *   Layer 1: mainCanvas    — baked pixel data (append-only during drawing)
 *   Layer 0: CSS background — configurable (white/dark/grid)
 *
 * Zero Fabric.js dependencies.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '../store';
import { RasterBrush } from '../engine/RasterBrush';
import { drawShape, type ShapeKind } from '../engine/RasterShapes';
import type { BrushOptions, StrokeCommand, Point2D } from '../engine/types';
import { useRasterUndo } from '../hooks/useRasterUndo';
import { useRasterSocket } from '../hooks/useRasterSocket';
import { v4 as uuidv4 } from 'uuid';
import { DraggableText } from './DraggableText';
import { LiveCursors } from './LiveCursors';
import { executeFloodFill } from '../engine/floodFill';

// ─── Constants ────────────────────────────────────────────────────────────────

const CANVAS_W = 1920;
const CANVAS_H = 1080;

// ─── Canvas Initialization ───────────────────────────────────────────────────

function initCanvas(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return ctx;
}

// ─── Spray brush (custom raster particle scatter) ─────────────────────────────

export function sprayParticles(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  density: number,
  color: string,
): void {
  ctx.fillStyle = color;
  for (let i = 0; i < density; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    const px = x + Math.cos(angle) * dist;
    const py = y + Math.sin(angle) * dist;
    ctx.fillRect(px, py, 1.5, 1.5);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface RasterWhiteboardProps {
  roomId: string;
  nickname: string;
  isCreating: boolean;
}

export const RasterWhiteboard = ({ roomId, nickname, isCreating }: RasterWhiteboardProps) => {
  const mainRef = useRef<HTMLCanvasElement>(null);
  const draftRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLCanvasElement>(null);
  const rasterBrushRef = useRef<RasterBrush | null>(null);

  // Viewport scale state
  const [scale, setScale] = useState(1);

  // Shape drawing state (refs to avoid re-renders)
  const isDrawingShape = useRef(false);
  const shapeStartPoint = useRef<Point2D | null>(null);
  const currentShapeKind = useRef<ShapeKind | null>(null);

  // Spray state
  const isSprayActive = useRef(false);
  const sprayRafId = useRef<number | null>(null);
  const sprayPos = useRef<Point2D>({ x: 0, y: 0 });

  // Zustand store
  const activeTool = useStore((state) => state.activeTool);
  const activeColor = useStore((state) => state.activeColor);
  const brushSize = useStore((state) => state.brushSize);
  const setActiveTool = useStore((state) => state.setActiveTool);
  const texts = useStore((state) => state.texts);
  const addText = useStore((state) => state.addText);
  const updateText = useStore((state) => state.updateText);
  const removeText = useStore((state) => state.removeText);
  const exportTrigger = useStore((state) => state.exportTrigger);
  const isLayerLocked = useStore((state) => state.isLayerLocked);
  const hostId = useStore((state) => state.hostId);

  // Refs for latest values (avoid stale closures in event handlers)
  const activeToolRef = useRef(activeTool);
  const activeColorRef = useRef(activeColor);
  const brushSizeRef = useRef(brushSize);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { activeColorRef.current = activeColor; }, [activeColor]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);

  // ── Undo/Redo engine ────────────────────────────────────────────────────────

  const { pushSnapshot } = useRasterUndo({
    mainCanvasRef: mainRef,
    logicalW: CANVAS_W,
    logicalH: CANVAS_H,
  });
  const pushSnapshotRef = useRef(pushSnapshot);
  useEffect(() => { pushSnapshotRef.current = pushSnapshot; }, [pushSnapshot]);

  // ── Socket sync ─────────────────────────────────────────────────────────────

  const {
    emitDrawEvent,
    emitFillEvent,
    emitImageEvent,
    emitStrokeLiveStart,
    emitStrokeLiveMove,
    emitStrokeLiveEnd,
    emitTextEvent,
    emitCursorMove,
    socketRef,
  } = useRasterSocket({
    roomId,
    mainCanvasRef: mainRef,
    draftCanvasRef: draftRef,
    logicalW: CANVAS_W,
    logicalH: CANVAS_H,
    nickname,
    isCreating,
  });

  // Refs for emit helpers (to avoid stale closures in brush callbacks)
  const emitDrawEventRef = useRef(emitDrawEvent);
  const emitFillEventRef = useRef(emitFillEvent);
  const emitImageEventRef = useRef(emitImageEvent);
  const emitStrokeLiveStartRef = useRef(emitStrokeLiveStart);
  const emitStrokeLiveMoveRef = useRef(emitStrokeLiveMove);
  const emitStrokeLiveEndRef = useRef(emitStrokeLiveEnd);
  const emitTextEventRef = useRef(emitTextEvent);
  const emitCursorMoveRef = useRef(emitCursorMove);
  useEffect(() => { emitDrawEventRef.current = emitDrawEvent; }, [emitDrawEvent]);
  useEffect(() => { emitFillEventRef.current = emitFillEvent; }, [emitFillEvent]);
  useEffect(() => { emitImageEventRef.current = emitImageEvent; }, [emitImageEvent]);
  useEffect(() => { emitStrokeLiveStartRef.current = emitStrokeLiveStart; }, [emitStrokeLiveStart]);
  useEffect(() => { emitStrokeLiveMoveRef.current = emitStrokeLiveMove; }, [emitStrokeLiveMove]);
  useEffect(() => { emitStrokeLiveEndRef.current = emitStrokeLiveEnd; }, [emitStrokeLiveEnd]);
  useEffect(() => { emitTextEventRef.current = emitTextEvent; }, [emitTextEvent]);
  useEffect(() => { emitCursorMoveRef.current = emitCursorMove; }, [emitCursorMove]);

  // ── Viewport scaling ────────────────────────────────────────────────────────

  useEffect(() => {
    const updateScale = () => {
      // Add padding to account for mobile/split-window toolbars
      const paddingX = window.innerWidth < 768 ? 16 : 100;
      const paddingY = window.innerWidth < 768 ? 100 : 32; // Reserve space for bottom toolbar on mobile
      
      const sx = (window.innerWidth - paddingX) / CANVAS_W;
      const sy = (window.innerHeight - paddingY) / CANVAS_H;
      
      setScale(Math.min(sx, sy, 1));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // ── Pointer coordinate helper ───────────────────────────────────────────────

  const getCanvasPoint = useCallback((e: PointerEvent | MouseEvent): Point2D => {
    const rect = draftRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (e.clientY - rect.top) * (CANVAS_H / rect.height),
    };
  }, []);

  // ── Initialize canvases ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!mainRef.current || !draftRef.current || !cursorRef.current) return;

    initCanvas(mainRef.current, CANVAS_W, CANVAS_H);
    initCanvas(draftRef.current, CANVAS_W, CANVAS_H);
    initCanvas(cursorRef.current, CANVAS_W, CANVAS_H);
  }, []);

  // ── RasterBrush lifecycle ───────────────────────────────────────────────────

  useEffect(() => {
    if (!draftRef.current || !mainRef.current) return;

    const brush = new RasterBrush(draftRef.current, mainRef.current, CANVAS_W, CANVAS_H);
    rasterBrushRef.current = brush;

    // Wire stroke-complete callback
    brush.onStrokeComplete = (payload) => {
      const { options, inputPoints } = payload;
      if (!inputPoints || inputPoints.length === 0) return;

      const id = uuidv4();
      const tool = activeToolRef.current;

      // Pack points into flat array for sync
      const flatPoints: number[] = [];
      inputPoints.forEach(([x, y, p]) => {
        flatPoints.push(
          Math.round(x * 10) / 10,
          Math.round(y * 10) / 10,
          Math.round(p * 100) / 100,
        );
      });

      const command: StrokeCommand = {
        type: 'stroke',
        id,
        tool,
        color: options.color,
        size: options.size,
        opacity: options.opacity ?? 1,
        points: flatPoints,
        isEraser: options.isEraser,
        isHighlighter: options.isHighlighter,
        shadow: options.shadow,
      };

      // Emit completed stroke to remote clients
      emitDrawEventRef.current(command);
      console.log('[RasterWhiteboard] stroke complete:', command.id, command.tool);
    };

    // Track current strokeId for live streaming
    let currentStrokeId = '';

    // Wire undo snapshot BEFORE bake
    brush.onBeforeBake = () => {
      pushSnapshotRef.current();
    };

    brush.onStrokeStart = (point) => {
      currentStrokeId = uuidv4();
      const currentBrushOpts = rasterBrushRef.current?.getCurrentOptions?.();
      emitStrokeLiveStartRef.current({
        type: 'start',
        strokeId: currentStrokeId,
        tool: activeToolRef.current,
        color: activeColorRef.current,
        size: brushSizeRef.current,
        opacity: currentBrushOpts?.opacity ?? 1,
        isEraser: currentBrushOpts?.isEraser,
        isHighlighter: currentBrushOpts?.isHighlighter,
        point,
      });
    };

    brush.onPointEmit = (point) => {
      emitStrokeLiveMoveRef.current({
        type: 'move',
        strokeId: currentStrokeId,
        point,
      });
    };

    // Wire stroke-end for live stream cleanup (called internally after bake)
    const originalOnComplete = brush.onStrokeComplete;
    brush.onStrokeComplete = (payload) => {
      originalOnComplete?.(payload);
      emitStrokeLiveEndRef.current({
        type: 'end',
        strokeId: currentStrokeId,
      });
    };

    return () => {
      brush.dispose();
      rasterBrushRef.current = null;
    };
  }, []);

  // ── Cursor canvas (brush size indicator) ────────────────────────────────────

  useEffect(() => {
    const cursorCanvas = cursorRef.current;
    if (!cursorCanvas) return;

    const ctx = cursorCanvas.getContext('2d')!;

    const handleMove = (e: PointerEvent) => {
      const { x, y } = getCanvasPoint(e);
      // Clear previous cursor
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Draw cursor circle
      const radius = brushSizeRef.current / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = activeToolRef.current === 'eraser' ? 'rgba(255,50,50,0.6)' : 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Emit cursor position to other users (throttled)
      emitCursorMoveRef.current({
        id: useStore.getState().socketId,
        x,
        y,
        nickname,
        avatar: useStore.getState().avatar
      });
    };

    const handleLeave = () => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    };

    // Listen on the draft canvas (which receives pointer events)
    const draftCanvas = draftRef.current;
    if (draftCanvas) {
      draftCanvas.addEventListener('pointermove', handleMove);
      draftCanvas.addEventListener('pointerleave', handleLeave);
    }

    return () => {
      if (draftCanvas) {
        draftCanvas.removeEventListener('pointermove', handleMove);
        draftCanvas.removeEventListener('pointerleave', handleLeave);
      }
    };
  }, [getCanvasPoint]);

  // ── Tool switching ──────────────────────────────────────────────────────────

  useEffect(() => {
    const brush = rasterBrushRef.current;
    const draftCanvas = draftRef.current;
    const mainCanvas = mainRef.current;
    if (!brush || !draftCanvas || !mainCanvas) return;

    // Clean up spray
    if (sprayRafId.current !== null) {
      cancelAnimationFrame(sprayRafId.current);
      sprayRafId.current = null;
    }
    isSprayActive.current = false;

    // Remove shape/spray handlers before re-attaching
    let shapeDownHandler: ((e: PointerEvent) => void) | null = null;
    let shapeMoveHandler: ((e: PointerEvent) => void) | null = null;
    let shapeUpHandler: ((e: PointerEvent) => void) | null = null;
    let sprayDownHandler: ((e: PointerEvent) => void) | null = null;
    let sprayMoveHandler: ((e: PointerEvent) => void) | null = null;
    let sprayUpHandler: ((e: PointerEvent) => void) | null = null;

    const mainCtx = mainCanvas.getContext('2d')!;
    const draftCtx = draftCanvas.getContext('2d')!;

    if (activeTool === 'select') {
      // No select tool in raster mode — do nothing
      brush.deactivate();
      draftCanvas.style.cursor = 'default';

    } else if (activeTool === 'pencil' || activeTool === 'pencil-sketch') {
      const opts: BrushOptions = {
        color: activeColor,
        size: brushSize,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
      };
      brush.activate(opts);

    } else if (activeTool === 'pencil-marker') {
      // Parse color and apply 70% opacity
      const opts: BrushOptions = {
        color: activeColor,
        size: brushSize * 2,
        thinning: 0,
        smoothing: 0.5,
        streamline: 0.3,
        opacity: 0.7,
      };
      brush.activate(opts);

    } else if (activeTool === 'pencil-highlighter') {
      const opts: BrushOptions = {
        color: activeColor,
        size: brushSize * 3,
        thinning: 0,
        smoothing: 0.5,
        streamline: 0.5,
        opacity: 0.5,
        isHighlighter: true,
      };
      brush.activate(opts);

    } else if (activeTool === 'pencil-neon') {
      const opts: BrushOptions = {
        color: activeColor,
        size: brushSize,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        shadow: {
          blur: brushSize * 3,
          color: activeColor,
          offsetX: 0,
          offsetY: 0,
        },
      };
      brush.activate(opts);

    } else if (activeTool === 'pencil-spray') {
      brush.deactivate();
      draftCanvas.style.cursor = 'crosshair';

      // Collect spray points for network sync
      const sprayPoints: Point2D[] = [];

      // Custom spray implementation using particle scatter
      sprayDownHandler = (e: PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        // Capture undo snapshot BEFORE spray starts painting on mainCanvas
        pushSnapshotRef.current();
        isSprayActive.current = true;
        sprayPoints.length = 0;
        draftCanvas.setPointerCapture(e.pointerId);
        const pt = getCanvasPoint(e);
        sprayPos.current = pt;

        // Start spray rAF loop
        const sprayLoop = () => {
          if (!isSprayActive.current) return;
          const sx = sprayPos.current.x;
          const sy = sprayPos.current.y;
          sprayParticles(mainCtx, sx, sy, brushSizeRef.current * 3, 15, activeColorRef.current);
          sprayPoints.push({ x: sx, y: sy });
          sprayRafId.current = requestAnimationFrame(sprayLoop);
        };
        sprayRafId.current = requestAnimationFrame(sprayLoop);
      };
      sprayMoveHandler = (e: PointerEvent) => {
        if (!isSprayActive.current) return;
        e.preventDefault();
        sprayPos.current = getCanvasPoint(e);
      };
      sprayUpHandler = (e: PointerEvent) => {
        if (!isSprayActive.current) return;
        e.preventDefault();
        isSprayActive.current = false;
        draftCanvas.releasePointerCapture(e.pointerId);
        if (sprayRafId.current !== null) {
          cancelAnimationFrame(sprayRafId.current);
          sprayRafId.current = null;
        }

        // Emit spray stroke to network
        if (sprayPoints.length > 0) {
          const flatPoints: number[] = [];
          sprayPoints.forEach((pt) => {
            flatPoints.push(
              Math.round(pt.x * 10) / 10,
              Math.round(pt.y * 10) / 10,
              1, // pressure placeholder
            );
          });

          const command: StrokeCommand = {
            type: 'stroke',
            id: uuidv4(),
            tool: 'pencil-spray',
            color: activeColorRef.current,
            size: brushSizeRef.current,
            opacity: 1,
            points: flatPoints,
          };
          emitDrawEventRef.current(command);
        }
      };

      draftCanvas.addEventListener('pointerdown', sprayDownHandler);
      draftCanvas.addEventListener('pointermove', sprayMoveHandler);
      draftCanvas.addEventListener('pointerup', sprayUpHandler);

    } else if (activeTool === 'eraser') {
      const opts: BrushOptions = {
        color: '#000000',
        size: brushSize * 2,
        thinning: 0,
        smoothing: 0.5,
        streamline: 0.5,
        isEraser: true,
      };
      brush.activate(opts);

    } else if (activeTool === 'text') {
      brush.deactivate();
      draftCanvas.style.cursor = 'text';

      // Text tool: click to place a textarea overlay
      const textClickHandler = (e: PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const pt = getCanvasPoint(e);
        const newText = {
          id: uuidv4(),
          content: '',
          x: pt.x,
          y: pt.y,
          width: Math.max(brushSizeRef.current * 8, 120),
          height: Math.max(brushSizeRef.current * 3, 40),
          fontSize: Math.max(brushSizeRef.current * 2, 16),
          fontFamily: 'Inter, system-ui, sans-serif',
          color: activeColorRef.current,
          isEditing: true,
        };
        
        addText(newText);
        
        // Also broadcast to room
        const textToSync = { ...newText, isEditing: false };
        emitTextEventRef.current({ type: 'add', text: textToSync });
        
        setActiveTool('select');
      };
      draftCanvas.addEventListener('pointerdown', textClickHandler);

      // Store cleanup reference
      // We reuse shapeDownHandler variable for cleanup
      shapeDownHandler = textClickHandler;

    } else if (activeTool.startsWith('shape-')) {
      brush.deactivate();
      draftCanvas.style.cursor = 'crosshair';

      // Map tool ID to shape kind
      const shapeMap: Record<string, ShapeKind> = {
        'shape-rectangle': 'rectangle',
        'shape-circle': 'ellipse',
        'shape-triangle': 'triangle',
        'shape-diamond': 'diamond',
        'shape-star': 'star',
        'shape-hexagon': 'hexagon',
        'shape-arrow': 'arrow',
      };

      shapeDownHandler = (e: PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        draftCanvas.setPointerCapture(e.pointerId);

        const pt = getCanvasPoint(e);
        shapeStartPoint.current = pt;
        currentShapeKind.current = shapeMap[activeToolRef.current] || 'rectangle';
        isDrawingShape.current = true;
      };

      shapeMoveHandler = (e: PointerEvent) => {
        if (!isDrawingShape.current || !shapeStartPoint.current || !currentShapeKind.current) return;
        e.preventDefault();

        const pt = getCanvasPoint(e);
        const sx = shapeStartPoint.current.x;
        const sy = shapeStartPoint.current.y;

        // MS Paint style: bounding box grows from anchor
        const left = Math.min(sx, pt.x);
        const top = Math.min(sy, pt.y);
        const w = Math.abs(pt.x - sx);
        const h = Math.abs(pt.y - sy);

        // Clear draft and draw shape preview
        draftCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        drawShape(draftCtx, currentShapeKind.current, left, top, w, h, activeColorRef.current, brushSizeRef.current);
      };

      shapeUpHandler = (e: PointerEvent) => {
        if (!isDrawingShape.current || !shapeStartPoint.current || !currentShapeKind.current) return;
        e.preventDefault();
        draftCanvas.releasePointerCapture(e.pointerId);

        const pt = getCanvasPoint(e);
        const sx = shapeStartPoint.current.x;
        const sy = shapeStartPoint.current.y;
        const left = Math.min(sx, pt.x);
        const top = Math.min(sy, pt.y);
        const w = Math.abs(pt.x - sx);
        const h = Math.abs(pt.y - sy);

        // Bake shape onto main canvas
        if (w > 2 && h > 2) {
          // Push undo snapshot before shape bake
          pushSnapshotRef.current();

          drawShape(mainCtx, currentShapeKind.current, left, top, w, h, activeColorRef.current, brushSizeRef.current);

          const id = uuidv4();
          const command: StrokeCommand = {
            type: 'stroke',
            id,
            tool: activeToolRef.current,
            color: activeColorRef.current,
            size: brushSizeRef.current,
            opacity: 1,
            points: [],
            shape: {
              kind: currentShapeKind.current,
              x: left,
              y: top,
              w,
              h,
            },
          };

          // Emit shape to remote clients
          emitDrawEventRef.current(command);
          console.log('[RasterWhiteboard] shape baked:', command.id);
        }

        // Clear draft
        draftCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        // Reset
        isDrawingShape.current = false;
        shapeStartPoint.current = null;
        currentShapeKind.current = null;

        // Switch to select after shape placement (matches Fabric behavior)
        setActiveTool('select');
      };

      draftCanvas.addEventListener('pointerdown', shapeDownHandler);
      draftCanvas.addEventListener('pointermove', shapeMoveHandler);
      draftCanvas.addEventListener('pointerup', shapeUpHandler);
    }

    return () => {
      // Clean up shape handlers
      if (shapeDownHandler) draftCanvas.removeEventListener('pointerdown', shapeDownHandler);
      if (shapeMoveHandler) draftCanvas.removeEventListener('pointermove', shapeMoveHandler);
      if (shapeUpHandler) draftCanvas.removeEventListener('pointerup', shapeUpHandler);
      // Clean up spray handlers
      if (sprayDownHandler) draftCanvas.removeEventListener('pointerdown', sprayDownHandler);
      if (sprayMoveHandler) draftCanvas.removeEventListener('pointermove', sprayMoveHandler);
      if (sprayUpHandler) draftCanvas.removeEventListener('pointerup', sprayUpHandler);
      // Clean up spray rAF
      if (sprayRafId.current !== null) {
        cancelAnimationFrame(sprayRafId.current);
        sprayRafId.current = null;
      }
    };
  }, [activeTool, activeColor, brushSize, setActiveTool, getCanvasPoint]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't trigger undo when typing in textarea or input
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;

      const { triggerUndo, triggerRedo } = useStore.getState();
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); triggerUndo(); }
      else if (e.ctrlKey && e.key === 'y') { e.preventDefault(); triggerRedo(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // ── Export to PNG ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (exportTrigger === 0) return;
    const canvas = mainRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `drawwww-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [exportTrigger]);

  // ── Image outline upload handler ──────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: Event) => {
      const { dataUrl } = (e as CustomEvent).detail;
      const canvas = mainRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;

      pushSnapshotRef.current();

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
        // Emit image to room
        emitImageEventRef.current({
          type: 'image',
          dataUrl,
          x: 0,
          y: 0,
          w: CANVAS_W,
          h: CANVAS_H,
        });
      };
      img.src = dataUrl;
    };
    window.addEventListener('image-outline-ready', handler);
    return () => window.removeEventListener('image-outline-ready', handler);
  }, []);

  // ── Kick user handler ─────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: Event) => {
      const { targetId } = (e as CustomEvent).detail;
      socketRef.current?.emit('kick-user', { roomId, targetId });
    };
    window.addEventListener('kick-user', handler);
    return () => window.removeEventListener('kick-user', handler);
  }, [roomId]);

  // ── Layer lock toggle handler ─────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: Event) => {
      const { lock } = (e as CustomEvent).detail;
      if (lock) {
        socketRef.current?.emit('lock-layer', { roomId });
      } else {
        socketRef.current?.emit('unlock-layer', { roomId });
      }
    };
    window.addEventListener('toggle-layer-lock', handler);
    return () => window.removeEventListener('toggle-layer-lock', handler);
  }, [roomId]);

  // ── Flood fill tool handler ───────────────────────────────────────────────────

  useEffect(() => {
    const draftCanvas = draftRef.current;
    const mainCanvas = mainRef.current;
    if (!draftCanvas || !mainCanvas) return;
    if (activeTool !== 'fill') return;

    rasterBrushRef.current?.deactivate();
    draftCanvas.style.cursor = 'crosshair';

    const handleFillClick = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const pt = getCanvasPoint(e);
      const ctx = mainCanvas.getContext('2d')!;

      pushSnapshotRef.current();
      executeFloodFill(ctx, Math.round(pt.x), Math.round(pt.y), activeColorRef.current, 32);

      emitFillEventRef.current({
        type: 'fill',
        point: { x: Math.round(pt.x), y: Math.round(pt.y) },
        color: activeColorRef.current,
        tolerance: 32,
      });
    };

    draftCanvas.addEventListener('pointerdown', handleFillClick);
    return () => draftCanvas.removeEventListener('pointerdown', handleFillClick);
  }, [activeTool, getCanvasPoint]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const socketId = useStore((state) => state.socketId);
  const isLockedForMe = isLayerLocked && hostId !== socketId;

  return (
    <div className="w-screen h-screen h-[100dvh] flex items-center justify-center overflow-hidden bg-neutral-200">
      {/* Outer Viewport Wrapper — determines exact scaled dimensions to prevent body overflow */}
      <div
        style={{
          width: CANVAS_W * scale,
          height: CANVAS_H * scale,
        }}
        className="relative shadow-2xl flex-shrink-0"
      >
        {/* Inner Container — applies scaling and CSS dot grid background (Layer 0) */}
        <div
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            backgroundColor: '#ffffff',
            backgroundImage: 'radial-gradient(#d4d4d8 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
          }}
          className="absolute top-0 left-0 overflow-hidden"
        >
          <canvas
            ref={mainRef}
            className="absolute inset-0"
            style={{ zIndex: 1 }}
          />
        <canvas
          ref={draftRef}
          className={`absolute inset-0 touch-none ${isLockedForMe ? 'pointer-events-none' : ''}`}
          style={{ zIndex: 2 }}
        />
        <canvas
          ref={cursorRef}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 3 }}
        />

        {/* Object Overlay Layer (Text) */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 10 }}
        >
          {texts.map(textObj => (
            <div key={textObj.id} className={isLockedForMe ? 'pointer-events-none' : 'pointer-events-auto'}>
              <DraggableText
                textObj={textObj}
                scale={scale}
                onUpdate={(id, updates) => {
                  updateText(id, updates);
                  // Sync to network (strip isEditing)
                  const syncObj = { ...textObj, ...updates, isEditing: undefined };
                  emitTextEvent({ type: 'update', text: syncObj });
                }}
                onDelete={(id) => {
                  removeText(id);
                  emitTextEvent({ type: 'remove', id });
                }}
              />
            </div>
          ))}
        </div>
        {/* Live Multiplayer Cursors Overlay */}
        <LiveCursors scale={scale} />
        </div>
      </div>
    </div>
  );
};
