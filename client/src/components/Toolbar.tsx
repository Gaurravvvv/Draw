import { useStore } from '../store';
import { MousePointer2, Pencil, Type, Square, Circle, Eraser } from 'lucide-react';

export const Toolbar = () => {
  const { 
    activeTool, 
    setActiveTool, 
    activeColor, 
    setActiveColor, 
    brushSize, 
    setBrushSize 
  } = useStore();

  const tools = [
    { id: 'select', icon: MousePointer2, label: 'Select' },
    { id: 'pencil', icon: Pencil, label: 'Pencil' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'rectangle', icon: Square, label: 'Square' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
  ] as const;

  return (
    <div className="fixed top-4 left-4 flex flex-col gap-4 bg-white p-3 rounded-lg shadow-sm border border-paper-border z-50 w-14 items-center">
      
      {/* Tool Icons */}
      <div className="flex flex-col gap-2 w-full">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id as any)}
            className={`p-2 rounded-md transition-all flex justify-center ${
              activeTool === tool.id 
                ? 'bg-paper-accent text-white' 
                : 'text-gray-500 hover:bg-gray-100'
            }`}
            title={tool.label}
          >
            <tool.icon size={20} />
          </button>
        ))}
      </div>

      <div className="w-full h-px bg-paper-border" />

      {/* Color Picker */}
      <div className="relative group w-8 h-8">
        <div 
          className="w-full h-full rounded-full border border-paper-border cursor-pointer"
          style={{ backgroundColor: activeColor }}
        />
        <input 
          type="color"
          value={activeColor}
          onChange={(e) => setActiveColor(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </div>

      {/* Brush Size Slider */}
      <div className="flex flex-col items-center gap-1 w-full pt-2">
        <input
          type="range"
          min={1}
          max={50}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="h-20 w-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          style={{ writingMode: 'vertical-lr', WebkitAppearance: 'slider-vertical' }}
          title={`Size: ${brushSize}px`}
        />
      </div>

    </div>
  );
};