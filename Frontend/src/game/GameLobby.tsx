/**
 * GameLobby — Room creation/join screen with customizable settings.
 * Host can configure rounds, max players, draw time, and word source.
 */

import { useState } from 'react';
import { useGameStore } from './gameStore';
import { useStore } from '../store';
import { AvatarPreview } from '../components/AvatarPreview';
import { Crown, Copy, Settings, Users, Timer, Hash, Sparkles, BookOpen, Play, ArrowLeft, LogIn } from 'lucide-react';

const CATEGORIES = ['Animals', 'Objects', 'Food', 'Places'];

interface GameLobbyProps {
  onCreateRoom: (nickname: string, avatar: any, settings: any) => void;
  onJoinRoom: (roomCode: string, nickname: string, avatar: any) => void;
  onUpdateSettings: (roomCode: string, settings: any) => void;
  onStartGame: (roomCode: string) => void;
  onBack: () => void;
  nickname: string;
}

export function GameLobby({ onCreateRoom, onJoinRoom, onUpdateSettings, onStartGame, onBack, nickname }: GameLobbyProps) {
  const { roomCode, isHost, players, settings, hostId } = useGameStore();
  const avatar = useStore(s => s.avatar);
  const [joinCode, setJoinCode] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const inRoom = !!roomCode;

  const handleCreate = () => {
    onCreateRoom(nickname, avatar, settings);
  };

  const handleJoin = () => {
    if (joinCode.trim().length >= 3) {
      onJoinRoom(joinCode.trim().toUpperCase(), nickname, avatar);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
  };

  if (!inRoom) {
    return (
      <div className="min-h-screen bg-paper-bg flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-black text-gray-800 mb-2 drop-shadow-sm tracking-tight">
              Draw This Shytt
            </h1>
            <p className="text-gray-500 text-sm">AI-scored drawing battles</p>
          </div>

          <div className="bg-white rounded-xl border border-paper-border p-6 space-y-5 shadow-lg">
            <button
              onClick={handleCreate}
              className="w-full bg-paper-accent hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-3 text-lg shadow-md"
            >
              <Play size={22} /> Create Game Room
            </button>

            <div className="flex items-center gap-3 text-gray-400">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="text-xs uppercase font-bold tracking-wider">or join</span>
              <div className="h-px bg-gray-200 flex-1" />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                maxLength={5}
                className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-800 font-mono text-center text-lg tracking-widest focus:border-paper-accent focus:outline-none transition-all placeholder:text-gray-400 uppercase"
              />
              <button
                onClick={handleJoin}
                disabled={joinCode.trim().length < 3}
                className="bg-gray-800 hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-5 py-3 rounded-xl transition-all flex items-center gap-2"
              >
                <LogIn size={18} /> Join
              </button>
            </div>

            <button
              onClick={onBack}
              className="w-full text-gray-400 hover:text-gray-600 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft size={16} /> Back to Main Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // In-room lobby
  return (
    <div className="min-h-screen bg-paper-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-black text-gray-800 mb-1">
            Game Lobby
          </h1>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="bg-gray-100 text-gray-800 font-mono text-2xl tracking-[0.3em] px-5 py-2 rounded-xl border border-gray-200">
              {roomCode}
            </span>
            <button onClick={copyCode} className="text-gray-400 hover:text-paper-accent transition-colors p-2 rounded-lg hover:bg-gray-100" title="Copy code">
              <Copy size={20} />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-paper-border p-6 space-y-5 shadow-lg">
          {/* Players */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <Users size={18} className="text-paper-accent" /> Players ({players.length}/{settings.maxPlayers})
              </h3>
              {isHost && (
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-gray-400 hover:text-paper-accent transition-colors p-1.5 rounded-lg hover:bg-gray-100"
                >
                  <Settings size={18} />
                </button>
              )}
            </div>

            <div className="space-y-2">
              {players.map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                  <AvatarPreview config={p.avatar} size={36} />
                  <span className="text-gray-800 font-medium flex-1">{p.nickname}</span>
                  {p.id === hostId && (
                    <div className="flex items-center gap-1 text-amber-500 text-xs font-bold bg-amber-50 px-2 py-1 rounded-lg">
                      <Crown size={12} /> HOST
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Settings panel (host only) */}
          {showSettings && isHost && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-200">
              <h4 className="text-gray-800 font-bold text-sm flex items-center gap-2">
                <Settings size={14} className="text-paper-accent" /> Game Settings
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 flex items-center gap-1">
                    <Hash size={12} /> Rounds
                  </label>
                  <select
                    value={settings.rounds}
                    onChange={(e) => onUpdateSettings(roomCode, { rounds: Number(e.target.value) })}
                    className="w-full bg-white text-gray-800 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-paper-accent focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 flex items-center gap-1">
                    <Users size={12} /> Max Players
                  </label>
                  <select
                    value={settings.maxPlayers}
                    onChange={(e) => onUpdateSettings(roomCode, { maxPlayers: Number(e.target.value) })}
                    className="w-full bg-white text-gray-800 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-paper-accent focus:outline-none"
                  >
                    {[2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 flex items-center gap-1">
                    <Timer size={12} /> Draw Time
                  </label>
                  <select
                    value={settings.drawTime}
                    onChange={(e) => onUpdateSettings(roomCode, { drawTime: Number(e.target.value) })}
                    className="w-full bg-white text-gray-800 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-paper-accent focus:outline-none"
                  >
                    {[30, 45, 60, 90, 120].map(n => <option key={n} value={n}>{n}s</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1 flex items-center gap-1">
                    <BookOpen size={12} /> Words
                  </label>
                  <select
                    value={settings.wordSource}
                    onChange={(e) => onUpdateSettings(roomCode, { wordSource: e.target.value })}
                    className="w-full bg-white text-gray-800 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-paper-accent focus:outline-none"
                  >
                    <option value="predefined">Predefined</option>
                    <option value="ai">AI Generated ✨</option>
                  </select>
                </div>
              </div>

              {settings.wordSource === 'predefined' && (
                <div>
                  <label className="text-gray-500 text-xs font-medium mb-1">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => onUpdateSettings(roomCode, { wordCategory: cat })}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          settings.wordCategory === cat
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Current settings summary */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="bg-gray-100 px-2 py-1 rounded-md border border-gray-200">{settings.rounds} rounds</span>
            <span className="bg-gray-100 px-2 py-1 rounded-md border border-gray-200">{settings.drawTime}s draw time</span>
            <span className="bg-gray-100 px-2 py-1 rounded-md border border-gray-200 flex items-center gap-1">
              {settings.wordSource === 'ai' ? <><Sparkles size={10} className="text-paper-accent" /> AI Words</> : settings.wordCategory}
            </span>
          </div>

          {/* Start / Leave */}
          {isHost ? (
            <button
              onClick={() => onStartGame(roomCode)}
              disabled={players.length < 2}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-3 text-lg shadow-md"
            >
              <Play size={22} /> {players.length < 2 ? 'Need 2+ players' : 'Start Game'}
            </button>
          ) : (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-gray-500 text-sm">
                <div className="w-2 h-2 rounded-full bg-paper-accent animate-pulse" />
                Waiting for host to start...
              </div>
            </div>
          )}

          <button
            onClick={onBack}
            className="w-full text-gray-400 hover:text-gray-600 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft size={16} /> Leave Room
          </button>
        </div>
      </div>
    </div>
  );
}
