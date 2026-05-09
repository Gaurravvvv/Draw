/**
 * useRasterUndo — Snapshot-based undo/redo engine for the raster canvas
 *
 * Architecture:
 *   Before each stroke bake: capture a compressed WebP snapshot of mainCanvas
 *   On Undo: restore the previous snapshot, push current state to redo
 *   On Redo: restore the redo snapshot, push current state to undo
 *
 * Memory budget: ~30 WebP snapshots × ~200KB–1MB each = 6–30MB
 * Hard cap: MAX_UNDO_DEPTH = 30 entries
 *
 * This hook is completely decoupled from Fabric.js.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SnapshotEntry {
  /** Compressed canvas snapshot as a WebP Blob */
  blob: Blob;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_UNDO_DEPTH = 30;

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseRasterUndoOptions {
  mainCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  logicalW?: number;
  logicalH?: number;
}

export function useRasterUndo({ mainCanvasRef }: UseRasterUndoOptions) {
  const undoStackRef = useRef<SnapshotEntry[]>([]);
  const redoStackRef = useRef<SnapshotEntry[]>([]);
  const isRestoringRef = useRef(false);

  // ── Snapshot Capture ────────────────────────────────────────────────────────

  /**
   * Capture the current mainCanvas state as a compressed WebP Blob.
   * This is fast — toBlob runs asynchronously and doesn't block the UI thread.
   */
  const captureSnapshot = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = mainCanvasRef.current;
      if (!canvas) return reject(new Error('No canvas'));

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('toBlob returned null'));
        },
        'image/webp',
        0.8, // Quality factor — good balance of speed vs. size
      );
    });
  }, [mainCanvasRef]);

  /**
   * Restore a snapshot Blob onto the main canvas.
   * Uses createImageBitmap for GPU-accelerated decoding.
   */
  const restoreSnapshot = useCallback(async (blob: Blob) => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    const bitmap = await createImageBitmap(blob);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset any DPR transform
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    ctx.restore();

    bitmap.close(); // Free GPU memory
  }, [mainCanvasRef]);

  // ── Pre-Bake Snapshot (called BEFORE each stroke is baked) ──────────────────

  /**
   * Call this BEFORE baking a stroke onto mainCanvas.
   * It captures the current state so we can undo back to it.
   */
  const pushSnapshot = useCallback(async () => {
    if (isRestoringRef.current) return; // Don't push during undo/redo operations

    try {
      const blob = await captureSnapshot();

      undoStackRef.current.push({ blob });

      // Enforce memory cap — evict oldest entries
      while (undoStackRef.current.length > MAX_UNDO_DEPTH) {
        undoStackRef.current.shift();
      }

      // Clear redo stack on new action (standard undo/redo behavior)
      redoStackRef.current = [];
    } catch (err) {
      console.warn('[useRasterUndo] snapshot capture failed:', err);
    }
  }, [captureSnapshot]);

  // ── Undo ────────────────────────────────────────────────────────────────────

  const performUndo = useCallback(async () => {
    if (undoStackRef.current.length === 0) return;

    isRestoringRef.current = true;

    try {
      // Capture current state for redo
      const currentBlob = await captureSnapshot();
      redoStackRef.current.push({ blob: currentBlob });

      // Pop and restore previous state
      const entry = undoStackRef.current.pop()!;
      await restoreSnapshot(entry.blob);
    } catch (err) {
      console.warn('[useRasterUndo] undo failed:', err);
    } finally {
      isRestoringRef.current = false;
    }
  }, [captureSnapshot, restoreSnapshot]);

  // ── Redo ────────────────────────────────────────────────────────────────────

  const performRedo = useCallback(async () => {
    if (redoStackRef.current.length === 0) return;

    isRestoringRef.current = true;

    try {
      // Capture current state for undo
      const currentBlob = await captureSnapshot();
      undoStackRef.current.push({ blob: currentBlob });

      // Pop and restore redo state
      const entry = redoStackRef.current.pop()!;
      await restoreSnapshot(entry.blob);
    } catch (err) {
      console.warn('[useRasterUndo] redo failed:', err);
    } finally {
      isRestoringRef.current = false;
    }
  }, [captureSnapshot, restoreSnapshot]);

  // ── Listen for Zustand trigger changes ──────────────────────────────────────
  // Disabling local snapshot undo/redo in favor of the multiplayer server-based replay
  // The useRasterSocket hook now listens to these triggers and handles user-scoped undo via the backend.
  useEffect(() => {
    // Disabled intentionally to prevent local snapshot undo from erasing other users' drawings.
  }, []);

  // ── Return the pushSnapshot function for the component to call ──────────────

  return {
    /** Call this BEFORE baking any stroke onto mainCanvas */
    pushSnapshot,
    /** Current undo depth (for UI indicators if needed) */
    get undoDepth() { return undoStackRef.current.length; },
    /** Current redo depth */
    get redoDepth() { return redoStackRef.current.length; },
  };
}
