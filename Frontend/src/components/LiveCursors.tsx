import { useEffect, useState } from 'react';
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
  const [cursors, setCursors] = useState<Record<string, CursorData>>({});
  const roomUsers = useStore((state) => state.roomUsers);

  useEffect(() => {
    const handleRemoteCursor = (e: CustomEvent<CursorData>) => {
      const data = e.detail;
      setCursors((prev) => ({
        ...prev,
        [data.id]: data,
      }));
    };

    window.addEventListener('remote-cursor-move', handleRemoteCursor as EventListener);

    // Clean up idle cursors every 5 seconds
    const interval = setInterval(() => {
      // In a real app, you'd add timestamps to data and prune old ones.
      // For now, they persist until the user disconnects (which could clear them if we handled disconnect events for cursors).
    }, 5000);

    return () => {
      window.removeEventListener('remote-cursor-move', handleRemoteCursor as EventListener);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
      {Object.values(cursors)
        .filter(cursor => roomUsers.some(u => u.id === cursor.id))
        .map((cursor) => (
        <div
          key={cursor.id}
          className="absolute flex flex-col items-center transition-all duration-100 ease-linear pointer-events-none"
          style={{
            transform: `translate(${cursor.x}px, ${cursor.y}px)`,
          }}
        >
          {cursor.avatar ? (
            <div style={{ transform: `scale(${1 / scale}) translateY(-50%)`, transformOrigin: 'bottom center' }}>
               <AvatarPreview config={cursor.avatar} size={32} />
            </div>
          ) : (
            <MousePointer2 className="w-5 h-5 text-paper-accent fill-paper-accent stroke-white drop-shadow-md" />
          )}
          <div 
            className="mt-1 px-2 py-0.5 bg-paper-accent text-white text-xs font-bold rounded-full shadow-sm whitespace-nowrap"
            style={{ transform: `scale(${1 / scale})`, transformOrigin: 'top center' }}
          >
            {cursor.nickname}
          </div>
        </div>
      ))}
    </div>
  );
};
