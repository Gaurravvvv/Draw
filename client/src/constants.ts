// src/constants.ts
import { 
  Pencil, 
  Square, 
  Circle, 
  Eraser, 
  MousePointer2, 
  Type 
} from 'lucide-react';

export const APP_CONFIG = {
  CANVAS: {
    DEFAULT_WIDTH: 800,
    DEFAULT_HEIGHT: 600,
    BACKGROUND_COLOR: "#ffffff",
  },
  TOOLBAR: {
    TOOLS: [
      { 
        id: "select", 
        icon: MousePointer2, 
        label: "Select", 
        type: "action" 
      },
      { 
        id: "pencil", 
        icon: Pencil, 
        label: "Pencil", 
        type: "freehand" 
      },
      { 
        id: "text", 
        icon: Type, 
        label: "Text", 
        type: "action" 
      },
      { 
        id: "rectangle", 
        icon: Square, 
        label: "Rectangle", 
        type: "shape" 
      },
      { 
        id: "circle", 
        icon: Circle, 
        label: "Circle", 
        type: "shape" 
      },
      { 
        id: "eraser", 
        icon: Eraser, 
        label: "Eraser", 
        type: "action" 
      },
    ],
    PRESET_COLORS: [
      "#000000", // Black
      "#ef4444", // Red
      "#3b82f6", // Blue
      "#22c55e", // Green
      "#eab308", // Yellow
      "#8b5cf6", // Violet (Brand Color)
      "#f97316", // Orange
      "#ec4899", // Pink
    ],
    BRUSH_SETTINGS: {
      MIN_SIZE: 1,
      MAX_SIZE: 50,
      DEFAULT_SIZE: 5,
    }
  }
} as const; // "as const" makes these values read-only literals

// Export a Type for the Tool IDs so TypeScript helps you auto-complete
export type ToolId = "select" | "pencil" | "text" | "rectangle" | "circle" | "eraser";