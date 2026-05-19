/**
 * WaitingScreen — Shown to non-picker users while the picker selects a word.
 * Displays the picker's name and a waiting animation.
 */

import { useGameStore } from './gameStore';
import { Loader2 } from 'lucide-react';

export function WaitingScreen() {
  const { pickerName, currentRound, currentTurn, totalRounds, timerValue } = useGameStore();

  return (
    <div className="min-h-screen bg-paper-bg flex flex-col items-center justify-center p-4">
      <div className="text-center">
        {/* Round info */}
        <div className="mb-6 flex items-center justify-center gap-4 text-sm text-gray-500">
          <span>Round {currentRound}/{totalRounds}</span>
          <span className="text-gray-300">•</span>
          <span>Turn {currentTurn}/3</span>
        </div>

        {/* Animated icon */}
        <div className="mb-8 relative">
          <div className="w-32 h-32 mx-auto rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
            <Loader2 size={48} className="text-paper-accent animate-spin" />
          </div>
          <div className="absolute inset-0 w-32 h-32 mx-auto rounded-full bg-blue-100 animate-ping" style={{ animationDuration: '2s' }} />
        </div>

        <h1 className="text-3xl font-black text-gray-800 mb-3">
          {pickerName} is picking a word...
        </h1>
        <p className="text-gray-500 mb-6">
          Get your drawing fingers ready! 🎨
        </p>

        {/* Timer badge */}
        <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-5 py-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-gray-600 text-sm font-medium">
            {timerValue > 0 ? `${timerValue}s remaining` : 'Almost ready...'}
          </span>
        </div>
      </div>
    </div>
  );
}
