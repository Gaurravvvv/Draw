import { useCallback } from 'react';

interface UseRasterUndoOptions {
  mainCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  logicalW?: number;
  logicalH?: number;
}

export function useRasterUndo({}: UseRasterUndoOptions) {
  const pushSnapshot = useCallback(async () => {
    // Disabled: local snapshot undo/redo is replaced by the multiplayer command log replay system.
    // We bypass canvas.toBlob WebP compression to save CPU/memory on mobile.
    return;
  }, []);

  return {
    pushSnapshot,
    get undoDepth() { return 0; },
    get redoDepth() { return 0; },
  };
}
