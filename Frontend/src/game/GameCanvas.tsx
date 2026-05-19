/**
 * GameCanvas — Isolated drawing canvas for "Draw This Shytt" game mode.
 * Reuses the existing raster engine (RasterBrush) but in a standalone, non-collaborative context.
 * Each drawer gets their own instance — no socket sync between drawers.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { RasterBrush } from '../engine/RasterBrush';
import { drawShape, type ShapeKind } from '../engine/RasterShapes';
import type { Point2D } from '../engine/types';
import { useStore } from '../store';
import { sprayParticles } from '../components/RasterWhiteboard';
import { executeFloodFill } from '../engine/floodFill';

const CANVAS_W = 1920;
const CANVAS_H = 1080;

function initCanvas(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  // willReadFrequently: true avoids browser warnings when getImageData is called
  // repeatedly (e.g. flood fill). Hints the browser to keep pixel data in CPU memory.
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.scale(dpr, dpr);
  return ctx;
}

interface GameCanvasProps {
  locked: boolean;
  onSnapshot?: (pngBase64: string) => void;
  snapshotInterval?: number; // ms between auto-snapshots for spectator
}

export function GameCanvas({ locked, onSnapshot, snapshotInterval = 2000 }: GameCanvasProps) {
  const mainRef = useRef<HTMLCanvasElement>(null);
  const draftRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLCanvasElement>(null);
  const rasterBrushRef = useRef<RasterBrush | null>(null);
  const [scale, setScale] = useState(1);

  // Shape refs
  const isDrawingShape = useRef(false);
  const shapeStartPoint = useRef<Point2D | null>(null);
  const currentShapeKind = useRef<ShapeKind | null>(null);

  // Spray
  const isSprayActive = useRef(false);
  const sprayRafId = useRef<number | null>(null);
  const sprayPos = useRef<Point2D>({ x: 0, y: 0 });

  const activeTool = useStore(s => s.activeTool);
  const activeColor = useStore(s => s.activeColor);
  const brushSize = useStore(s => s.brushSize);
  const setActiveTool = useStore(s => s.setActiveTool);

  const activeToolRef = useRef(activeTool);
  const activeColorRef = useRef(activeColor);
  const brushSizeRef = useRef(brushSize);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { activeColorRef.current = activeColor; }, [activeColor]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);

  // ── Viewport scaling ──
  useEffect(() => {
    const updateScale = () => {
      const paddingX = window.innerWidth < 768 ? 16 : 100;
      const paddingY = window.innerWidth < 768 ? 160 : 120;
      const sx = (window.innerWidth - paddingX) / CANVAS_W;
      const sy = (window.innerHeight - paddingY) / CANVAS_H;
      setScale(Math.min(sx, sy, 1));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const getCanvasPoint = useCallback((e: PointerEvent | MouseEvent): Point2D => {
    const rect = draftRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (e.clientY - rect.top) * (CANVAS_H / rect.height),
    };
  }, []);

  // ── Init canvases ──
  useEffect(() => {
    if (!mainRef.current || !draftRef.current || !cursorRef.current) return;
    initCanvas(mainRef.current, CANVAS_W, CANVAS_H);
    initCanvas(draftRef.current, CANVAS_W, CANVAS_H);
    initCanvas(cursorRef.current, CANVAS_W, CANVAS_H);
  }, []);

  // ── RasterBrush setup ──
  useEffect(() => {
    if (!draftRef.current || !mainRef.current) return;
    const brush = new RasterBrush(draftRef.current, mainRef.current, CANVAS_W, CANVAS_H);
    rasterBrushRef.current = brush;

    brush.onStrokeComplete = () => {};
    brush.onBeforeBake = () => {};

    return () => {
      brush.dispose();
      rasterBrushRef.current = null;
    };
  }, []);

  // ── Auto-snapshot for spectator ──
  // IMPORTANT: We must composite white behind the drawing before JPEG export.
  // The canvas background is white only via CSS — the actual canvas pixels are
  // transparent. JPEG has no alpha channel, so transparent pixels become BLACK.
  useEffect(() => {
    if (!onSnapshot || locked) return;
    const interval = setInterval(() => {
      const canvas = mainRef.current;
      if (!canvas) return;
      const offscreen = document.createElement('canvas');
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const ctx = offscreen.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, offscreen.width, offscreen.height);
      ctx.drawImage(canvas, 0, 0);
      // JPEG quality 0.4 — visually fine, ~10x smaller than PNG
      const jpegBase64 = offscreen.toDataURL('image/jpeg', 0.4);
      onSnapshot(jpegBase64);
    }, snapshotInterval);
    return () => clearInterval(interval);
  }, [onSnapshot, locked, snapshotInterval]);

  // ── Tool switching (mirrors RasterWhiteboard logic) ──
  useEffect(() => {
    const brush = rasterBrushRef.current;
    const draftCanvas = draftRef.current;
    const mainCanvas = mainRef.current;
    if (!brush || !draftCanvas || !mainCanvas || locked) {
      brush?.deactivate();
      return;
    }

    if (sprayRafId.current !== null) {
      cancelAnimationFrame(sprayRafId.current);
      sprayRafId.current = null;
    }
    isSprayActive.current = false;

    let shapeDownHandler: ((e: PointerEvent) => void) | null = null;
    let shapeMoveHandler: ((e: PointerEvent) => void) | null = null;
    let shapeUpHandler: ((e: PointerEvent) => void) | null = null;
    let sprayDownHandler: ((e: PointerEvent) => void) | null = null;
    let sprayMoveHandler: ((e: PointerEvent) => void) | null = null;
    let sprayUpHandler: ((e: PointerEvent) => void) | null = null;

    const mainCtx = mainCanvas.getContext('2d')!;
    const draftCtx = draftCanvas.getContext('2d')!;

    if (activeTool === 'select') {
      brush.deactivate();
      draftCanvas.style.cursor = 'default';
    } else if (activeTool === 'pencil' || activeTool === 'pencil-sketch') {
      brush.activate({ color: activeColor, size: brushSize, thinning: 0.5, smoothing: 0.5, streamline: 0.5 });
    } else if (activeTool === 'pencil-marker') {
      brush.activate({ color: activeColor, size: brushSize * 2, thinning: 0, smoothing: 0.5, streamline: 0.3, opacity: 0.7 });
    } else if (activeTool === 'pencil-highlighter') {
      brush.activate({ color: activeColor, size: brushSize * 3, thinning: 0, smoothing: 0.5, streamline: 0.5, opacity: 0.5, isHighlighter: true });
    } else if (activeTool === 'pencil-neon') {
      brush.activate({ color: activeColor, size: brushSize, thinning: 0.5, smoothing: 0.5, streamline: 0.5, shadow: { blur: brushSize * 3, color: activeColor, offsetX: 0, offsetY: 0 } });
    } else if (activeTool === 'pencil-spray') {
      brush.deactivate();
      draftCanvas.style.cursor = 'crosshair';

      sprayDownHandler = (e: PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        isSprayActive.current = true;
        draftCanvas.setPointerCapture(e.pointerId);
        sprayPos.current = getCanvasPoint(e);

        const sprayLoop = () => {
          if (!isSprayActive.current) return;
          sprayParticles(mainCtx, sprayPos.current.x, sprayPos.current.y, brushSizeRef.current * 3, 15, activeColorRef.current);
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
      };
      draftCanvas.addEventListener('pointerdown', sprayDownHandler);
      draftCanvas.addEventListener('pointermove', sprayMoveHandler);
      draftCanvas.addEventListener('pointerup', sprayUpHandler);
    } else if (activeTool === 'eraser') {
      brush.activate({ color: '#000000', size: brushSize * 2, thinning: 0, smoothing: 0.5, streamline: 0.5, isEraser: true });
    } else if (activeTool === 'fill') {
      brush.deactivate();
      draftCanvas.style.cursor = 'crosshair';
      const fillHandler = (e: PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const pt = getCanvasPoint(e);
        executeFloodFill(mainCtx, Math.round(pt.x), Math.round(pt.y), activeColorRef.current, 32);
      };
      shapeDownHandler = fillHandler;
      draftCanvas.addEventListener('pointerdown', fillHandler);
    } else if (activeTool.startsWith('shape-')) {
      brush.deactivate();
      draftCanvas.style.cursor = 'crosshair';
      const shapeMap: Record<string, ShapeKind> = {
        'shape-rectangle': 'rectangle', 'shape-circle': 'ellipse', 'shape-triangle': 'triangle',
        'shape-diamond': 'diamond', 'shape-star': 'star', 'shape-hexagon': 'hexagon', 'shape-arrow': 'arrow',
      };

      shapeDownHandler = (e: PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        draftCanvas.setPointerCapture(e.pointerId);
        shapeStartPoint.current = getCanvasPoint(e);
        currentShapeKind.current = shapeMap[activeToolRef.current] || 'rectangle';
        isDrawingShape.current = true;
      };
      shapeMoveHandler = (e: PointerEvent) => {
        if (!isDrawingShape.current || !shapeStartPoint.current || !currentShapeKind.current) return;
        e.preventDefault();
        const pt = getCanvasPoint(e);
        const left = Math.min(shapeStartPoint.current.x, pt.x);
        const top = Math.min(shapeStartPoint.current.y, pt.y);
        const w = Math.abs(pt.x - shapeStartPoint.current.x);
        const h = Math.abs(pt.y - shapeStartPoint.current.y);
        draftCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        drawShape(draftCtx, currentShapeKind.current, left, top, w, h, activeColorRef.current, brushSizeRef.current);
      };
      shapeUpHandler = (e: PointerEvent) => {
        if (!isDrawingShape.current || !shapeStartPoint.current || !currentShapeKind.current) return;
        e.preventDefault();
        draftCanvas.releasePointerCapture(e.pointerId);
        const pt = getCanvasPoint(e);
        const left = Math.min(shapeStartPoint.current.x, pt.x);
        const top = Math.min(shapeStartPoint.current.y, pt.y);
        const w = Math.abs(pt.x - shapeStartPoint.current.x);
        const h = Math.abs(pt.y - shapeStartPoint.current.y);
        if (w > 2 && h > 2) {
          drawShape(mainCtx, currentShapeKind.current, left, top, w, h, activeColorRef.current, brushSizeRef.current);
        }
        draftCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        isDrawingShape.current = false;
        shapeStartPoint.current = null;
        currentShapeKind.current = null;
        setActiveTool('select');
      };
      draftCanvas.addEventListener('pointerdown', shapeDownHandler);
      draftCanvas.addEventListener('pointermove', shapeMoveHandler);
      draftCanvas.addEventListener('pointerup', shapeUpHandler);
    }

    return () => {
      if (shapeDownHandler) draftCanvas.removeEventListener('pointerdown', shapeDownHandler);
      if (shapeMoveHandler) draftCanvas.removeEventListener('pointermove', shapeMoveHandler);
      if (shapeUpHandler) draftCanvas.removeEventListener('pointerup', shapeUpHandler);
      if (sprayDownHandler) draftCanvas.removeEventListener('pointerdown', sprayDownHandler);
      if (sprayMoveHandler) draftCanvas.removeEventListener('pointermove', sprayMoveHandler);
      if (sprayUpHandler) draftCanvas.removeEventListener('pointerup', sprayUpHandler);
      if (sprayRafId.current !== null) {
        cancelAnimationFrame(sprayRafId.current);
        sprayRafId.current = null;
      }
    };
  }, [activeTool, activeColor, brushSize, locked, setActiveTool, getCanvasPoint]);

  // ── Cursor ──
  useEffect(() => {
    const cursorCanvas = cursorRef.current;
    const draftCanvas = draftRef.current;
    if (!cursorCanvas || !draftCanvas) return;
    const ctx = cursorCanvas.getContext('2d')!;

    const handleMove = (e: PointerEvent) => {
      const { x, y } = getCanvasPoint(e);
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      const radius = brushSizeRef.current / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = activeToolRef.current === 'eraser' ? 'rgba(255,50,50,0.6)' : 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    };
    const handleLeave = () => ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    draftCanvas.addEventListener('pointermove', handleMove);
    draftCanvas.addEventListener('pointerleave', handleLeave);
    return () => {
      draftCanvas.removeEventListener('pointermove', handleMove);
      draftCanvas.removeEventListener('pointerleave', handleLeave);
    };
  }, [getCanvasPoint]);

  // ── Export canvas as PNG (with white background) ──
  // White must be painted explicitly — canvas pixels are transparent by default.
  // Without this, the PNG sent to Gemini is blank/transparent and scores 0.
  const exportCanvas = useCallback((): string => {
    const canvas = mainRef.current;
    if (!canvas) return '';
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const ctx = offscreen.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    ctx.drawImage(canvas, 0, 0);
    return offscreen.toDataURL('image/png');
  }, []);

  // Expose export method via ref on window
  useEffect(() => {
    (window as any).__gameCanvasExport = exportCanvas;
    return () => { delete (window as any).__gameCanvasExport; };
  }, [exportCanvas]);

  // ── Handle Image Uploads (Edge Detection) ──
  useEffect(() => {
    const handler = (e: Event) => {
      const { dataUrl } = (e as CustomEvent).detail;
      const canvas = mainRef.current;
      if (!canvas || locked) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
      };
      img.src = dataUrl;
    };
    window.addEventListener('image-outline-ready', handler);
    return () => window.removeEventListener('image-outline-ready', handler);
  }, [locked]);

  return (
    <div className="flex items-center justify-center">
      <div
        style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}
        className="relative shadow-2xl flex-shrink-0 rounded-2xl overflow-hidden"
      >
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
          <canvas ref={mainRef} className="absolute inset-0" style={{ zIndex: 1 }} />
          <canvas
            ref={draftRef}
            className={`absolute inset-0 touch-none ${locked ? 'pointer-events-none' : ''}`}
            style={{ zIndex: 2 }}
          />
          <canvas ref={cursorRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }} />
        </div>
      </div>
    </div>
  );
}
