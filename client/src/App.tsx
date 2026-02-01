import { useState } from 'react';
import { Whiteboard } from './components/Whiteboard';
import { Toolbar } from './components/Toolbar';
import { BookPlus, FolderOpen, ArrowRight, LogIn, Copy } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<string | null>(null); // 'admin' or 'admin1'
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');

  const [roomId, setRoomId] = useState('');
  const [isInStudio, setIsInStudio] = useState(false);

  // 1. Login Logic
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (usernameInput === 'admin' && passwordInput === 'admin') ||
      (usernameInput === 'admin1' && passwordInput === 'admin1')
    ) {
      setUser(usernameInput);
      setError('');
    } else {
      setError('Invalid credentials. Use admin/admin or admin1/admin1');
    }
  };

  // 2. Room Logic
  const createNotebook = () => {
    const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(newId);
    setIsInStudio(true);
  };

  const openNotebook = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.length > 2) {
      setIsInStudio(true);
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    alert('Room ID copied!');
  };

  // --- VIEW: LOGIN ---
  if (!user) {
    return (
      <div className="min-h-screen bg-paper-bg flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-paper-border w-full max-w-md">
          <h1 className="text-3xl font-bold text-paper-accent mb-2 text-center">Lets Draw</h1>
          <p className="text-gray-500 text-center mb-6">Sign in to your notebook</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-paper-text mb-1">Username</label>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full border border-paper-border rounded-lg px-4 py-2 focus:border-paper-accent outline-none bg-paper-bg"
                placeholder="admin or admin1"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-paper-text mb-1">Password</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full border border-paper-border rounded-lg px-4 py-2 focus:border-paper-accent outline-none bg-paper-bg"
                placeholder="••••••"
              />
            </div>
            
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button type="submit" className="w-full bg-paper-accent text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
              <LogIn size={20} /> Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- VIEW: LOBBY ---
  if (!isInStudio) {
    return (
      <div className="min-h-screen bg-paper-bg flex flex-col items-center justify-center p-4 text-paper-text font-sans">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-paper-accent">Welcome, {user}</h1>
          <p className="text-gray-500 mt-2">Choose an option to start drawing</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl">
          {/* Create Button */}
          <button 
            onClick={createNotebook}
            className="flex-1 bg-white border border-paper-border p-8 rounded-xl shadow-sm hover:shadow-md hover:border-paper-accent transition-all group text-left"
          >
            <BookPlus className="w-12 h-12 mb-4 text-paper-accent" />
            <h2 className="text-2xl font-bold mb-2">Create Notebook</h2>
            <p className="text-gray-500">Start a fresh blank page.</p>
          </button>

          {/* Open Section */}
          <div className="flex-1 bg-white border border-paper-border p-8 rounded-xl shadow-sm">
            <FolderOpen className="w-12 h-12 mb-4 text-gray-400" />
            <h2 className="text-2xl font-bold mb-4">Open Notebook</h2>
            <form onSubmit={openNotebook} className="flex gap-2">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter ID"
                className="flex-1 border border-paper-border rounded-lg px-3 py-2 outline-none focus:border-paper-accent uppercase"
              />
              <button 
                type="submit" 
                className="bg-paper-accent text-white p-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ArrowRight size={20} />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW: STUDIO ---
  return (
    <div className="relative w-screen h-screen bg-paper-bg overflow-hidden">
      <Toolbar />
      
      {/* Room ID Indicator */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur border border-paper-border px-4 py-2 rounded-full text-sm font-mono text-paper-text z-10 flex items-center gap-3 shadow-sm">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span>ID: <span className="font-bold select-all">{roomId}</span></span>
        <button onClick={copyRoomId} className="hover:text-paper-accent" title="Copy ID">
          <Copy size={14} />
        </button>
      </div>

      <Whiteboard roomId={roomId} />
    </div>
  );
}
