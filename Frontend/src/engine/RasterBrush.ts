/**
 * RasterBrush — Pressure-sensitive drawing engine for raw HTML5 Canvas 2D
 *
 * Architecture (Fabric.js-FREE):
 *   pointerdown → accumulate [x, y, pressure] → perfect-freehand → rAF draft render
 *   pointerup   → bake final path onto mainCanvas → callback to parent
 *
 * This class operates entirely outside React's render cycle.
 * No useState, no Zustand, no re-renders during an active stroke.
 */

import getStroke from 'perfect-freehand';
import type { BrushOptions, PointWithPressure, StrokeCompletePayload } from './types';

// ─── SVG Path Helpers ─────────────────────────────────────────────────────────

/**
 * Convert a polygon of [x,y] points (from perfect-freehand) to an SVG path `d` string
 * using quadratic bezier curves for smooth rendering.
 */
function getSvgPathFromStroke(points: number[][]): string {
  if (points.length === 0) return '';

  const len = points.length;

  // Single point → draw a tiny dot
  if (len < 3) {
    const [x, y] = points[0];
    return `M ${x} ${y} L ${x + 0.01} ${y + 0.01} Z`;
  }

  let d = `M ${points[0][0]} ${points[0][1]} `;

  // Quadratic bezier through midpoints
  for (let i = 0; i < len - 1; i++) {
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const mx = (cx + nx) / 2;
    const my = (cy + ny) / 2;
    d += `Q ${cx} ${cy} ${mx} ${my} `;
  }

  d += 'Z';
  return d;
}

// ─── RasterBrush Class ────────────────────────────────────────────────────────

export class RasterBrush {
  // Canvas contexts
  private draftCanvas: HTMLCanvasElement;
  private draftCtx: CanvasRenderingContext2D;
  private mainCtx: CanvasRenderingContext2D;

  // Logical canvas dimensions (before DPR scaling)
  private logicalW: number;
  private logicalH: number;


  // Active stroke state (mutable, no React)
  private inputPoints: PointWithPressure[] = [];
  private isDrawing = false;
  private dirty = false;
  private rafId: number | null = null;
  private currentOptions: BrushOptions | null = null;
  private isActive = false;

  // Cached last SVG path + Path2D for bake
  private lastSvgPath = '';
  private lastPath2D: Path2D | null = null;

  // ── Callbacks ──

  /** Fired on pointerup with the final path data + raw points */
  public onStrokeComplete: ((payload: StrokeCompletePayload) => void) | null = null;

  /** Fired BEFORE the stroke is baked onto mainCanvas — used for undo snapshot capture */
  public onBeforeBake: (() => void) | null = null;

  /** Fired during pointermove — used for live socket streaming */
  public onPointEmit: ((point: { x: number; y: number; pressure: number }) => void) | null = null;

  /** Fired on pointerdown — used to start a live stroke stream */
  public onStrokeStart: ((point: { x: number; y: number; pressure: number }) => void) | null = null;

  // ── Bound handlers ──
  private handlePointerDown: (e: PointerEvent) => void;
  private handlePointerMove: (e: PointerEvent) => void;
  private handlePointerUp: (e: PointerEvent) => void;

  constructor(
    draftCanvas: HTMLCanvasElement,
    mainCanvas: HTMLCanvasElement,
    logicalW: number,
    logicalH: number,
  ) {
    this.draftCanvas = draftCanvas;
    this.draftCtx = draftCanvas.getContext('2d')!;
    this.mainCtx = mainCanvas.getContext('2d')!;
    this.logicalW = logicalW;
    this.logicalH = logicalH;

    // Pre-bind handlers
    this.handlePointerDown = this._onPointerDown.bind(this);
    this.handlePointerMove = this._onPointerMove.bind(this);
    this.handlePointerUp = this._onPointerUp.bind(this);
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Activate the brush. Attaches pointer listeners to the draft canvas. */
  activate(options: BrushOptions): void {
    if (this.isActive) this.deactivate();

    this.currentOptions = options;
    this.isActive = true;

    this.draftCanvas.style.cursor = 'crosshair';

    this.draftCanvas.addEventListener('pointerdown', this.handlePointerDown);
    this.draftCanvas.addEventListener('pointermove', this.handlePointerMove);
    this.draftCanvas.addEventListener('pointerup', this.handlePointerUp);
    this.draftCanvas.addEventListener('pointerleave', this.handlePointerUp);
  }

  /** Deactivate the brush. Removes listeners, cancels rAF, clears draft. */
  deactivate(): void {
    if (!this.isActive) return;
    this.isActive = false;

    this.draftCanvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.draftCanvas.removeEventListener('pointermove', this.handlePointerMove);
    this.draftCanvas.removeEventListener('pointerup', this.handlePointerUp);
    this.draftCanvas.removeEventListener('pointerleave', this.handlePointerUp);

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this._clearDraft();
    this.currentOptions = null;
    this.inputPoints = [];
    this.isDrawing = false;
    this.dirty = false;
  }

  /** Update brush options without deactivating */
  updateOptions(options: Partial<BrushOptions>): void {
    if (this.currentOptions) {
      this.currentOptions = { ...this.currentOptions, ...options };
    }
  }

  /** Get a read-only copy of current brush options */
  getCurrentOptions(): BrushOptions | null {
    return this.currentOptions ? { ...this.currentOptions } : null;
  }

  // ─── Pointer Event Handlers ─────────────────────────────────────────────────

  private _onPointerDown(e: PointerEvent): void {
    if (!this.isActive || !this.currentOptions) return;
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    this.isDrawing = true;
    this.inputPoints = [];
    this.lastSvgPath = '';
    this.lastPath2D = null;

    this.draftCanvas.setPointerCapture(e.pointerId);

    const { x, y, pressure } = this._getCanvasPoint(e);
    this.inputPoints.push([x, y, pressure]);
    this.dirty = true;

    this._startRenderLoop();
    this.onStrokeStart?.({ x, y, pressure });
  }

  private _onPointerMove(e: PointerEvent): void {
    if (!this.isDrawing || !this.isActive) return;

    e.preventDefault();
    e.stopPropagation();

    const { x, y, pressure } = this._getCanvasPoint(e);
    this.inputPoints.push([x, y, pressure]);
    this.dirty = true;

    this.onPointEmit?.({ x, y, pressure });
  }

  private _onPointerUp(e: PointerEvent): void {
    if (!this.isDrawing || !this.isActive) return;

    e.preventDefault();
    e.stopPropagation();

    this.isDrawing = false;
    this.draftCanvas.releasePointerCapture(e.pointerId);

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Final render to get the complete path
    this._renderStroke();

    // ── BAKE onto main canvas ──
    if (this.lastPath2D && this.currentOptions) {
      // Notify undo system BEFORE baking
      this.onBeforeBake?.();

      const opts = this.currentOptions;
      this.mainCtx.save();

      if (opts.isEraser) {
        this.mainCtx.globalCompositeOperation = 'destination-out';
        this.mainCtx.fillStyle = 'rgba(0,0,0,1)';
      } else if (opts.isHighlighter) {
        this.mainCtx.globalCompositeOperation = 'multiply';
        this.mainCtx.fillStyle = opts.color;
        this.mainCtx.globalAlpha = opts.opacity ?? 0.5;
      } else {
        this.mainCtx.globalCompositeOperation = 'source-over';
        this.mainCtx.fillStyle = opts.color;
        this.mainCtx.globalAlpha = opts.opacity ?? 1;

        if (opts.shadow) {
          this.mainCtx.shadowColor = opts.shadow.color;
          this.mainCtx.shadowBlur = opts.shadow.blur;
          this.mainCtx.shadowOffsetX = opts.shadow.offsetX ?? 0;
          this.mainCtx.shadowOffsetY = opts.shadow.offsetY ?? 0;
        }
      }

      this.mainCtx.fill(this.lastPath2D);
      this.mainCtx.restore();
    }

    // Clear draft
    this._clearDraft();

    // Emit stroke complete
    if (this.lastSvgPath && this.currentOptions) {
      this.onStrokeComplete?.({
        pathData: this.lastSvgPath,
        options: { ...this.currentOptions },
        inputPoints: [...this.inputPoints],
      });
    }

    // Reset
    this.inputPoints = [];
    this.lastSvgPath = '';
    this.lastPath2D = null;
    this.dirty = false;
  }

  // ─── Coordinate Transform ───────────────────────────────────────────────────

  /**
   * Convert PointerEvent client coordinates to logical canvas coordinates,
   * accounting for CSS transform: scale() on the viewport wrapper.
   */
  private _getCanvasPoint(e: PointerEvent): { x: number; y: number; pressure: number } {
    const rect = this.draftCanvas.getBoundingClientRect();
    // getBoundingClientRect already accounts for CSS transforms,
    // so we can directly compute the ratio
    const x = (e.clientX - rect.left) * (this.logicalW / rect.width);
    const y = (e.clientY - rect.top) * (this.logicalH / rect.height);

    return {
      x,
      y,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  // ─── Render Loop ────────────────────────────────────────────────────────────

  private _startRenderLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    const loop = () => {
      if (!this.isActive || !this.isDrawing) {
        this.rafId = null;
        return;
      }

      if (this.dirty) {
        this._renderStroke();
        this.dirty = false;
      }

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private _renderStroke(): void {
    if (!this.currentOptions || this.inputPoints.length === 0) return;

    try {
      const opts = this.currentOptions;

      // Run perfect-freehand
      const outlinePoints = getStroke(this.inputPoints, {
        size: opts.size,
        thinning: opts.thinning,
        smoothing: opts.smoothing,
        streamline: opts.streamline,
        simulatePressure: false,
        start: { taper: 0, cap: true },
        end: { taper: opts.size * 0.25, cap: true },
      });

      const svgPath = getSvgPathFromStroke(outlinePoints);
      this.lastSvgPath = svgPath;
      this.lastPath2D = new Path2D(svgPath);

      // Clear draft canvas
      this._clearDraft();

      // Draw preview on draft canvas
      const ctx = this.draftCtx;
      ctx.save();

      if (opts.isEraser) {
        // Eraser preview: semi-transparent red overlay
        ctx.fillStyle = 'rgba(255, 50, 50, 0.35)';
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      } else if (opts.isHighlighter) {
        // Highlighter preview: use multiply
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = opts.color;
        ctx.globalAlpha = opts.opacity ?? 0.5;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = opts.color;
        ctx.globalAlpha = opts.opacity ?? 1;

        if (opts.shadow) {
          ctx.shadowColor = opts.shadow.color;
          ctx.shadowBlur = opts.shadow.blur;
          ctx.shadowOffsetX = opts.shadow.offsetX ?? 0;
          ctx.shadowOffsetY = opts.shadow.offsetY ?? 0;
        }
      }

      ctx.fill(this.lastPath2D);
      ctx.restore();
    } catch (err) {
      console.warn('[RasterBrush] render error:', err);
    }
  }

  private _clearDraft(): void {
    this.draftCtx.clearRect(0, 0, this.logicalW, this.logicalH);
  }

  // ─── Static: Replay a stroke command onto a canvas ──────────────────────────

  /**
   * Replay a StrokeCommand onto any canvas context.
   * Used by remote clients and room-load to reconstruct strokes.
   */
  static replayStroke(
    ctx: CanvasRenderingContext2D,
    points: PointWithPressure[],
    opts: BrushOptions,
  ): void {
    if (points.length === 0) return;

    const outlinePoints = getStroke(points, {
      size: opts.size,
      thinning: opts.thinning,
      smoothing: opts.smoothing,
      streamline: opts.streamline,
      simulatePressure: false,
      start: { taper: 0, cap: true },
      end: { taper: opts.size * 0.25, cap: true },
    });

    const svgPath = getSvgPathFromStroke(outlinePoints);
    if (!svgPath) return;

    const path2d = new Path2D(svgPath);

    ctx.save();

    if (opts.isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else if (opts.isHighlighter) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = opts.color;
      ctx.globalAlpha = opts.opacity ?? 0.5;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = opts.color;
      ctx.globalAlpha = opts.opacity ?? 1;

      if (opts.shadow) {
        ctx.shadowColor = opts.shadow.color;
        ctx.shadowBlur = opts.shadow.blur;
        ctx.shadowOffsetX = opts.shadow.offsetX ?? 0;
        ctx.shadowOffsetY = opts.shadow.offsetY ?? 0;
      }
    }

    ctx.fill(path2d);
    ctx.restore();
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────────

  dispose(): void {
    this.deactivate();
    this.onStrokeComplete = null;
    this.onBeforeBake = null;
    this.onPointEmit = null;
    this.onStrokeStart = null;
  }
}
