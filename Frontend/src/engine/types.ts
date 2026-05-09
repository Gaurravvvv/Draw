/**
 * Raster Engine — Shared Type Definitions
 *
 * These types are used across the raster brush, shapes, socket sync,
 * undo/redo, and persistence layers. Zero Fabric.js dependencies.
 */

import type { ToolId } from '../constants';

// ─── Brush Options ────────────────────────────────────────────────────────────

export interface BrushOptions {
  /** Stroke color (CSS color string) */
  color: string;
  /** Base brush size in px */
  size: number;
  /** Thinning factor: 0 = uniform width, 0.5 = moderate pressure response */
  thinning: number;
  /** Smoothing factor for bezier interpolation (0–1) */
  smoothing: number;
  /** Streamline factor for input smoothing (0–1) */
  streamline: number;
  /** Optional alpha multiplier (0–1). Defaults to 1. */
  opacity?: number;
  /** If true, the brush acts as a true eraser using destination-out */
  isEraser?: boolean;
  /** If true, the brush acts as a highlighter using multiply compositing */
  isHighlighter?: boolean;
  /** Optional shadow/glow config (used by Neon brush) */
  shadow?: {
    color: string;
    blur: number;
    offsetX?: number;
    offsetY?: number;
  };
}

// ─── Point Types ──────────────────────────────────────────────────────────────

/** Raw input point with pressure: [x, y, pressure] */
export type PointWithPressure = [x: number, y: number, pressure: number];

/** Simple 2D point */
export interface Point2D {
  x: number;
  y: number;
}

// ─── Object Overlay Layer (Text) ─────────────────────────────────────────────

export interface TextObject {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  isEditing?: boolean; // Local UI state only, not synced
}

// ─── Stroke Command (for sync + persistence) ─────────────────────────────────

export interface StrokeCommand {
  type: 'stroke';
  id: string;
  tool: ToolId;
  color: string;
  size: number;
  opacity: number;
  /** Flat array: [x, y, pressure, x, y, pressure, ...] */
  points: number[];
  /** For shapes only */
  shape?: {
    kind: 'rectangle' | 'ellipse' | 'triangle' | 'diamond' | 'star' | 'hexagon' | 'arrow';
    x: number;
    y: number;
    w: number;
    h: number;
  };
  /** For text only */
  text?: {
    content: string;
    x: number;
    y: number;
    fontSize: number;
    fontFamily: string;
  };
  /** Shadow/glow config if present */
  shadow?: BrushOptions['shadow'];
  /** Was this an eraser stroke? */
  isEraser?: boolean;
  /** Was this a highlighter stroke? */
  isHighlighter?: boolean;
}

// ─── Draw Events (socket payloads) ────────────────────────────────────────────

export interface DrawEventStroke {
  type: 'stroke';
  stroke: StrokeCommand;
}

export interface DrawEventFill {
  type: 'fill';
  point: { x: number; y: number };
  color: string;
  tolerance: number;
}

export interface DrawEventUndo {
  type: 'undo';
}

export interface DrawEventRedo {
  type: 'redo';
}

export interface DrawEventClear {
  type: 'clear';
}

export interface DrawEventImage {
  type: 'image';
  dataUrl: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type DrawEvent = DrawEventStroke | DrawEventUndo | DrawEventRedo | DrawEventClear | DrawEventFill | DrawEventImage;

// ─── Live Stroke Events (transient socket payloads) ───────────────────────────

export interface StrokeLiveStart {
  type: 'start';
  strokeId: string;
  tool: ToolId;
  color: string;
  size: number;
  opacity: number;
  isEraser?: boolean;
  isHighlighter?: boolean;
  point: { x: number; y: number; pressure: number };
}

export interface StrokeLiveMove {
  type: 'move';
  strokeId: string;
  point: { x: number; y: number; pressure: number };
}

export interface StrokeLiveEnd {
  type: 'end';
  strokeId: string;
}

export type StrokeLiveEvent = StrokeLiveStart | StrokeLiveMove | StrokeLiveEnd;

// ─── Undo Entry ───────────────────────────────────────────────────────────────

export interface UndoEntry {
  /** Compressed snapshot of mainCanvas BEFORE the stroke was baked */
  snapshot: Blob;
  /** The stroke command (kept for redo replay and network sync) */
  command: StrokeCommand;
}

// ─── Stroke Complete Payload (internal callback) ──────────────────────────────

export interface StrokeCompletePayload {
  /** SVG `d` attribute for the filled path */
  pathData: string;
  /** The brush options used for this stroke */
  options: BrushOptions;
  /** Raw input points for network sync */
  inputPoints: PointWithPressure[];
}
