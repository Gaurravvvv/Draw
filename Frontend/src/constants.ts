// src/constants.ts
import { 
  Pencil, 
  Square, 
  Circle, 
  Eraser, 
  MousePointer2, 
  Type,
  Triangle,
  Hexagon,
  ArrowRight,
  Star,
  Diamond,
  Highlighter,
  SprayCan,
  Zap,
  Shapes,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ToolConfig {
  id: string;
  icon: LucideIcon;
  label: string;
  type?: string;
  width?: number;
  opacity?: number;
  variants?: ToolConfig[];
}

export const APP_CONFIG = {
  CANVAS: {
    DEFAULT_WIDTH: 800,
    DEFAULT_HEIGHT: 600,
    BACKGROUND_COLOR: "#FDFBF7", 
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
        type: "freehand",
        variants: [
          { id: "pencil-sketch", icon: Pencil, label: "Sketch", width: 3 },
          { id: "pencil-marker", icon: Highlighter, label: "Marker", width: 10, opacity: 0.7 },
          { id: "pencil-spray", icon: SprayCan, label: "Spray", width: 20 },
          { id: "pencil-neon", icon: Zap, label: "Neon", width: 5 }
        ]
      },
      { 
        id: "shapes", 
        icon: Shapes, 
        label: "Shapes", 
        type: "shape",
        variants: [
          { id: "shape-rectangle", icon: Square, label: "Rectangle" },
          { id: "shape-circle", icon: Circle, label: "Circle" },
          { id: "shape-triangle", icon: Triangle, label: "Triangle" },
          { id: "shape-diamond", icon: Diamond, label: "Diamond" },
          { id: "shape-star", icon: Star, label: "Star" },
          { id: "shape-hexagon", icon: Hexagon, label: "Hexagon" },
          { id: "shape-arrow", icon: ArrowRight, label: "Arrow" },
        ]
      },
      { 
        id: "text", 
        icon: Type, 
        label: "Text", 
        type: "action" 
      },
      { 
        id: "eraser", 
        icon: Eraser, 
        label: "Eraser", 
        type: "freehand", 
        width: 20
      },
    ] as ToolConfig[],
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
} as const;

// Helper to extract all possible tool IDs for TypeScript
export type ToolId = 
  | "select" 
  | "pencil" 
  | "pencil-sketch" 
  | "pencil-marker" 
  | "pencil-spray" 
  | "pencil-neon"
  | "shapes"
  | "shape-rectangle" 
  | "shape-circle" 
  | "shape-triangle" 
  | "shape-diamond" 
  | "shape-star" 
  | "shape-hexagon" 
  | "shape-arrow"
  | "text" 
  | "eraser";