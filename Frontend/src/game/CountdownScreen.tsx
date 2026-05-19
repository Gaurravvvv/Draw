/**
 * CountdownScreen — "Drawing starts in 3...2...1" overlay
 */

import { useGameStore } from './gameStore';

export function CountdownScreen() {
  const { timerValue } = useGameStore();

  return (
    <div className="min-h-screen bg-paper-bg flex flex-col items-center justify-center p-4">
      <div className="text-center">
        <p className="text-gray-500 text-lg mb-8 font-medium">Drawing starts in</p>
        
        <div className="relative">
          {/* Pulsing ring */}
          <div className="absolute inset-0 w-48 h-48 mx-auto rounded-full bg-blue-100 animate-ping" style={{ animationDuration: '1s' }} />
          
          {/* Number */}
          <div className="w-48 h-48 mx-auto rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center backdrop-blur-sm">
            <span className="text-8xl font-black text-paper-accent animate-bounce" style={{ animationDuration: '0.6s' }}>
              {timerValue > 0 ? timerValue : '🎨'}
            </span>
          </div>
        </div>

        <p className="text-gray-600 text-sm mt-8 font-medium animate-pulse">
          Get ready to draw!
        </p>
      </div>
    </div>
  );
}
