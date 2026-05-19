/**
 * RevealScreen — Shows all drawings side by side with AI scores.
 * Includes turn leaderboard and auto-countdown to next turn.
 */

import { useGameStore } from './gameStore';
import { AvatarPreview } from '../components/AvatarPreview';
import { Trophy, Star, Timer, Sparkles } from 'lucide-react';

export function RevealScreen() {
  const { turnScores, leaderboard, selectedWord, timerValue, currentRound, currentTurn, totalRounds } = useGameStore();

  // Sort turn scores by score descending
  const sortedScores = [...turnScores].sort((a, b) => b.score - a.score);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-emerald-400';
    if (score >= 40) return 'text-amber-400';
    if (score >= 20) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number): string => {
    if (score >= 80) return 'from-green-50 to-emerald-50 border-green-200';
    if (score >= 60) return 'from-emerald-50 to-teal-50 border-emerald-200';
    if (score >= 40) return 'from-amber-50 to-yellow-50 border-amber-200';
    if (score >= 20) return 'from-orange-50 to-red-50 border-orange-200';
    return 'from-red-50 to-rose-50 border-red-200';
  };

  const getMedal = (index: number): string => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return '';
  };

  return (
    <div className="min-h-screen bg-paper-bg p-4 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="mb-2 flex items-center justify-center gap-4 text-sm text-gray-500">
            <span>Round {currentRound}/{totalRounds}</span>
            <span className="text-gray-300">•</span>
            <span>Turn {currentTurn}/3</span>
          </div>

          <h1 className="text-4xl font-black text-gray-800 mb-2">The Word Was...</h1>
          <div className="inline-flex items-center gap-2 bg-white border border-paper-border shadow-sm rounded-2xl px-8 py-3">
            <Sparkles size={24} className="text-amber-400" />
            <span className="text-3xl font-black text-paper-accent capitalize">
              {selectedWord}
            </span>
          </div>
        </div>

        {/* Drawings grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {sortedScores.map((entry, index) => (
            <div
              key={entry.playerId}
              className={`bg-gradient-to-br ${getScoreBg(entry.score)} backdrop-blur-sm rounded-2xl border overflow-hidden transition-all hover:scale-[1.02]`}
            >
              {/* Drawing */}
              <div className="bg-white rounded-t-xl m-2 mb-0 overflow-hidden">
                {entry.drawingPng ? (
                  <img
                    src={entry.drawingPng}
                    alt={`${entry.nickname}'s drawing`}
                    className="w-full aspect-video object-contain"
                  />
                ) : (
                  <div className="w-full aspect-video bg-gray-100 flex items-center justify-center text-gray-400">
                    No drawing submitted
                  </div>
                )}
              </div>

              {/* Score + Name */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getMedal(index)}</span>
                  <span className="text-gray-800 font-bold">{entry.nickname}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star size={18} className={getScoreColor(entry.score)} />
                  <span className={`text-3xl font-black ${getScoreColor(entry.score)}`}>
                    {entry.score}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Leaderboard */}
        <div className="bg-white shadow-md rounded-2xl border border-paper-border p-6 mb-6">
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
                <span className="text-paper-accent font-black text-lg">{player.totalScore} pts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Next turn countdown */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-5 py-2">
            <Timer size={16} className="text-paper-accent" />
            <span className="text-gray-600 text-sm font-medium">
              Next turn in <span className="text-gray-800 font-bold">{timerValue}</span>s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
