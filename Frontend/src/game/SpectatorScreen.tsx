/**
 * SpectatorScreen — Picker's view during drawing phase.
 * Shows live canvas thumbnails from all drawers, switchable as full-size preview.
 */

import { useState } from 'react';
import { useGameStore } from './gameStore';
import { AvatarPreview } from '../components/AvatarPreview';
import { Eye, Timer, Users } from 'lucide-react';

export function SpectatorScreen() {
  const { spectatorCanvases, players, pickerId, timerValue, currentRound, currentTurn, totalRounds } = useGameStore();
  const selectedWord = useGameStore(s => s.selectedWord);
  const [activeTab, setActiveTab] = useState<string>('');

  // Filter to non-picker players
  const drawers = players.filter(p => p.id !== pickerId);
  const canvasEntries = Array.from(spectatorCanvases.entries());

  // Current active canvas
  const activeCanvas = activeTab
    ? spectatorCanvases.get(activeTab)
    : canvasEntries[0]?.[1];
  const activeUserId = activeTab || canvasEntries[0]?.[0] || '';

  const isUrgent = timerValue <= 10;

  return (
    <div className="min-h-screen bg-paper-bg p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 flex items-center gap-2">
              <Eye size={18} className="text-paper-accent" />
              <span className="text-gray-800 font-bold">Spectator Mode</span>
            </div>
            <span className="text-gray-500 text-sm">
              R{currentRound}/{totalRounds} • T{currentTurn}/3
            </span>
          </div>

          <div className="flex items-center gap-3">
            {selectedWord && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
                <span className="text-amber-600 font-bold text-lg capitalize">"{selectedWord}"</span>
              </div>
            )}
            <div className="bg-white border border-paper-border shadow-sm rounded-xl px-4 py-2 flex items-center gap-2">
              <Timer size={18} className={isUrgent ? 'text-red-500 animate-pulse' : 'text-paper-accent'} />
              <span className={`text-2xl font-black font-mono ${isUrgent ? 'text-red-500' : 'text-gray-800'}`}>
                {timerValue}
              </span>
            </div>
          </div>
        </div>

        {/* Player tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {drawers.map(player => {
            const hasCanvas = spectatorCanvases.has(player.id);
            const isActive = player.id === activeUserId;
            return (
              <button
                key={player.id}
                onClick={() => setActiveTab(player.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all flex-shrink-0 ${
                  isActive
                    ? 'bg-blue-50 border-paper-accent text-paper-accent'
                    : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                <AvatarPreview config={player.avatar} size={24} />
                <span className="font-medium text-sm">{player.nickname}</span>
                {hasCanvas && <div className="w-2 h-2 rounded-full bg-green-500" />}
              </button>
            );
          })}
        </div>

        {/* Main canvas preview */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
          {activeCanvas ? (
            <div className="text-center">
              <img
                src={activeCanvas.pngBase64}
                alt={`${activeCanvas.nickname}'s drawing`}
                className="max-w-full max-h-[60vh] mx-auto rounded-xl shadow-lg border border-gray-200"
                style={{ imageRendering: 'auto' }}
              />
              <p className="text-gray-500 text-sm mt-3">
                {activeCanvas.nickname}'s canvas • Live
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <div className="w-full max-w-2xl aspect-video bg-white rounded-xl border border-gray-200 flex items-center justify-center mb-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-50 to-transparent animate-pulse" />
                <div className="text-center z-10">
                  <Users size={36} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-500 text-sm font-medium">Canvases loading...</p>
                </div>
              </div>
              <p className="text-sm text-gray-400">Live drawings appear here as players start drawing</p>
            </div>
          )}
        </div>

        {/* Thumbnail grid */}
        {canvasEntries.length > 1 && (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-4">
            {canvasEntries.map(([userId, canvas]) => (
              <button
                key={userId}
                onClick={() => setActiveTab(userId)}
                className={`rounded-xl overflow-hidden border-2 transition-all hover:scale-105 ${
                  userId === activeUserId ? 'border-paper-accent shadow-md' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <img
                  src={canvas.pngBase64}
                  alt={canvas.nickname}
                  className="w-full aspect-video object-cover bg-white"
                />
                <div className="bg-white border-t border-gray-200 px-2 py-1 text-xs text-gray-600 text-center font-medium truncate">
                  {canvas.nickname}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
