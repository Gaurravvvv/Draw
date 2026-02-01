import { create } from 'zustand';
import { APP_CONFIG, type ToolId } from './constants';

interface AppState {
  activeTool: ToolId;
  activeColor: string;
  brushSize: number;
  setActiveTool: (tool: ToolId) => void;
  setActiveColor: (color: string) => void;
  setBrushSize: (size: number) => void;
}

export const useStore = create<AppState>((set) => ({
  activeTool: 'pencil', // Default tool
  activeColor: APP_CONFIG.TOOLBAR.PRESET_COLORS[0], // Default Black
  brushSize: APP_CONFIG.TOOLBAR.BRUSH_SETTINGS.DEFAULT_SIZE,
  
  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveColor: (color) => set({ activeColor: color }),
  setBrushSize: (size) => set({ brushSize: size }),
}));