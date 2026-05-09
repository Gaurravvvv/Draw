import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { APP_CONFIG } from '../constants';
import type { ToolConfig, ToolId } from '../constants';
import { Undo2, Redo2, Download, Volume2, VolumeX } from 'lucide-react';
import { imageToOutline } from '../engine/imageToOutline';
import { playClick, playPop, playSuccess, toggleMute, getMuted } from '../engine/audio';
import { ColorPicker } from './ColorPicker';

export const Toolbar = () => {
  const {
    activeTool,
    setActiveTool,
    activeColor,
    setActiveColor,
    brushSize,
    setBrushSize,
    triggerUndo,
    triggerRedo,
    triggerExport,
  } = useStore();

  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [muted, setMuted] = useState(getMuted());
  const [showColorPicker, setShowColorPicker] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActivePopover(null);
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToolClick = (tool: ToolConfig) => {
    if (tool.id === 'image-upload') {
      fileInputRef.current?.click();
      return;
    }
    playClick();
    if (tool.variants) {
      if (activePopover === tool.id) {
        setActivePopover(null);
      } else {
        setActivePopover(tool.id);
      }
    } else {
      setActiveTool(tool.id as ToolId);
      setActivePopover(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const outlineDataUrl = await imageToOutline(file, 1920, 1080, 30);
      window.dispatchEvent(new CustomEvent('image-outline-ready', { detail: { dataUrl: outlineDataUrl } }));
      playSuccess();
    } catch {
      // Failed silently
    }

    e.target.value = '';
  };

  const handleVariantClick = (variantId: string) => {
    playClick();
    setActiveTool(variantId as ToolId);
    setActivePopover(null);
  };

  const isToolActive = (tool: ToolConfig) => {
    if (activeTool === tool.id) return true;
    if (tool.variants) {
      return tool.variants.some((v) => v.id === activeTool);
    }
    return false;
  };

  return (
    <div
      ref={toolbarRef}
      className="fixed bottom-4 left-4 right-4 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:left-6 md:right-auto flex flex-row md:flex-col gap-2 md:gap-3 bg-white p-2 md:p-3 rounded-2xl shadow-lg border border-paper-border z-50 md:w-16 items-center flex-wrap md:flex-nowrap justify-center"
    >
      {/* Tool Icons */}
      <div className="flex flex-row md:flex-col gap-1 md:gap-2 relative flex-shrink-0 flex-wrap justify-center">
        {APP_CONFIG.TOOLBAR.TOOLS.map((tool) => {
          const isActive = isToolActive(tool);

          return (
            <div key={tool.id} className="relative flex items-center group">
              <button
                onClick={() => handleToolClick(tool)}
                className={`p-2 rounded-xl transition-all flex justify-center w-full relative ${isActive
                    ? 'bg-paper-accent text-white shadow-md shadow-paper-accent/30'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
                <div className="absolute bottom-full left-0 mb-2 md:bottom-auto md:left-full md:top-0 md:mb-0 md:ml-2 bg-white p-2 rounded-lg shadow-md border border-paper-border flex flex-col gap-1 min-w-[120px] z-50">
                  {tool.variants.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => handleVariantClick(variant.id)}
                      className={`flex items-center gap-2 p-2 rounded text-sm text-left ${activeTool === variant.id
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

      <div className="hidden md:block w-full h-px bg-gray-200 flex-shrink-0" />

      {/* Undo / Redo */}
      <div className="flex flex-row md:flex-col gap-2 flex-shrink-0">
        <button
          onClick={() => { playPop(); triggerUndo(); }}
          className="flex-1 p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-xl transition-all flex justify-center"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={18} />
        </button>
        <button
          onClick={() => { playPop(); triggerRedo(); }}
          className="flex-1 p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-xl transition-all flex justify-center"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={18} />
        </button>
      </div>

      <div className="hidden md:block w-full h-px bg-gray-200 flex-shrink-0" />

      <button
        onClick={() => { playSuccess(); triggerExport(); }}
        className="p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-xl transition-all flex justify-center flex-shrink-0"
        title="Download Image"
      >
        <Download size={18} />
      </button>

      <button
        onClick={() => { setMuted(toggleMute()); }}
        className="p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-xl transition-all flex justify-center flex-shrink-0"
        title={muted ? 'Unmute Sounds' : 'Mute Sounds'}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/gif, image/webp"
        onChange={handleImageUpload}
        className="hidden"
      />

      <div className="hidden md:block w-full h-px bg-gray-200 flex-shrink-0" />

      {/* Color Picker */}
      <div className="relative flex-shrink-0 w-full flex justify-center">
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="w-8 h-8 rounded-full border-2 border-gray-200 cursor-pointer shadow-sm hover:scale-110 transition-transform"
          style={{ backgroundColor: activeColor }}
          title="Pick Color"
        />
        {showColorPicker && (
          <div className="absolute bottom-full left-0 mb-2 md:bottom-auto md:left-full md:top-0 md:mb-0 md:ml-4 z-50">
            <ColorPicker
              activeColor={activeColor}
              onColorSelect={setActiveColor}
              onClose={() => setShowColorPicker(false)}
            />
          </div>
        )}
      </div>

      {/* Brush Size Slider */}
      <div className="flex flex-row md:flex-col items-center justify-center gap-1 flex-shrink-0 px-1 md:px-0">
        <input
          type="range"
          min={APP_CONFIG.TOOLBAR.BRUSH_SETTINGS.MIN_SIZE}
          max={APP_CONFIG.TOOLBAR.BRUSH_SETTINGS.MAX_SIZE}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-16 h-1 md:h-16 md:w-1 bg-gray-200 rounded-lg appearance-none cursor-pointer hidden md:block"
          style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
          title={`Size: ${brushSize}px`}
        />
        <input
          type="range"
          min={APP_CONFIG.TOOLBAR.BRUSH_SETTINGS.MIN_SIZE}
          max={APP_CONFIG.TOOLBAR.BRUSH_SETTINGS.MAX_SIZE}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-16 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer block md:hidden"
          title={`Size: ${brushSize}px`}
        />
      </div>
    </div>
  );
};