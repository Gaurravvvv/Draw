import { useEffect, useRef } from 'react';
import { fabric } from 'fabric';
import { useStore } from '../store';
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
      backgroundColor: '#ffffff',
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
    socketRef.current.on('draw-event', (msg: any) => {
      console.log('Received draw-event:', msg);
      isRemoteUpdate.current = true;

      if (msg.type === 'add') {
        const exists = canvas.getObjects().find((o: any) => o.id === msg.object.id);
        if (!exists) {
          fabric.util.enlivenObjects([msg.object], (enlivenedObjects: any[]) => {
            enlivenedObjects.forEach((obj) => {
              canvas.add(obj);
            });
            canvas.requestRenderAll();
          }, ''); // Correct 3rd arg is namespace or empty string
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
      // In v5, we can attach custom props
      (path as any).id = uuidv4(); 

      socketRef.current?.emit('draw-event', {
        roomId,
        data: { type: 'add', object: path.toObject(['id']) }
      });
    });

    // Object Modified
    canvas.on('object:modified', (e: any) => {
      if (isRemoteUpdate.current) return;
      const obj = e.target;
      if (!obj || !(obj as any).id) return;

      socketRef.current?.emit('draw-event', {
        roomId,
        data: { type: 'modify', object: obj.toObject(['id']) }
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

    // Update Brush
    const brush = canvas.freeDrawingBrush;
    if (brush) {
      brush.color = activeColor;
      brush.width = brushSize;
    }

    // Reset Listeners
    canvas.off('mouse:down');
    canvas.defaultCursor = 'default';
    canvas.isDrawingMode = false;

    // Logic
    if (activeTool === 'pencil') {
      canvas.isDrawingMode = true;
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
    else if (activeTool === 'rectangle' || activeTool === 'circle') {
      canvas.defaultCursor = 'crosshair';
      canvas.on('mouse:down', (opt) => {
        if (opt.target) return;

        const pointer = canvas.getPointer(opt.e);
        const id = uuidv4();
        let shape: fabric.Object;

        if (activeTool === 'rectangle') {
          shape = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            fill: activeColor,
            width: brushSize * 10,
            height: brushSize * 10,
          });
        } else {
          shape = new fabric.Circle({
            left: pointer.x,
            top: pointer.y,
            fill: activeColor,
            radius: brushSize * 5,
          });
        }
        (shape as any).id = id;

        canvas.add(shape);
        canvas.setActiveObject(shape);

        socketRef.current?.emit('draw-event', {
          roomId,
          data: { type: 'add', object: shape.toObject(['id']) }
        });

        setActiveTool('select');
      });
    }
    else if (activeTool === 'eraser') {
      canvas.defaultCursor = 'not-allowed';
      canvas.on('mouse:down', (opt) => {
        if (opt.target) {
          const id = (opt.target as any).id;
          canvas.remove(opt.target);
          if (id) {
            socketRef.current?.emit('draw-event', {
              roomId,
              data: { type: 'remove', objectId: id }
            });
          }
        }
      });
    }

  }, [activeTool, activeColor, brushSize, setActiveTool, roomId]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0" />;
};