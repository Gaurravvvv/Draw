/**
 * DrawingScreen — Isolated canvas with countdown timer for non-picker users.
 * Uses the shared Toolbar from the whiteboard for tool selection.
 */

import { useEffect, useCallback } from 'react';
import { useGameStore } from './gameStore';
import { GameCanvas } from './GameCanvas';
import { Toolbar } from '../components/Toolbar';
import { Timer, Send } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface DrawingScreenProps {
  onSendSnapshot: (roomCode: string, pngBase64: string) => void;
  onSubmitDrawing: (roomCode: string, pngBase64: string) => void;
}

export function DrawingScreen({ onSendSnapshot, onSubmitDrawing }: DrawingScreenProps) {
  const { timerValue, roomCode, screen, myId, currentRound, currentTurn, totalRounds } = useGameStore();
  const isLocked = screen === 'scoring';

  // Periodic snapshots for spectator
  const handleSnapshot = useCallback((pngBase64: string) => {
    onSendSnapshot(roomCode, pngBase64);
  }, [roomCode, onSendSnapshot]);

  // Submit drawing on 'game-drawing-ended' custom event.
  // This event fires BEFORE the screen changes to 'scoring', so the canvas
  // is still mounted and window.__gameCanvasExport is still available.
  useEffect(() => {
    const handleDrawingEnded = () => {
      const exportFn = (window as any).__gameCanvasExport;
      if (!exportFn) {
        console.warn('[Game] __gameCanvasExport not found at submission time');
        return;
      }
      const png = exportFn();
      if (!png || png.length < 200) {
        console.warn('[Game] Canvas export empty — nothing to submit');
        return;
      }

      console.log('[Game] Submitting drawing, size:', Math.round(png.length / 1024), 'KB');

      // Send via socket (stores raw data on server)
      onSubmitDrawing(roomCode, png);

      // Score via Gemini Vision HTTP endpoint
      fetch(`${API_URL}/api/game/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, playerId: myId, pngBase64: png }),
      })
        .then(r => r.json())
        .then(data => console.log('[Game] Gemini score:', data))
        .catch(err => console.error('[Game] Score HTTP error:', err));
    };

    window.addEventListener('game-drawing-ended', handleDrawingEnded);
    return () => window.removeEventListener('game-drawing-ended', handleDrawingEnded);
  }, [roomCode, myId, onSubmitDrawing]);

  const timerPct = (timerValue / (useGameStore.getState().settings?.drawTime || 60)) * 100;
  const isUrgent = timerValue <= 10;

  return (
    <div className="relative w-screen h-screen bg-paper-bg overflow-hidden">
      {/* Toolbar */}
      <Toolbar />

      {/* Timer bar at top */}
      <div className="absolute top-0 left-0 right-0 z-30">
        <div className="h-1.5 bg-gray-800 w-full">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              isUrgent ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-purple-500 to-pink-500'
            }`}
            style={{ width: `${timerPct}%` }}
          />
        </div>
      </div>

      <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
        <div className="bg-white/90 backdrop-blur-sm border border-paper-border shadow-md rounded-xl px-4 py-2 flex items-center gap-3">
          <span className="text-gray-500 text-xs">
            R{currentRound}/{totalRounds} • T{currentTurn}/3
          </span>
          <div className="w-px h-4 bg-gray-200" />
          <Timer size={18} className={isUrgent ? 'text-red-400 animate-pulse' : 'text-paper-accent'} />
          <span className={`text-2xl font-black font-mono ${isUrgent ? 'text-red-500' : 'text-gray-800'}`}>
            {timerValue}
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex items-center justify-center w-full h-full pt-6">
        <GameCanvas
          locked={isLocked}
          onSnapshot={handleSnapshot}
          snapshotInterval={800}
        />
      </div>

      {/* Locked overlay */}
      {isLocked && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="text-center">
            <Send size={48} className="text-purple-400 mx-auto mb-4 animate-bounce" />
            <h2 className="text-2xl font-black text-white mb-2">Time's Up!</h2>
            <p className="text-gray-400">Submitting your masterpiece to the AI judge...</p>
          </div>
        </div>
      )}
    </div>
  );
}
