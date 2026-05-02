import { useState, useRef, useEffect } from 'react';
import type { TextObject } from '../engine/types';
import { Trash2 } from 'lucide-react';

interface DraggableTextProps {
  textObj: TextObject;
  onUpdate: (id: string, updates: Partial<TextObject>) => void;
  onDelete: (id: string) => void;
  scale: number;
}

export const DraggableText = ({ textObj, onUpdate, onDelete, scale }: DraggableTextProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isScaling, setIsScaling] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(textObj.isEditing || false);
  
  const pos = useRef({ x: textObj.x, y: textObj.y });
  const dragStart = useRef({ x: 0, y: 0 });
  const scaleStart = useRef({ y: 0, fontSize: 16 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Focus on creation if editing
  useEffect(() => {
    if (textObj.isEditing && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [textObj.isEditing]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Don't drag if we are actively editing
    if (isFocused) return;
    
    e.stopPropagation();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - pos.current.x * scale,
      y: e.clientY - pos.current.y * scale,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.stopPropagation();
    
    // Calculate new position
    const newX = (e.clientX - dragStart.current.x) / scale;
    const newY = (e.clientY - dragStart.current.y) / scale;
    
    pos.current = { x: newX, y: newY };
    
    // Apply locally immediately for smoothness
    if (wrapperRef.current) {
      wrapperRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.stopPropagation();
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    // Sync position
    onUpdate(textObj.id, { x: pos.current.x, y: pos.current.y });
  };

  const handleScalePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsScaling(true);
    scaleStart.current = {
      y: e.clientY,
      fontSize: textObj.fontSize || 16,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleScalePointerMove = (e: React.PointerEvent) => {
    if (!isScaling) return;
    e.stopPropagation();
    
    // Calculate vertical drag difference to determine new font size
    const diffY = (e.clientY - scaleStart.current.y) / scale;
    // For every 1px dragged diagonally/down, scale up a bit
    const newFontSize = Math.max(12, scaleStart.current.fontSize + diffY * 0.8);
    
    // Sync size immediately so the box grows dynamically
    onUpdate(textObj.id, { fontSize: newFontSize });
  };

  const handleScalePointerUp = (e: React.PointerEvent) => {
    if (!isScaling) return;
    e.stopPropagation();
    setIsScaling(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate(textObj.id, { content: e.target.value });
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isFocused) {
      e.stopPropagation();
      setIsFocused(true);
      // Wait a tick for pointerEvents to update before focusing
      setTimeout(() => textAreaRef.current?.focus(), 0);
    }
  };

  return (
    <div
      ref={wrapperRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        transform: `translate(${textObj.x}px, ${textObj.y}px)`,
        zIndex: isFocused || isDragging ? 50 : 10,
        cursor: isDragging ? 'grabbing' : (isFocused ? 'text' : 'grab'),
      }}
      className="group"
    >
      {/* Delete Button (Visible on Hover/Focus) */}
      {(isHovered || isFocused) && !isScaling && (
        <button
          className="absolute -top-4 -right-4 p-1 bg-white border border-gray-200 rounded-full shadow-sm text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors z-20"
          onPointerDown={(e) => { e.stopPropagation(); }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(textObj.id);
          }}
        >
          <Trash2 size={14} />
        </button>
      )}

      {/* Scale Handle (Visible on Hover/Focus) */}
      {(isHovered || isFocused) && (
        <div
          className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-se-resize shadow-sm z-30 flex items-center justify-center hover:scale-110 transition-transform"
          onPointerDown={handleScalePointerDown}
          onPointerMove={handleScalePointerMove}
          onPointerUp={handleScalePointerUp}
          onPointerCancel={handleScalePointerUp}
        >
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full pointer-events-none" />
        </div>
      )}

      {/* Container handles dragging when not focused */}
      <div 
        className="relative"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
      >
        {/* Invisible mirror for auto-sizing to fit content */}
        <div
          style={{
            font: `${textObj.fontSize}px ${textObj.fontFamily}`,
            padding: '4px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            minWidth: '20px',
            minHeight: '30px',
            visibility: 'hidden',
          }}
        >
          {textObj.content + ' '}
        </div>

        {/* Actual Text Area */}
        <textarea
          ref={textAreaRef}
          value={textObj.content}
          onChange={handleContentChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            if (textObj.isEditing) {
              onUpdate(textObj.id, { isEditing: false });
            }
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'transparent',
            border: 'none',
            outline: isFocused ? '1px dashed rgba(0,0,0,0.2)' : 'none',
            resize: 'none',
            font: `${textObj.fontSize}px ${textObj.fontFamily}`,
            color: textObj.color,
            padding: '4px',
            overflow: 'hidden',
            // Disable pointer events on textarea when not focused so the wrapper can capture drags
            pointerEvents: isFocused ? 'auto' : 'none',
          }}
          placeholder={isFocused ? "" : ""}
        />
      </div>
    </div>
  );
};
