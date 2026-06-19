import { useEffect } from 'react';
import { MousePointer2 } from 'lucide-react';
import { AvatarPreview } from './AvatarPreview';
import type { AvatarConfig } from './AvatarPreview';
import { useStore } from '../store';

interface CursorData {
  id: string;
  x: number;
  y: number;
  nickname: string;
  avatar?: AvatarConfig;
}

interface LiveCursorsProps {
  scale: number;
}

export const LiveCursors = ({ scale }: LiveCursorsProps) => {
  const roomUsers = useStore((state) => state.roomUsers);
  const socketId = useStore((state) => state.socketId);

  // Filter to other users in the room to display their cursors
  const otherUsers = roomUsers.filter((u) => u.id !== socketId);

  useEffect(() => {
    const handleRemoteCursor = (e: Event) => {
      const data = (e as CustomEvent<CursorData>).detail;
      const el = document.getElementById(`remote-cursor-${data.id}`);
      if (el) {
        // GPU accelerated direct DOM translation
        el.style.transform = `translate3d(${data.x}px, ${data.y}px, 0)`;
        el.style.opacity = '1';
      }
    };

    window.addEventListener('remote-cursor-move', handleRemoteCursor as EventListener);

    return () => {
      window.removeEventListener('remote-cursor-move', handleRemoteCursor as EventListener);
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
      {otherUsers.map((user) => (
        <div
          id={`remote-cursor-${user.id}`}
          key={user.id}
          className="absolute flex flex-col items-center pointer-events-none opacity-0 transition-opacity duration-300"
          style={{
            left: 0,
            top: 0,
            transform: 'translate3d(0, 0, 0)',
            willChange: 'transform',
          }}
        >
          {user.avatar ? (
            <div style={{ transform: `scale(${1 / scale}) translateY(-50%)`, transformOrigin: 'bottom center' }}>
               <AvatarPreview config={user.avatar} size={32} />
            </div>
          ) : (
            <MousePointer2 className="w-5 h-5 text-paper-accent fill-paper-accent stroke-white drop-shadow-md" />
          )}
          <div 
            className="mt-1 px-2 py-0.5 bg-paper-accent text-white text-xs font-bold rounded-full shadow-sm whitespace-nowrap"
            style={{ transform: `scale(${1 / scale})`, transformOrigin: 'top center' }}
          >
            {user.nickname}
          </div>
        </div>
      ))}
    </div>
  );
};
