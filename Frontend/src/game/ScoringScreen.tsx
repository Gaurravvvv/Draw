/**
 * ScoringScreen — Shown while AI is scoring the drawings.
 * Animated loading screen with progress indication.
 */

import { Bot, Sparkles } from 'lucide-react';

export function ScoringScreen() {
  return (
    <div className="min-h-screen bg-paper-bg flex flex-col items-center justify-center p-4">
      <div className="text-center">
        {/* AI Brain animation */}
        <div className="relative mb-8">
          <div className="w-36 h-36 mx-auto rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
            <Bot size={56} className="text-paper-accent" />
          </div>
          
          {/* Orbiting sparkles */}
          <div className="absolute inset-0 w-36 h-36 mx-auto animate-spin" style={{ animationDuration: '3s' }}>
            <Sparkles size={16} className="text-amber-400 absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2" />
          </div>
          <div className="absolute inset-0 w-36 h-36 mx-auto animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}>
            <Sparkles size={12} className="text-pink-400 absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2" />
          </div>
          <div className="absolute inset-0 w-36 h-36 mx-auto animate-spin" style={{ animationDuration: '5s' }}>
            <Sparkles size={14} className="text-cyan-400 absolute top-1/2 right-0 translate-x-2 -translate-y-1/2" />
          </div>
          
          {/* Pulse ring */}
          <div className="absolute inset-0 w-36 h-36 mx-auto rounded-full bg-blue-100 animate-ping" style={{ animationDuration: '2s' }} />
        </div>

        <h1 className="text-3xl font-black text-gray-800 mb-3">
          AI is Judging... 🤖
        </h1>
        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
          Gemini Vision is analyzing every drawing and scoring accuracy
        </p>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2">
          <div className="w-3 h-3 rounded-full bg-paper-accent animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-3 h-3 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-3 h-3 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
