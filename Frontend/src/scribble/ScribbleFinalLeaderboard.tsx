/**
 * ScribbleFinalLeaderboard — End-of-game leaderboard for Scribble.
 * Shows the winner and final scores.
 */

import { useScribbleStore } from './scribbleStore';
import { AvatarPreview } from '../components/AvatarPreview';
import { Trophy, Medal, Home, RotateCcw, Crown, Star } from 'lucide-react';

interface ScribbleFinalLeaderboardProps {
  onPlayAgain: () => void;
  onExit: () => void;
}

export function ScribbleFinalLeaderboard({ onPlayAgain, onExit }: ScribbleFinalLeaderboardProps) {
  const { finalScores, winner } = useScribbleStore();

  const getMedal = (index: number) => {
    if (index === 0) return { emoji: '🥇', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600' };
    if (index === 1) return { emoji: '🥈', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600' };
    if (index === 2) return { emoji: '🥉', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600' };
    return { emoji: '', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500' };
  };

  return (
    <div className="min-h-screen bg-paper-bg p-4 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <Trophy size={56} className="text-amber-400 mx-auto mb-4" />
          <h1 className="text-5xl font-black text-gray-800 mb-2">Game Over!</h1>
          <p className="text-gray-500">The Scribble master has been revealed</p>
        </div>

        {/* Winner podium */}
        {winner && (
          <div className="text-center mb-8">
            <div className="inline-flex flex-col items-center bg-white rounded-2xl border border-amber-200 shadow-lg px-10 py-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-amber-50 to-transparent" />
              <div className="relative z-10">
                <Crown size={32} className="text-amber-400 mx-auto mb-3" />
                <AvatarPreview config={winner.avatar} size={72} />
                <h2 className="text-2xl font-black text-gray-800 mt-3">{winner.nickname}</h2>
                <div className="flex items-center gap-1 justify-center mt-1">
                  <Star size={16} className="text-amber-400 fill-amber-400" />
                  <span className="text-3xl font-black text-emerald-600">{winner.totalScore}</span>
                  <span className="text-gray-500 text-sm ml-1">points</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Full leaderboard */}
        <div className="bg-white shadow-md rounded-2xl border border-paper-border p-5 mb-6">
          <h2 className="text-gray-800 font-bold text-lg flex items-center gap-2 mb-4">
            <Medal size={20} className="text-emerald-500" /> Final Standings
          </h2>

          <div className="space-y-2">
            {finalScores.map((player, index) => {
              const medal = getMedal(index);
              return (
                <div
                  key={player.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${medal.bg} ${medal.border}`}
                >
                  <span className="text-xl w-8 text-center">{medal.emoji || `#${index + 1}`}</span>
                  <AvatarPreview config={player.avatar} size={36} />
                  <span className="text-gray-800 font-medium flex-1">{player.nickname}</span>
                  <span className={`font-black text-lg ${medal.text}`}>{player.totalScore} pts</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onPlayAgain}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-3 text-lg shadow-md"
          >
            <RotateCcw size={20} /> Play Again
          </button>
          <button
            onClick={onExit}
            className="w-full bg-white hover:bg-gray-50 text-gray-600 font-bold py-3 px-6 rounded-xl border border-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <Home size={18} /> Back to Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
