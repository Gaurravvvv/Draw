/**
 * ScribbleRevealScreen — Shows the word, turn scores, and leaderboard after each turn.
 */

import { useScribbleStore } from './scribbleStore';
import { AvatarPreview } from '../components/AvatarPreview';
import { Trophy, Star, Timer, CheckCircle, XCircle } from 'lucide-react';

export function ScribbleRevealScreen() {
  const { turnScores, leaderboard, revealedWord, timerValue, currentRound, currentTurn, totalRounds, turnsPerRound } = useScribbleStore();

  const sortedScores = [...turnScores].sort((a, b) => b.points - a.points);

  const getMedal = (index: number): string => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return '';
  };

  return (
    <div className="min-h-screen bg-paper-bg p-4 overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="mb-2 flex items-center justify-center gap-4 text-sm text-gray-500">
            <span>Round {currentRound}/{totalRounds}</span>
            <span className="text-gray-300">•</span>
            <span>Turn {currentTurn}/{turnsPerRound}</span>
          </div>

          <h1 className="text-4xl font-black text-gray-800 mb-2">The Word Was...</h1>
          <div className="inline-flex items-center gap-2 bg-white border border-emerald-200 shadow-sm rounded-2xl px-8 py-3">
            <Star size={24} className="text-emerald-400" />
            <span className="text-3xl font-black text-emerald-600 capitalize">
              {revealedWord}
            </span>
          </div>
        </div>

        {/* Turn scores */}
        <div className="bg-white shadow-md rounded-2xl border border-paper-border p-5 mb-6">
          <h2 className="text-gray-800 font-bold text-lg mb-4">Turn Results</h2>

          <div className="space-y-2">
            {sortedScores.map((entry, index) => (
              <div
                key={entry.playerId}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                  entry.guessedCorrectly
                    ? 'bg-emerald-50 border-emerald-200'
                    : entry.points > 0
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <span className="text-lg w-8 text-center">{getMedal(index)}</span>
                <span className="text-gray-800 font-medium flex-1">{entry.nickname}</span>
                {entry.guessedCorrectly ? (
                  <CheckCircle size={16} className="text-emerald-500" />
                ) : entry.points === 0 ? (
                  <XCircle size={16} className="text-gray-400" />
                ) : null}
                <span className={`font-black text-lg ${
                  entry.points > 0 ? 'text-emerald-600' : 'text-gray-400'
                }`}>
                  +{entry.points}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white shadow-md rounded-2xl border border-paper-border p-5 mb-6">
          <h2 className="text-gray-800 font-bold text-lg flex items-center gap-2 mb-4">
            <Trophy size={20} className="text-amber-400" /> Leaderboard
          </h2>

          <div className="space-y-2">
            {leaderboard.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                  index === 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <span className="text-xl w-8 text-center">{getMedal(index) || `#${index + 1}`}</span>
                <AvatarPreview config={player.avatar} size={32} />
                <span className="text-gray-800 font-medium flex-1">{player.nickname}</span>
                <span className="text-emerald-600 font-black text-lg">{player.totalScore} pts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Next turn countdown */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-5 py-2">
            <Timer size={16} className="text-emerald-500" />
            <span className="text-gray-600 text-sm font-medium">
              Next turn in <span className="text-gray-800 font-bold">{timerValue}</span>s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
