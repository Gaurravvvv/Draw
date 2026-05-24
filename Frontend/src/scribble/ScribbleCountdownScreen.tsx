/**
 * ScribbleCountdownScreen — 3..2..1 countdown before drawing begins.
 */

import { useScribbleStore } from './scribbleStore';

export function ScribbleCountdownScreen() {
  const { timerValue, blanks, role } = useScribbleStore();

  return (
    <div className="min-h-screen bg-paper-bg flex flex-col items-center justify-center p-4">
      <div className="text-center">
        {/* Blanks preview */}
        <div className="mb-8">
          <p className="text-gray-500 text-sm mb-3">
            {role === 'drawer' ? 'You are drawing!' : 'Get ready to guess!'}
          </p>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-8 py-4 inline-block">
            <span className="text-2xl font-black font-mono tracking-[0.5em] text-gray-800">
              {blanks || '_ _ _ _ _'}
            </span>
          </div>
        </div>

        {/* Countdown number */}
        <div className="relative">
          <span
            key={timerValue}
            className="text-9xl font-black text-emerald-500 animate-bounce inline-block"
          >
            {timerValue}
          </span>
        </div>

        <p className="text-gray-400 text-sm mt-4">
          {role === 'drawer' ? 'Canvas is loading...' : 'Eyes on the canvas!'}
        </p>
      </div>
    </div>
  );
}
