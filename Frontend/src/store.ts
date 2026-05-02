import { create } from 'zustand';
import { APP_CONFIG, type ToolId } from './constants';
import type { TextObject } from './engine/types';

interface UndoAction {
  type: 'add' | 'remove' | 'modify';
  objectData: Record<string, unknown>;
  previousData?: Record<string, unknown>; // For modify: stores pre-modification state
}

interface AppState {
  activeTool: ToolId;
  activeColor: string;
  brushSize: number;
  isConnected: boolean;
  toastMessage: string;
  toastVisible: boolean;
  toastType: 'success' | 'error' | 'info';

  // Q2: Undo/redo actions in store instead of window events
  undoStack: UndoAction[];
  redoStack: UndoAction[];
  undoTrigger: number; // Increment to trigger undo in canvas
  redoTrigger: number; // Increment to trigger redo in canvas

  setActiveTool: (tool: ToolId) => void;
  setActiveColor: (color: string) => void;
  setBrushSize: (size: number) => void;
  setIsConnected: (connected: boolean) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;

  // Undo/Redo
  pushUndo: (action: UndoAction) => void;
  triggerUndo: () => void;
  triggerRedo: () => void;
  popUndo: () => UndoAction | undefined;
  popRedo: () => UndoAction | undefined;
  pushRedo: (action: UndoAction) => void;
  pushUndoRaw: (action: UndoAction) => void;

  // Text Overlay Layer
  texts: TextObject[];
  setTexts: (texts: TextObject[]) => void;
  addText: (text: TextObject) => void;
  updateText: (id: string, updates: Partial<TextObject>) => void;
  removeText: (id: string) => void;
}

export type { UndoAction };

export const useStore = create<AppState>((set, get) => ({
  activeTool: 'pencil', // Default tool
  activeColor: APP_CONFIG.TOOLBAR.PRESET_COLORS[0], // Default Black
  brushSize: APP_CONFIG.TOOLBAR.BRUSH_SETTINGS.DEFAULT_SIZE,
  isConnected: false,
  toastMessage: '',
  toastVisible: false,
  toastType: 'success',

  undoStack: [],
  redoStack: [],
  undoTrigger: 0,
  redoTrigger: 0,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveColor: (color) => set({ activeColor: color }),
  setBrushSize: (size) => set({ brushSize: size }),
  setIsConnected: (connected) => set({ isConnected: connected }),
  showToast: (message, type = 'success') =>
    set({ toastMessage: message, toastVisible: true, toastType: type }),
  hideToast: () => set({ toastVisible: false }),

  // Push action to undo stack, clear redo
  pushUndo: (action) =>
    set((state) => ({
      undoStack: [...state.undoStack, action],
      redoStack: [], // Clear redo on new action
    })),

  // Q2: Trigger undo via store (replaces window CustomEvent)
  triggerUndo: () => set((state) => ({ undoTrigger: state.undoTrigger + 1 })),
  triggerRedo: () => set((state) => ({ redoTrigger: state.redoTrigger + 1 })),

  // Pop from undo stack (used by canvas effect)
  popUndo: () => {
    const state = get();
    if (state.undoStack.length === 0) return undefined;
    const action = state.undoStack[state.undoStack.length - 1];
    set({ undoStack: state.undoStack.slice(0, -1) });
    return action;
  },

  // Pop from redo stack
  popRedo: () => {
    const state = get();
    if (state.redoStack.length === 0) return undefined;
    const action = state.redoStack[state.redoStack.length - 1];
    set({ redoStack: state.redoStack.slice(0, -1) });
    return action;
  },

  // Push to redo stack
  pushRedo: (action) =>
    set((state) => ({
      redoStack: [...state.redoStack, action],
    })),

  // Push to undo stack without clearing redo (used during undo/redo operations)
  pushUndoRaw: (action) =>
    set((state) => ({
      undoStack: [...state.undoStack, action],
    })),

  // Text Overlay Layer
  texts: [],
  setTexts: (texts) => set({ texts }),
  addText: (text) => set((state) => ({ texts: [...state.texts, text] })),
  updateText: (id, updates) =>
    set((state) => ({
      texts: state.texts.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeText: (id) =>
    set((state) => ({
      texts: state.texts.filter((t) => t.id !== id),
    })),
}));