import { useEffect, useRef } from 'react';
import { fabric } from 'fabric';
import { useStore } from '../store';
import { APP_CONFIG } from '../constants';
import type { ToolId } from '../constants';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface WhiteboardProps {
  roomId: string;
}

// Undo/Redo action types
interface UndoAction {
  type: 'add' | 'remove';
  objectData: any; // Serialized Fabric object (with id)
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

  // Undo/Redo stacks
  const undoStack = useRef<UndoAction[]>([]);
  const redoStack = useRef<UndoAction[]>([]);

  const { activeTool, activeColor, brushSize, setActiveTool, setIsConnected, showToast } = useStore();

  // Helper: push to undo stack (local actions only)
  const pushUndo = (action: UndoAction) => {
    undoStack.current.push(action);
    redoStack.current = []; // Clear redo on new action
  };

  // 1. Initialize Canvas & Socket
  useEffect(() => {
    if (!canvasRef.current) return;

    // Socket
    const socket = io(API_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-room', roomId);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('reconnect' as any, () => {
      setIsConnected(true);
      showToast('Reconnected!', 'success');
      socket.emit('join-room', roomId);
    });

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
    socket.on('initial-state', (objects: any[]) => {
      isRemoteUpdate.current = true;
      fabric.util.enlivenObjects(
        objects,
        (enlivened: any[]) => {
          enlivened.forEach((obj, index) => {
            if (objects[index].id && !(obj as any).id) {
              (obj as any).id = objects[index].id;
            }
            canvas.add(obj);
          });
          canvas.requestRenderAll();
          isRemoteUpdate.current = false;
        },
        ''
      );
    });

    socket.on('draw-event', (msg: any) => {
      isRemoteUpdate.current = true;

      if (msg.type === 'add') {
        const exists = canvas.getObjects().find((o: any) => o.id === msg.object.id);
        if (!exists) {
          fabric.util.enlivenObjects(
            [msg.object],
            (enlivenedObjects: any[]) => {
              enlivenedObjects.forEach((obj) => {
                if (msg.object.id && !(obj as any).id) {
                  (obj as any).id = msg.object.id;
                }
                canvas.add(obj);
              });
              canvas.requestRenderAll();
            },
            ''
          );
        }
      } else if (msg.type === 'modify') {
        const obj = canvas.getObjects().find((o: any) => o.id === msg.object.id);
        if (obj) {
          obj.set(msg.object);
          obj.setCoords();
        }
      } else if (msg.type === 'remove') {
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

      const objectData = path.toObject(['id', 'shadow']);

      socketRef.current?.emit('draw-event', {
        roomId,
        data: { type: 'add', object: objectData },
      });

      pushUndo({ type: 'add', objectData });
    });

    // Object Modified
    canvas.on('object:modified', (e: any) => {
      if (isRemoteUpdate.current) return;
      const obj = e.target;
      if (!obj || !(obj as any).id) return;

      socketRef.current?.emit('draw-event', {
        roomId,
        data: { type: 'modify', object: obj.toObject(['id', 'shadow']) },
      });
    });

    // --- UNDO/REDO HANDLERS ---
    const handleUndo = () => {
      const action = undoStack.current.pop();
      if (!action) return;

      if (action.type === 'add') {
        // Undo an add = remove the object
        const obj = canvas.getObjects().find((o: any) => o.id === action.objectData.id);
        if (obj) {
          canvas.remove(obj);
          socketRef.current?.emit('draw-event', {
            roomId,
            data: { type: 'remove', objectId: action.objectData.id },
          });
        }
        redoStack.current.push({ type: 'add', objectData: action.objectData });
      } else if (action.type === 'remove') {
        // Undo a remove = re-add the object
        fabric.util.enlivenObjects(
          [action.objectData],
          (enlivened: any[]) => {
            enlivened.forEach((obj) => {
              if (action.objectData.id && !(obj as any).id) {
                (obj as any).id = action.objectData.id;
              }
              canvas.add(obj);
              socketRef.current?.emit('draw-event', {
                roomId,
                data: { type: 'add', object: action.objectData },
              });
            });
            canvas.requestRenderAll();
          },
          ''
        );
        redoStack.current.push({ type: 'remove', objectData: action.objectData });
      }

      canvas.requestRenderAll();
    };

    const handleRedo = () => {
      const action = redoStack.current.pop();
      if (!action) return;

      if (action.type === 'add') {
        // Redo an add = add the object back
        fabric.util.enlivenObjects(
          [action.objectData],
          (enlivened: any[]) => {
            enlivened.forEach((obj) => {
              if (action.objectData.id && !(obj as any).id) {
                (obj as any).id = action.objectData.id;
              }
              canvas.add(obj);
              socketRef.current?.emit('draw-event', {
                roomId,
                data: { type: 'add', object: action.objectData },
              });
            });
            canvas.requestRenderAll();
          },
          ''
        );
        undoStack.current.push({ type: 'add', objectData: action.objectData });
      } else if (action.type === 'remove') {
        // Redo a remove = remove the object again
        const obj = canvas.getObjects().find((o: any) => o.id === action.objectData.id);
        if (obj) {
          canvas.remove(obj);
          socketRef.current?.emit('draw-event', {
            roomId,
            data: { type: 'remove', objectId: action.objectData.id },
          });
        }
        undoStack.current.push({ type: 'remove', objectData: action.objectData });
      }

      canvas.requestRenderAll();
    };

    // Listen for undo/redo from Toolbar buttons
    window.addEventListener('canvas-undo', handleUndo);
    window.addEventListener('canvas-redo', handleRedo);

    // Keyboard shortcuts
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyboard);

    return () => {
      socket.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('canvas-undo', handleUndo);
      window.removeEventListener('canvas-redo', handleRedo);
      window.removeEventListener('keydown', handleKeyboard);
      canvas.dispose();
    };
  }, [roomId]);

  // 2. Handle Tool Changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Reset mouse event listeners
    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

    // 1. LOCK OBJECTS WHEN DRAWING
    const isSelectTool = activeTool === 'select';
    canvas.getObjects().forEach((obj) => {
      obj.selectable = isSelectTool;
      obj.evented = isSelectTool || activeTool === 'eraser'; // Allow click for eraser
    });

    // 2. CURSOR & MODE MANAGEMENT
    if (activeTool === 'select') {
      canvas.selection = true;
      canvas.defaultCursor = 'default';
      canvas.isDrawingMode = false;
    } else if (activeTool.startsWith('pencil')) {
      canvas.isDrawingMode = true;
      canvas.selection = false;
      const brushId = activeTool as ToolId;

      // Default Pencil / Sketch
      if (brushId === 'pencil' || brushId === 'pencil-sketch') {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = activeColor;
        canvas.freeDrawingBrush.width = brushSize;
        canvas.freeDrawingBrush.shadow = null as any;
      }
      // Marker
      else if (brushId === 'pencil-marker') {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        const color = new fabric.Color(activeColor);
        color.setAlpha(0.7);
        canvas.freeDrawingBrush.color = color.toRgba();
        canvas.freeDrawingBrush.width = brushSize * 2;
        canvas.freeDrawingBrush.shadow = null as any;
      }
      // Spray
      else if (brushId === 'pencil-spray') {
        canvas.freeDrawingBrush = new (fabric.SprayBrush as any)(canvas);
        canvas.freeDrawingBrush.color = activeColor;
        canvas.freeDrawingBrush.width = brushSize * 3;
        canvas.freeDrawingBrush.shadow = null as any;
      }
      // Neon
      else if (brushId === 'pencil-neon') {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = activeColor;
        canvas.freeDrawingBrush.width = brushSize;
        canvas.freeDrawingBrush.shadow = new fabric.Shadow({
          blur: brushSize * 3,
          color: activeColor,
          offsetX: 0,
          offsetY: 0,
        });
      }
    }
    // ERASER — Object-based (click to remove)
    else if (activeTool === 'eraser') {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.defaultCursor = 'crosshair';

      // Make objects clickable for erasing
      canvas.getObjects().forEach((obj) => {
        obj.selectable = false;
        obj.evented = true;
        obj.hoverCursor = 'pointer';
      });

      canvas.on('mouse:down', (opt) => {
        const target = opt.target;
        if (target && target !== canvas.backgroundImage) {
          const objectData = target.toObject(['id', 'shadow']);
          const objectId = (target as any).id;

          canvas.remove(target);
          canvas.requestRenderAll();

          // Emit remove event
          if (objectId) {
            socketRef.current?.emit('draw-event', {
              roomId,
              data: { type: 'remove', objectId },
            });
          }

          // Push to undo stack
          pushUndo({ type: 'remove', objectData });
        }
      });
    } else {
      // Shapes or Text
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.defaultCursor = activeTool === 'text' ? 'text' : 'crosshair';

      if (activeTool === 'text') {
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

          const objectData = text.toObject(['id']);

          socketRef.current?.emit('draw-event', {
            roomId,
            data: { type: 'add', object: objectData },
          });

          pushUndo({ type: 'add', objectData });

          text.on('editing:exited', () => {
            socketRef.current?.emit('draw-event', {
              roomId,
              data: { type: 'modify', object: text.toObject(['id']) },
            });
            setActiveTool('select');
          });
        });
      } else if (activeTool.startsWith('shape-')) {
        canvas.on('mouse:down', (opt) => {
          if (opt.target && opt.target !== canvas.backgroundImage) return;

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
            originY: 'center',
          };

          switch (activeTool) {
            case 'shape-rectangle':
              shape = new fabric.Rect({
                ...commonProps,
                width: 0,
                height: 0,
                originX: 'left',
                originY: 'top',
              });
              break;
            case 'shape-circle':
              shape = new fabric.Circle({
                ...commonProps,
                radius: 0,
                originX: 'left',
                originY: 'top',
              });
              break;
            case 'shape-triangle':
              shape = new fabric.Triangle({
                ...commonProps,
                width: 0,
                height: 0,
                originX: 'left',
                originY: 'top',
              });
              break;
            case 'shape-diamond':
              shape = new fabric.Rect({
                ...commonProps,
                width: 0,
                height: 0,
                angle: 45,
                originX: 'center',
                originY: 'center',
              });
              break;
            case 'shape-star':
              shape = new fabric.Polygon(
                [
                  { x: 0, y: -50 },
                  { x: 14, y: -20 },
                  { x: 47, y: -15 },
                  { x: 23, y: 7 },
                  { x: 29, y: 40 },
                  { x: 0, y: 25 },
                  { x: -29, y: 40 },
                  { x: -23, y: 7 },
                  { x: -47, y: -15 },
                  { x: -14, y: -20 },
                ],
                {
                  ...commonProps,
                  scaleX: 0,
                  scaleY: 0,
                }
              );
              break;
            case 'shape-hexagon':
              shape = new fabric.Polygon(
                [
                  { x: 25, y: 0 },
                  { x: 50, y: 14 },
                  { x: 50, y: 43 },
                  { x: 25, y: 57 },
                  { x: 0, y: 43 },
                  { x: 0, y: 14 },
                ],
                {
                  ...commonProps,
                  scaleX: 0,
                  scaleY: 0,
                  originX: 'left',
                  originY: 'top',
                }
              );
              break;
            case 'shape-arrow':
              const p = 'M 0 20 L 40 20 L 40 10 L 60 25 L 40 40 L 40 30 L 0 30 Z';
              shape = new fabric.Path(p, {
                ...commonProps,
                scaleX: 0,
                scaleY: 0,
                originX: 'left',
                originY: 'top',
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

          if (shape.type === 'rect') {
            if (activeTool === 'shape-diamond') {
              const dist = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
              shape.set({ width: dist * 1.5, height: dist * 1.5 });
            } else {
              shape.set({
                width: width,
                height: height,
                left: startX < pointer.x ? startX : pointer.x,
                top: startY < pointer.y ? startY : pointer.y,
              });
            }
          } else if (shape.type === 'circle') {
            (shape as fabric.Circle).set({
              left: startX < pointer.x ? startX : pointer.x,
              top: startY < pointer.y ? startY : pointer.y,
              radius: Math.max(width, height) / 2,
            });
          } else if (shape.type === 'triangle') {
            shape.set({
              width: width,
              height: height,
              left: startX < pointer.x ? startX : pointer.x,
              top: startY < pointer.y ? startY : pointer.y,
            });
          } else if (shape.type === 'polygon' || shape.type === 'path') {
            const scaleX = width / 50;
            const scaleY = height / 50;
            shape.set({ scaleX: Math.max(0.1, scaleX), scaleY: Math.max(0.1, scaleY) });

            if (activeTool !== 'shape-star') {
              shape.set({
                left: startX < pointer.x ? startX : pointer.x,
                top: startY < pointer.y ? startY : pointer.y,
              });
            }
          }

          canvas.requestRenderAll();
        });

        canvas.on('mouse:up', () => {
          if (isDrawingShape.current && activeShapeObject.current) {
            activeShapeObject.current.setCoords();
            const objectData = activeShapeObject.current.toObject(['id']);

            socketRef.current?.emit('draw-event', {
              roomId,
              data: { type: 'add', object: objectData },
            });

            pushUndo({ type: 'add', objectData });

            canvas.setActiveObject(activeShapeObject.current);
            setActiveTool('select');
          }

          isDrawingShape.current = false;
          activeShapeObject.current = null;
          shapeStartPoint.current = null;
        });
      }
    }

    // 3. CLEANUP
    canvas.requestRenderAll();
  }, [activeTool, activeColor, brushSize, setActiveTool, roomId]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0" />;
};