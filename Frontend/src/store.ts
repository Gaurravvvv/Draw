import { create } from 'zustand';
import { APP_CONFIG, type ToolId } from './constants';

interface AppState {
  activeTool: ToolId;
  activeColor: string;
  brushSize: number;
  isConnected: boolean;
  toastMessage: string;
  toastVisible: boolean;
  toastType: 'success' | 'error' | 'info';

  setActiveTool: (tool: ToolId) => void;
  setActiveColor: (color: string) => void;
  setBrushSize: (size: number) => void;
  setIsConnected: (connected: boolean) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
}

export const useStore = create<AppState>((set) => ({
  activeTool: 'pencil', // Default tool
  activeColor: APP_CONFIG.TOOLBAR.PRESET_COLORS[0], // Default Black
  brushSize: APP_CONFIG.TOOLBAR.BRUSH_SETTINGS.DEFAULT_SIZE,
  isConnected: false,
  toastMessage: '',
  toastVisible: false,
  toastType: 'success',

  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveColor: (color) => set({ activeColor: color }),
  setBrushSize: (size) => set({ brushSize: size }),
  setIsConnected: (connected) => set({ isConnected: connected }),
  showToast: (message, type = 'success') =>
    set({ toastMessage: message, toastVisible: true, toastType: type }),
  hideToast: () => set({ toastVisible: false }),
}));