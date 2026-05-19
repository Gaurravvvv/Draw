import { useState, useEffect, useCallback, useRef } from 'react';
import { RasterWhiteboard } from './components/RasterWhiteboard';
import { Toolbar } from './components/Toolbar';
import { Toast } from './components/Toast';
import { useStore } from './store';
import { Copy, LogOut, X, Lock, LockOpen, Crown, Pencil, ArrowRight, Gamepad2 } from 'lucide-react';
import { AvatarEditor } from './components/AvatarEditor';
import { AvatarPreview } from './components/AvatarPreview';
import { playDing } from './engine/audio';
import { GameMode } from './game/GameMode';

interface User {
  username: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [roomId, setRoomId] = useState('');
  const [isInStudio, setIsInStudio] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isInGameMode, setIsInGameMode] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');

  // Toast & Avatar from store
  const { toastMessage, toastVisible, toastType, showToast, hideToast, isConnected, avatar, setAvatar, roomUsers, hostId, isLayerLocked } = useStore();

  const prevUserCountRef = useRef(0);
  useEffect(() => {
    if (roomUsers.length > prevUserCountRef.current && prevUserCountRef.current > 0) {
      playDing();
    }
    prevUserCountRef.current = roomUsers.length;
  }, [roomUsers.length]);

  useEffect(() => {
    const handleKicked = () => {
      setRoomId('');
      setIsInStudio(false);
    };
    window.addEventListener('kicked-from-room', handleKicked);
    return () => window.removeEventListener('kicked-from-room', handleKicked);
  }, []);

  const createNotebook = () => {
    const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(newId);
    setIsCreating(true);
    setIsInStudio(true);
  };

  const openNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.length > 2) {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const res = await fetch(`${API_URL}/api/room/${roomId}`);
        const data = await res.json();
        
        if (data.exists) {
          setIsCreating(false);
          setIsInStudio(true);
        } else {
          showToast(`No such room found: ${roomId.toUpperCase()}`, 'error');
          setRoomId('');
        }
      } catch (err) {
        showToast('Failed to check room status', 'error');
      }
    }
  };

  const copyRoomId = useCallback(() => {
    navigator.clipboard.writeText(roomId);
    showToast('Room ID copied to clipboard!');
  }, [roomId, showToast]);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nicknameInput.trim()) {
      setUser({ username: nicknameInput.trim() });
    }
  };

  const handleLogout = () => {
    setUser(null);
    setIsInStudio(false);
    setIsInGameMode(false);
  };

  // --- VIEW: GAME MODE ---
  if (isInGameMode && user) {
    return (
      <GameMode
        nickname={user.username}
        onExit={() => setIsInGameMode(false)}
      />
    );
  }

  // --- VIEW: LOGIN ---
  if (!user) {
    return (
      <div className="min-h-screen bg-paper-bg flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg border border-paper-border w-full max-w-md overflow-hidden p-6 md:p-8 flex flex-col gap-6">
          <div className="flex items-center justify-center gap-3">
            <Pencil className="text-paper-accent w-8 h-8" />
            <h1 className="text-3xl font-bold text-gray-800">Drawwww</h1>
          </div>

          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nickname</label>
              <input
                type="text"
                placeholder="Enter your name..."
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-paper-accent focus:outline-none transition-colors"
                required
                autoFocus
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1 text-center">Customize Avatar</label>
              <AvatarEditor config={avatar} onChange={setAvatar} />
            </div>

            <button
              type="submit"
              className="w-full bg-paper-accent hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Continue <ArrowRight size={18} />
            </button>
          </form>
        </div>
        <Toast message={toastMessage} visible={toastVisible} type={toastType} onClose={hideToast} />
      </div>
    );
  }

  // --- VIEW: LOBBY ---
  if (!isInStudio) {
    return (
      <div className="min-h-screen bg-paper-bg flex flex-col items-center justify-center p-4 relative">
        <button
          onClick={handleLogout}
          className="absolute top-4 right-4 flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors font-bold"
        >
          <LogOut size={20} /> Logout
        </button>

        <div className="bg-white rounded-xl shadow-lg border border-paper-border w-full max-w-md overflow-hidden p-6 md:p-8 flex flex-col gap-6">
          <div className="flex items-center justify-center gap-3">
            <Pencil className="text-paper-accent w-8 h-8" />
            <h1 className="text-3xl font-bold text-gray-800">Drawwww</h1>
          </div>
          
          <div className="text-center">
            <p className="text-gray-500">Welcome back,</p>
            <p className="text-xl font-bold text-gray-800">{user.username}</p>
          </div>

          <button
            onClick={createNotebook}
            className="w-full bg-paper-accent hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            Create New Room
          </button>

          <div className="flex items-center gap-4 text-gray-400">
            <div className="h-px bg-gray-200 flex-1"></div>
            <span className="text-xs uppercase font-bold tracking-wider">or join existing</span>
            <div className="h-px bg-gray-200 flex-1"></div>
          </div>

          <form onSubmit={openNotebook} className="flex gap-2">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Room ID"
              className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-paper-accent focus:outline-none uppercase"
              required
            />
            <button
              type="submit"
              className="bg-gray-800 hover:bg-gray-900 text-white font-bold px-6 py-2 rounded-lg transition-colors"
            >
              Join
            </button>
          </form>

          <div className="flex items-center gap-4 text-gray-400">
            <div className="h-px bg-gray-200 flex-1"></div>
            <span className="text-xs uppercase font-bold tracking-wider">game mode</span>
            <div className="h-px bg-gray-200 flex-1"></div>
          </div>

          <button
            onClick={() => setIsInGameMode(true)}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-md shadow-purple-500/20 hover:shadow-purple-500/30"
          >
            <Gamepad2 size={20} /> Draw This Shytt 🎮
          </button>

        </div>

        <Toast message={toastMessage} visible={toastVisible} type={toastType} onClose={hideToast} />
      </div>
    );
  }

  // --- VIEW: STUDIO ---
  return (
    <div className="relative w-screen h-screen h-[100dvh] bg-paper-bg overflow-hidden">
      <Toolbar />

      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
        <div className="flex items-center gap-3">
          {/* Active Users Avatars */}
          {roomUsers.length > 0 && (
            <div className="flex items-center -space-x-2">
              {roomUsers.map((ru) => {
                const isHost = ru.id === hostId;
                const amIHost = hostId && roomUsers.find(u => u.nickname === user.username)?.id === hostId;
                const isMe = ru.nickname === user.username;

                return (
                  <div key={ru.id} className="relative group cursor-pointer" title={ru.nickname}>
                    <div className="bg-white p-0.5 rounded-full shadow-sm border border-gray-200 hover:scale-110 hover:-translate-y-1 transition-all duration-200 hover:z-20 relative z-0">
                      <AvatarPreview config={ru.avatar} size={32} />
                    </div>
                    
                    {/* Crown for host */}
                    {isHost && (
                      <div className="absolute -top-2 -right-1 z-30">
                        <Crown size={14} className="text-yellow-500 fill-yellow-400 drop-shadow-sm" />
                      </div>
                    )}
                    
                    {/* Tooltip + Kick */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-30">
                      <div className="px-2 py-1 bg-gray-800 text-white text-[10px] font-bold rounded whitespace-nowrap">
                        {ru.nickname}{isHost ? ' 👑' : ''}
                      </div>
                      {amIHost && !isMe && (
                        <button
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('kick-user', { detail: { targetId: ru.id } }));
                          }}
                          className="px-1.5 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-[10px] font-bold transition-colors"
                          title="Kick from room"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Connection Status + Room ID + Lock */}
          <div className="bg-white border border-paper-border px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-mono text-gray-800 flex items-center gap-2 md:gap-3 shadow-sm">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
            <span><span className="hidden md:inline">ID: </span><span className="font-bold select-all">{roomId}</span></span>
            <button onClick={copyRoomId} className="hover:text-paper-accent flex-shrink-0" title="Copy ID">
              <Copy size={14} />
            </button>
            
            {/* Lock Layer button (host only) */}
            {hostId && roomUsers.find(u => u.nickname === user.username)?.id === hostId && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('toggle-layer-lock', { detail: { lock: !isLayerLocked } }))}
                className={`flex-shrink-0 transition-colors ${isLayerLocked ? 'text-amber-500 hover:text-amber-600' : 'text-gray-400 hover:text-paper-accent'}`}
                title={isLayerLocked ? 'Unlock layer' : 'Lock current layer'}
              >
                {isLayerLocked ? <Lock size={14} /> : <LockOpen size={14} />}
              </button>
            )}
          </div>
        </div>

        {/* Exit Room Button */}
        <button
          onClick={() => {
            setIsInStudio(false);
            setRoomId('');
          }}
          className="bg-white hover:bg-red-50 text-red-500 border border-paper-border hover:border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-colors"
          title="Exit Room"
        >
          <LogOut size={14} />
          Exit
        </button>
      </div>

      {/* Disconnection Banner */}
      {!isConnected && (
        <div className="absolute top-16 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm z-10 shadow-sm">
          ⚠️ Disconnected — Reconnecting...
        </div>
      )}

      <RasterWhiteboard roomId={roomId} nickname={user.username} isCreating={isCreating} />
      <Toast message={toastMessage} visible={toastVisible} type={toastType} onClose={hideToast} />
    </div>
  );
}