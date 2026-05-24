/**
 * ScribbleWaitingScreen — Shown to guessers while the drawer picks a word.
 */

import { useScribbleStore } from './scribbleStore';
import { Loader2, Palette } from 'lucide-react';

export function ScribbleWaitingScreen() {
  const { drawerName, currentRound, currentTurn, totalRounds, turnsPerRound, timerValue } = useScribbleStore();

  return (
    <div className="min-h-screen bg-paper-bg flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mb-4 flex items-center justify-center gap-4 text-sm text-gray-500">
          <span>Round {currentRound}/{totalRounds}</span>
          <span className="text-gray-300">•</span>
          <span>Turn {currentTurn}/{turnsPerRound}</span>
        </div>

        <div className="mb-6">
          <Palette size={56} className="text-emerald-400 mx-auto mb-4 animate-bounce" />
          <h1 className="text-3xl font-black text-gray-800 mb-2">
            {drawerName} is picking a word...
          </h1>
          <p className="text-gray-500 text-sm">
            Get ready to guess what they draw!
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Loader2 size={20} className="text-emerald-500 animate-spin" />
          <span className="text-gray-500 font-medium">{timerValue}s remaining</span>
        </div>
      </div>
    </div>
  );
}
