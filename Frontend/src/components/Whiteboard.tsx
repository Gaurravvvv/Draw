import { useEffect, useRef } from 'react';
import { fabric } from 'fabric';
import { useStore } from '../store';
import { APP_CONFIG } from '../constants';
import type { ToolId } from '../constants';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

interface WhiteboardProps {
  roomId: string;
}

export const Whiteboard = ({ roomId }: WhiteboardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isRemoteUpdate = useRef(false);

  // Refs for Shape Drawing
  const isDrawingShape = useRef(false);
  const shapeStartPoint = useRef<{ x: number; y: number } | null>(null);
  const activeShapeObject = useRef<fabric.Object | null>(null);

  const { activeTool, activeColor, brushSize, setActiveTool } = useStore();

  // 1. Initialize Canvas & Socket
  useEffect(() => {
    if (!canvasRef.current) return;

    // Socket
    socketRef.current = io('http://localhost:3001');
    socketRef.current.emit('join-room', roomId);

    // Fabric v5 Init
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: APP_CONFIG.CANVAS.BACKGROUND_COLOR,
      selection: true,
      isDrawingMode: false,
    });
    fabricRef.current = canvas;

    // Resize
    const handleResize = () => {
      canvas.setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);

    // --- SOCKET LISTENERS ---
    socketRef.current.on('initial-state', (objects: any[]) => {
      isRemoteUpdate.current = true;
      fabric.util.enlivenObjects(objects, (enlivened: any[]) => {
        enlivened.forEach((obj) => {
          canvas.add(obj);
        });
        canvas.requestRenderAll();
        isRemoteUpdate.current = false;
      }, '');
    });

    socketRef.current.on('draw-event', (msg: any) => {
      // console.log('Received draw-event:', msg);
      isRemoteUpdate.current = true;

      if (msg.type === 'add') {
        const exists = canvas.getObjects().find((o: any) => o.id === msg.object.id);
        if (!exists) {
          fabric.util.enlivenObjects([msg.object], (enlivenedObjects: any[]) => {
            enlivenedObjects.forEach((obj) => {
              canvas.add(obj);
            });
            canvas.requestRenderAll();
          }, ''); 
        }
      } 
      else if (msg.type === 'modify') {
        const obj = canvas.getObjects().find((o: any) => o.id === msg.object.id);
        if (obj) {
          obj.set(msg.object);
          obj.setCoords();
        }
      } 
      else if (msg.type === 'remove') {
        const obj = canvas.getObjects().find((o: any) => o.id === msg.objectId);
        if (obj) {
          canvas.remove(obj);
        }
      }
      
      canvas.requestRenderAll();
      isRemoteUpdate.current = false;
    });

    // --- CANVAS EVENT LISTENERS ---
    
    // Path Created (Freehand)
    canvas.on('path:created', (e: any) => {
      if (isRemoteUpdate.current) return;
      const path = e.path;
      (path as any).id = uuidv4(); 

      // If Neon, ensure shadow is serialized if needed (Fabric usually handles this, but good to check)
      
      socketRef.current?.emit('draw-event', {
        roomId,
        data: { type: 'add', object: path.toObject(['id', 'shadow']) }
      });
    });

    // Object Modified
    canvas.on('object:modified', (e: any) => {
      if (isRemoteUpdate.current) return;
      const obj = e.target;
      if (!obj || !(obj as any).id) return;

      socketRef.current?.emit('draw-event', {
        roomId,
        data: { type: 'modify', object: obj.toObject(['id', 'shadow']) }
      });
    });

    return () => {
      socketRef.current?.disconnect();
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
    };
  }, [roomId]);

  // 2. Handle Tool Changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Reset basics
    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');
    canvas.defaultCursor = 'default';
    canvas.isDrawingMode = false;
    canvas.selection = false;

    // Helper: Configure Brush
    const configureBrush = () => {
      canvas.isDrawingMode = true;
      const brushId = activeTool as ToolId;

      // Default Pencil / Sketch
      if (brushId === 'pencil' || brushId === 'pencil-sketch') {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = activeColor;
        canvas.freeDrawingBrush.width = 3; // Fixed thin
        canvas.freeDrawingBrush.shadow = null as any;
      }
      // Marker
      else if (brushId === 'pencil-marker') {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        const color = new fabric.Color(activeColor);
        color.setAlpha(0.7);
        canvas.freeDrawingBrush.color = color.toRgba();
        canvas.freeDrawingBrush.width = 10;
        canvas.freeDrawingBrush.shadow = null as any;
      }
      // Spray
      else if (brushId === 'pencil-spray') {
        // Cast to any to bypass potential TS definition mismatch for SprayBrush
        canvas.freeDrawingBrush = new (fabric.SprayBrush as any)(canvas);
        canvas.freeDrawingBrush.color = activeColor;
        canvas.freeDrawingBrush.width = brushSize * 2; // Spray needs more width to look good
        canvas.freeDrawingBrush.shadow = null as any;
      }
      // Neon
      else if (brushId === 'pencil-neon') {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = activeColor;
        canvas.freeDrawingBrush.width = 5;
        canvas.freeDrawingBrush.shadow = new fabric.Shadow({
          blur: 15,
          color: activeColor,
          offsetX: 0,
          offsetY: 0
        });
      }
      // True Eraser (Correction Tape)
      else if (brushId === 'eraser') {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = APP_CONFIG.CANVAS.BACKGROUND_COLOR;
        canvas.freeDrawingBrush.width = 20;
        canvas.freeDrawingBrush.shadow = null as any;
      }
    };

    // --- APPLY TOOL LOGIC ---

    if (activeTool.startsWith('pencil') || activeTool === 'eraser') {
      configureBrush();
    }
    else if (activeTool === 'select') {
      canvas.selection = true;
    }
    else if (activeTool === 'text') {
      canvas.defaultCursor = 'text';
      canvas.on('mouse:down', (opt) => {
        if (opt.target) return;
        
        const pointer = canvas.getPointer(opt.e);
        const id = uuidv4();
        const text = new fabric.IText('Type here', {
          left: pointer.x,
          top: pointer.y,
          fill: activeColor,
          fontSize: brushSize * 4,
          fontFamily: 'Arial',
        });
        (text as any).id = id;
        
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();

        socketRef.current?.emit('draw-event', {
          roomId,
          data: { type: 'add', object: text.toObject(['id']) }
        });

        text.on('editing:exited', () => {
           socketRef.current?.emit('draw-event', {
             roomId,
             data: { type: 'modify', object: text.toObject(['id']) }
           });
        });
        
        setActiveTool('select');
      });
    }
    else if (activeTool.startsWith('shape-')) {
      canvas.defaultCursor = 'crosshair';

      canvas.on('mouse:down', (opt) => {
        if (opt.target) return; // Don't start shape if clicking existing object
        
        isDrawingShape.current = true;
        const pointer = canvas.getPointer(opt.e);
        shapeStartPoint.current = { x: pointer.x, y: pointer.y };

        const id = uuidv4();
        let shape: fabric.Object | null = null;
        
        const commonProps = {
          left: pointer.x,
          top: pointer.y,
          fill: 'transparent',
          stroke: activeColor,
          strokeWidth: brushSize,
          originX: 'center', 
          originY: 'center'
        };

        switch (activeTool) {
          case 'shape-rectangle':
            shape = new fabric.Rect({
              ...commonProps,
              width: 0,
              height: 0,
              originX: 'left',
              originY: 'top'
            });
            break;
          case 'shape-circle':
            shape = new fabric.Circle({
              ...commonProps,
              radius: 0,
              originX: 'left',
              originY: 'top'
            });
            break;
          case 'shape-triangle':
            shape = new fabric.Triangle({
              ...commonProps,
              width: 0,
              height: 0,
              originX: 'left',
              originY: 'top'
            });
            break;
          case 'shape-diamond':
            // Rotated square
            shape = new fabric.Rect({
              ...commonProps,
              width: 0,
              height: 0,
              angle: 45,
              originX: 'center', // Rotate around center
              originY: 'center'
            });
            break;
          case 'shape-star':
             // Basic Star Polygon
             shape = new fabric.Polygon([
               {x: 0, y: -50}, {x: 14, y: -20}, {x: 47, y: -15}, {x: 23, y: 7}, 
               {x: 29, y: 40}, {x: 0, y: 25}, {x: -29, y: 40}, {x: -23, y: 7}, 
               {x: -47, y: -15}, {x: -14, y: -20}
             ], {
               ...commonProps,
               scaleX: 0,
               scaleY: 0
             });
            break;
          case 'shape-hexagon':
            // Basic Hexagon
             shape = new fabric.Polygon([
               {x: 25, y: 0}, {x: 50, y: 14}, {x: 50, y: 43}, 
               {x: 25, y: 57}, {x: 0, y: 43}, {x: 0, y: 14}
             ], {
               ...commonProps,
               scaleX: 0,
               scaleY: 0,
               originX: 'left',
               originY: 'top'
             });
            break;
          case 'shape-arrow':
            // Better arrow path
            const p = "M 0 20 L 40 20 L 40 10 L 60 25 L 40 40 L 40 30 L 0 30 Z";
             shape = new fabric.Path(p, {
               ...commonProps,
               scaleX: 0,
               scaleY: 0,
               originX: 'left',
               originY: 'top'
             });
            break;
        }

        if (shape) {
          (shape as any).id = id;
          canvas.add(shape);
          activeShapeObject.current = shape;
        }
      });

      canvas.on('mouse:move', (opt) => {
        if (!isDrawingShape.current || !activeShapeObject.current || !shapeStartPoint.current) return;
        
        const pointer = canvas.getPointer(opt.e);
        const startX = shapeStartPoint.current.x;
        const startY = shapeStartPoint.current.y;
        const width = Math.abs(pointer.x - startX);
        const height = Math.abs(pointer.y - startY);

        const shape = activeShapeObject.current;

        // Dynamic Resizing Logic
        if (shape.type === 'rect') {
            if (activeTool === 'shape-diamond') {
                // Diamond resizing (center based)
                const dist = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
                shape.set({ width: dist * 1.5, height: dist * 1.5 });
            } else {
                // Regular rect
                shape.set({ 
                    width: width, 
                    height: height,
                    left: startX < pointer.x ? startX : pointer.x, // Adjust position for negative drag
                    top: startY < pointer.y ? startY : pointer.y
                });
            }
        } 
        else if (shape.type === 'circle') {
             // Use cast to handle specific props
             (shape as fabric.Circle).set({
                left: startX < pointer.x ? startX : pointer.x,
                top: startY < pointer.y ? startY : pointer.y,
                radius: Math.max(width, height) / 2
             });
        }
        else if (shape.type === 'triangle') {
             shape.set({ 
                width: width, 
                height: height,
                left: startX < pointer.x ? startX : pointer.x,
                top: startY < pointer.y ? startY : pointer.y
             });
        }
        else if (shape.type === 'polygon' || shape.type === 'path') {
            // Scale based resizing
            // Initial size was arbitrary (points), so we scale.
            // Star/Hexagon/Arrow
            const scaleX = width / 50; // Normalize approx
            const scaleY = height / 50;
            shape.set({ scaleX: Math.max(0.1, scaleX), scaleY: Math.max(0.1, scaleY) });
            
            // Adjust position if not centered
            if (activeTool !== 'shape-star') { // Star is center origin
               shape.set({
                  left: startX < pointer.x ? startX : pointer.x,
                  top: startY < pointer.y ? startY : pointer.y
               });
            }
        }
        
        canvas.requestRenderAll();
      });

      canvas.on('mouse:up', () => {
        if (isDrawingShape.current && activeShapeObject.current) {
          // Finalize
          activeShapeObject.current.setCoords();
          socketRef.current?.emit('draw-event', {
            roomId,
            data: { type: 'add', object: activeShapeObject.current.toObject(['id']) }
          });
          
          // Select it and switch tool
          canvas.setActiveObject(activeShapeObject.current);
          setActiveTool('select'); 
        }
        
        isDrawingShape.current = false;
        activeShapeObject.current = null;
        shapeStartPoint.current = null;
      });
    }

  }, [activeTool, activeColor, brushSize, setActiveTool, roomId]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0" />;
};