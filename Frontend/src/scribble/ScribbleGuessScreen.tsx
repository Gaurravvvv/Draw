/**
 * ScribbleGuessScreen — Guesser's view: live canvas from drawer + chat/guess input.
 * Shows blanks with hints, real-time chat, and a guess input box.
 */

import { useState, useRef, useEffect } from 'react';
import { useScribbleStore } from './scribbleStore';
import { AvatarPreview } from '../components/AvatarPreview';
import { Timer, Send, CheckCircle, MessageCircle } from 'lucide-react';

interface ScribbleGuessScreenProps {
  onSendGuess: (roomCode: string, guess: string) => void;
}

export function ScribbleGuessScreen({ onSendGuess }: ScribbleGuessScreenProps) {
  const {
    timerValue, roomCode, blanks, drawerName, currentRound, currentTurn,
    totalRounds, turnsPerRound, chatMessages, hasGuessedCorrectly, myTurnPoints,
  } = useScribbleStore();
  const settings = useScribbleStore(s => s.settings);
  const [guessInput, setGuessInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isUrgent = timerValue <= 10;
  const timerPct = (timerValue / (settings?.drawTime || 80)) * 100;

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  // Listen for remote draw snapshots to render on canvas
  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.type === 'snapshot' && data.pngBase64) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = data.pngBase64;
      }
    };
    window.addEventListener('scribble-remote-draw', handler);
    return () => window.removeEventListener('scribble-remote-draw', handler);
  }, []);

  const handleSubmitGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessInput.trim() || hasGuessedCorrectly) return;
    onSendGuess(roomCode, guessInput.trim());
    setGuessInput('');
  };

  const getChatColor = (type: string) => {
    switch (type) {
      case 'correct': return 'text-emerald-600 font-bold bg-emerald-50';
      case 'close': return 'text-amber-600 font-bold bg-amber-50';
      case 'system': return 'text-gray-500 italic bg-gray-50';
      default: return 'text-gray-700';
    }
  };

  return (
    <div className="h-screen bg-paper-bg flex flex-col overflow-hidden">
      {/* Timer bar */}
      <div className="h-1.5 bg-gray-200 w-full flex-shrink-0">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${
            isUrgent ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
          }`}
          style={{ width: `${timerPct}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-xs">
            R{currentRound}/{totalRounds} • T{currentTurn}/{turnsPerRound}
          </span>
          <span className="text-gray-300">•</span>
          <span className="text-gray-600 text-sm font-medium">
            🎨 {drawerName} is drawing
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Timer size={16} className={isUrgent ? 'text-red-500 animate-pulse' : 'text-emerald-500'} />
          <span className={`text-xl font-black font-mono ${isUrgent ? 'text-red-500' : 'text-gray-800'}`}>
            {timerValue}
          </span>
        </div>
      </div>

      {/* Blanks / Word hint */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0 text-center">
        <span className="text-3xl font-black font-mono tracking-[0.5em] text-gray-800">
          {blanks}
        </span>
      </div>

      {/* Main content — canvas + chat side by side */}
      <div className="flex-1 flex min-h-0">
        {/* Canvas view */}
        <div className="flex-1 flex items-center justify-center bg-gray-50 p-3">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden w-full max-w-2xl aspect-video relative">
            <canvas
              ref={canvasRef}
              width={960}
              height={540}
              className="w-full h-full"
              style={{ imageRendering: 'auto' }}
            />
            {/* Correct guess overlay */}
            {hasGuessedCorrectly && (
              <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[1px] flex items-center justify-center">
                <div className="bg-white rounded-xl shadow-lg px-6 py-4 text-center border border-emerald-200">
                  <CheckCircle size={32} className="text-emerald-500 mx-auto mb-2" />
                  <p className="text-emerald-700 font-bold text-lg">You guessed it!</p>
                  <p className="text-emerald-500 text-sm">+{myTurnPoints} points</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat / Guess panel */}
        <div className="w-72 md:w-80 flex flex-col bg-white border-l border-gray-200 flex-shrink-0">
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-h-0">
            {chatMessages.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-8">
                <MessageCircle size={24} className="mx-auto mb-2 text-gray-300" />
                <p>Type your guesses below!</p>
              </div>
            )}
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex items-start gap-2 text-sm px-2 py-1.5 rounded-lg ${getChatColor(msg.type)}`}>
                {msg.avatar ? (
                  <div className="flex-shrink-0 mt-0.5">
                    <AvatarPreview config={msg.avatar} size={22} />
                  </div>
                ) : (msg.type === 'system' || msg.type === 'close') ? null : (
                  <div className="w-[22px] flex-shrink-0" />
                )}
                <div className="min-w-0">
                  {msg.type !== 'system' && msg.type !== 'correct' && msg.type !== 'close' && (
                    <span className="font-bold text-gray-500 mr-1">{msg.nickname}:</span>
                  )}
                  <span>{msg.text}</span>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Guess input */}
          <form onSubmit={handleSubmitGuess} className="flex-shrink-0 border-t border-gray-200 p-3">
            {hasGuessedCorrectly ? (
              <div className="text-center text-emerald-500 text-sm font-medium py-2">
                ✅ You guessed correctly! +{myTurnPoints} pts
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  placeholder="Type your guess..."
                  className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-emerald-500 focus:outline-none transition-colors"
                  autoFocus
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!guessInput.trim()}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
