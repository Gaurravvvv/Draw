/**
 * ScribbleDrawScreen — The drawer's canvas with timer, secret word, and live chat.
 * Reuses the existing GameCanvas and Toolbar for drawing tools.
 * Broadcasts strokes to guessers via socket.
 * Shows a collapsible chat panel so the drawer can see who's guessing/guessed.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useScribbleStore } from './scribbleStore';
import { AvatarPreview } from '../components/AvatarPreview';
import { GameCanvas } from '../game/GameCanvas';
import { Toolbar } from '../components/Toolbar';
import { Timer, Pencil, MessageCircle, ChevronRight, ChevronLeft } from 'lucide-react';

interface ScribbleDrawScreenProps {
  onSendDrawEvent: (roomCode: string, drawData: any) => void;
}

export function ScribbleDrawScreen({ onSendDrawEvent }: ScribbleDrawScreenProps) {
  const { timerValue, roomCode, secretWord, currentRound, currentTurn, totalRounds, turnsPerRound } = useScribbleStore();
  const settings = useScribbleStore(s => s.settings);
  const chatMessages = useScribbleStore(s => s.chatMessages);
  const [chatOpen, setChatOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const timerPct = (timerValue / (settings?.drawTime || 80)) * 100;
  const isUrgent = timerValue <= 10;

  // Periodic snapshots for broadcasting to guessers
  const handleSnapshot = useCallback((pngBase64: string) => {
    onSendDrawEvent(roomCode, { type: 'snapshot', pngBase64 });
  }, [roomCode, onSendDrawEvent]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  const getChatColor = (type: string) => {
    switch (type) {
      case 'correct': return 'text-emerald-600 font-bold bg-emerald-50';
      case 'close': return 'text-amber-600 font-bold bg-amber-50';
      case 'system': return 'text-gray-500 italic bg-gray-50';
      default: return 'text-gray-700';
    }
  };

  return (
    <div className="relative w-screen h-screen bg-paper-bg overflow-hidden flex">
      {/* Main canvas area */}
      <div className="flex-1 relative">
        <Toolbar />

        {/* Timer bar at top */}
        <div className="absolute top-0 left-0 right-0 z-30">
          <div className="h-1.5 bg-gray-200 w-full">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${
                isUrgent ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
              }`}
              style={{ width: `${timerPct}%` }}
            />
          </div>
        </div>

        {/* Word display + Timer */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-white/95 backdrop-blur-sm border border-emerald-200 shadow-lg rounded-xl px-6 py-3 flex items-center gap-4">
            <Pencil size={18} className="text-emerald-500" />
            <span className="text-2xl font-black text-emerald-600 capitalize tracking-wide">
              {secretWord}
            </span>
            <div className="w-px h-6 bg-gray-200" />
            <Timer size={18} className={isUrgent ? 'text-red-500 animate-pulse' : 'text-gray-400'} />
            <span className={`text-2xl font-black font-mono ${isUrgent ? 'text-red-500' : 'text-gray-800'}`}>
              {timerValue}
            </span>
          </div>
        </div>

        {/* Round info */}
        <div className="absolute top-4 right-4 z-20">
          <div className="bg-white/90 backdrop-blur-sm border border-paper-border shadow-sm rounded-xl px-3 py-2">
            <span className="text-gray-500 text-xs">
              R{currentRound}/{totalRounds} • T{currentTurn}/{turnsPerRound}
            </span>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex items-center justify-center w-full h-full pt-6">
          <GameCanvas
            locked={false}
            onSnapshot={handleSnapshot}
            snapshotInterval={500}
          />
        </div>
      </div>

      {/* Chat toggle button (when collapsed) */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-white border border-gray-200 border-r-0 rounded-l-xl px-1.5 py-4 shadow-md hover:bg-gray-50 transition-colors"
          title="Show chat"
        >
          <ChevronLeft size={16} className="text-gray-500" />
          <MessageCircle size={16} className="text-emerald-500 mt-1" />
          {chatMessages.length > 0 && (
            <div className="w-2 h-2 bg-emerald-500 rounded-full mx-auto mt-1 animate-pulse" />
          )}
        </button>
      )}

      {/* Chat panel */}
      {chatOpen && (
        <div className="w-64 flex flex-col bg-white border-l border-gray-200 flex-shrink-0 z-20">
          {/* Chat header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 flex-shrink-0">
            <h3 className="text-gray-700 text-xs font-bold flex items-center gap-1.5">
              <MessageCircle size={14} className="text-emerald-500" />
              Live Chat
            </h3>
            <button
              onClick={() => setChatOpen(false)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
              title="Hide chat"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 min-h-0">
            {chatMessages.length === 0 && (
              <div className="text-center text-gray-400 text-xs py-6">
                <p>Waiting for guesses...</p>
              </div>
            )}
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex items-start gap-1.5 text-xs px-2 py-1 rounded-lg ${getChatColor(msg.type)}`}>
                {msg.avatar && (
                  <div className="flex-shrink-0 mt-0.5">
                    <AvatarPreview config={msg.avatar} size={18} />
                  </div>
                )}
                <span>{msg.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
