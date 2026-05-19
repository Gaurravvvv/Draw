/**
 * FinalLeaderboard — End-of-game screen with winner highlight and all scores.
 */

import { useGameStore } from './gameStore';
import { AvatarPreview } from '../components/AvatarPreview';
import { Trophy, Crown, ArrowLeft, RotateCcw } from 'lucide-react';

interface FinalLeaderboardProps {
  onPlayAgain: () => void;
  onExit: () => void;
}

export function FinalLeaderboard({ onPlayAgain, onExit }: FinalLeaderboardProps) {
  const { finalScores, winner } = useGameStore();

  const getMedal = (index: number): string => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return '';
  };

  const getPodiumHeight = (index: number): string => {
    if (index === 0) return 'h-36';
    if (index === 1) return 'h-28';
    if (index === 2) return 'h-20';
    return 'h-16';
  };

  const getPodiumGradient = (index: number): string => {
    if (index === 0) return 'from-amber-500 to-yellow-600';
    if (index === 1) return 'from-gray-400 to-gray-500';
    if (index === 2) return 'from-amber-700 to-amber-800';
    return 'from-gray-700 to-gray-800';
  };

  // Reorder for podium: [2nd, 1st, 3rd]
  const podiumOrder = finalScores.length >= 3
    ? [finalScores[1], finalScores[0], finalScores[2]]
    : finalScores.slice(0, 3);

  return (
    <div className="min-h-screen bg-paper-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Title */}
        <div className="text-center mb-8">
          <div className="mb-4 relative inline-block">
            <Trophy size={64} className="text-amber-400 drop-shadow-md mx-auto" />
            <div className="absolute inset-0 blur-xl bg-amber-400/20" />
          </div>
          <h1 className="text-5xl font-black text-gray-800 mb-2">
            Game Over!
          </h1>
          {winner && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <Crown size={20} className="text-amber-400" />
              <span className="text-gray-800 text-xl font-bold">{winner.nickname} wins!</span>
              <Crown size={20} className="text-amber-400" />
            </div>
          )}
        </div>

        {/* Podium */}
        {podiumOrder.length >= 3 && (
          <div className="flex items-end justify-center gap-2 mb-8 h-52">
            {podiumOrder.map((player, podiumIdx) => {
              const realIndex = podiumIdx === 1 ? 0 : podiumIdx === 0 ? 1 : 2;
              return (
                <div key={player.id} className="flex flex-col items-center w-28">
                  <div className="mb-2">
                    <div className={`relative ${realIndex === 0 ? 'scale-125' : ''}`}>
                      <div className="bg-white p-1 rounded-full border-2 border-gray-200 shadow-sm">
                        <AvatarPreview config={player.avatar} size={realIndex === 0 ? 48 : 36} />
                      </div>
                      {realIndex === 0 && (
                        <Crown size={20} className="text-amber-400 absolute -top-3 left-1/2 -translate-x-1/2 drop-shadow-sm" />
                      )}
                    </div>
                  </div>
                  <span className="text-gray-800 font-bold text-sm mb-1 truncate max-w-full">{player.nickname}</span>
                  <span className="text-paper-accent font-black text-lg mb-2">{player.totalScore}</span>
                  <div className={`w-full ${getPodiumHeight(realIndex)} bg-gradient-to-t ${getPodiumGradient(realIndex)} rounded-t-xl flex items-center justify-center`}>
                    <span className="text-3xl">{getMedal(realIndex)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Full leaderboard */}
        <div className="bg-white shadow-md rounded-2xl border border-paper-border p-5 mb-6">
          <h2 className="text-gray-800 font-bold text-lg flex items-center gap-2 mb-4">
            <Trophy size={18} className="text-amber-400" /> Final Standings
          </h2>
          <div className="space-y-2">
            {finalScores.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  index === 0
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <span className="text-xl w-8 text-center font-bold">
                  {getMedal(index) || `#${index + 1}`}
                </span>
                <AvatarPreview config={player.avatar} size={32} />
                <span className="text-gray-800 font-medium flex-1">{player.nickname}</span>
                <span className={`font-black text-lg ${index === 0 ? 'text-amber-500' : 'text-paper-accent'}`}>
                  {player.totalScore} pts
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onPlayAgain}
            className="flex-1 bg-paper-accent hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98]"
          >
            <RotateCcw size={18} /> Play Again
          </button>
          <button
            onClick={onExit}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
          >
            <ArrowLeft size={18} /> Exit
          </button>
        </div>
      </div>
    </div>
  );
}
