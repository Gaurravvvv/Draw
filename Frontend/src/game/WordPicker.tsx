/**
 * WordPicker — Shown only to the picker. 3 word cards to choose from.
 * Has a 15-second timer. Auto-selects if no pick.
 */

import { useGameStore } from './gameStore';
import { Timer, Sparkles } from 'lucide-react';

interface WordPickerProps {
  onPick: (word: string) => void;
}

export function WordPicker({ onPick }: WordPickerProps) {
  const { wordOptions, timerValue, currentRound, currentTurn, totalRounds } = useGameStore();

  const cardColors = [
    'from-amber-500 to-orange-600',
    'from-pink-500 to-rose-600',
    'from-indigo-500 to-purple-600',
  ];

  const cardShadows = [
    'shadow-amber-500/30',
    'shadow-pink-500/30',
    'shadow-indigo-500/30',
  ];

  return (
    <div className="min-h-screen bg-paper-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl text-center">
        {/* Round info */}
        <div className="mb-4 flex items-center justify-center gap-4 text-sm text-gray-500">
          <span>Round {currentRound}/{totalRounds}</span>
          <span className="text-gray-300">•</span>
          <span>Turn {currentTurn}/3</span>
        </div>

        {/* Title */}
        <div className="mb-3">
          <h1 className="text-4xl font-black text-gray-800 mb-2">You're the Picker! 🎯</h1>
          <p className="text-gray-500">Choose a word for everyone else to draw</p>
        </div>

        {/* Timer */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <Timer size={20} className={`${timerValue <= 5 ? 'text-red-500 animate-pulse' : 'text-paper-accent'}`} />
          <span className={`text-3xl font-black font-mono ${timerValue <= 5 ? 'text-red-500 animate-pulse' : 'text-gray-800'}`}>
            {timerValue}
          </span>
        </div>

        {/* Word cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {wordOptions.map((word, i) => (
            <button
              key={word}
              onClick={() => onPick(word)}
              className={`group relative bg-gradient-to-br ${cardColors[i]} rounded-2xl p-8 text-white font-bold text-2xl capitalize shadow-xl ${cardShadows[i]} hover:scale-105 hover:-translate-y-1 active:scale-95 transition-all duration-200 overflow-hidden`}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </div>

              <Sparkles size={16} className="mx-auto mb-3 opacity-60" />
              <span className="relative z-10">{word}</span>
            </button>
          ))}
        </div>

        <p className="text-gray-400 text-xs mt-6">
          {timerValue <= 5 ? '⚡ Hurry! Auto-selecting soon...' : 'Tap a card to select your word'}
        </p>
      </div>
    </div>
  );
}
