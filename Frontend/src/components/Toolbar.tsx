import { useState } from 'react';
import { useStore } from '../store';
import { APP_CONFIG } from '../constants';
import type { ToolConfig, ToolId } from '../constants';

export const Toolbar = () => {
  const { 
    activeTool, 
    setActiveTool, 
    activeColor, 
    setActiveColor, 
    brushSize, 
    setBrushSize 
  } = useStore();

  const [activePopover, setActivePopover] = useState<string | null>(null);

  const handleToolClick = (tool: ToolConfig) => {
    // If tool has variants, toggle popover
    if (tool.variants) {
      if (activePopover === tool.id) {
        setActivePopover(null);
      } else {
        setActivePopover(tool.id);
      }
    } else {
      // Direct selection for simple tools
      setActiveTool(tool.id as ToolId);
      setActivePopover(null);
    }
  };

  const handleVariantClick = (variantId: string) => {
    setActiveTool(variantId as ToolId);
    setActivePopover(null);
  };

  const isToolActive = (tool: ToolConfig) => {
    if (activeTool === tool.id) return true;
    if (tool.variants) {
      return tool.variants.some(v => v.id === activeTool);
    }
    return false;
  };

  return (
    <div className="fixed top-4 left-4 flex flex-col gap-4 bg-white p-3 rounded-lg shadow-sm border border-paper-border z-50 w-16 items-center">
      
      {/* Tool Icons */}
      <div className="flex flex-col gap-2 w-full relative">
        {APP_CONFIG.TOOLBAR.TOOLS.map((tool) => {
          const isActive = isToolActive(tool);
          
          return (
            <div key={tool.id} className="relative flex items-center group">
              <button
                onClick={() => handleToolClick(tool)}
                className={`p-2 rounded-md transition-all flex justify-center w-full relative ${
                  isActive 
                    ? 'bg-paper-accent text-white' 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                title={tool.label}
              >
                <tool.icon size={20} />
                {tool.variants && (
                  <div className="absolute right-0 bottom-0 text-[8px] leading-none">▼</div>
                )}
              </button>

              {/* Sub-menu Popover */}
              {tool.variants && activePopover === tool.id && (
                <div className="absolute left-full top-0 ml-2 bg-white p-2 rounded-lg shadow-md border border-paper-border flex flex-col gap-1 min-w-[120px]">
                  {tool.variants.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => handleVariantClick(variant.id)}
                      className={`flex items-center gap-2 p-2 rounded text-sm text-left ${
                        activeTool === variant.id
                          ? 'bg-paper-accent/10 text-paper-accent font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <variant.icon size={16} />
                      {variant.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="w-full h-px bg-paper-border" />

      {/* Color Picker */}
      <div className="relative group w-8 h-8 flex-shrink-0">
        <div 
          className="w-full h-full rounded-full border border-paper-border cursor-pointer shadow-sm"
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
          min={APP_CONFIG.TOOLBAR.BRUSH_SETTINGS.MIN_SIZE}
          max={APP_CONFIG.TOOLBAR.BRUSH_SETTINGS.MAX_SIZE}
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