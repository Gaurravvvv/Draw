import { useState, useEffect, useCallback } from 'react';
import { RasterWhiteboard } from './components/RasterWhiteboard';
import { Toolbar } from './components/Toolbar';
import { Toast } from './components/Toast';
import { useStore } from './store';
import { BookPlus, FolderOpen, ArrowRight, LogIn, Copy, LogOut, UserPlus, Mail, Lock, User as UserIcon, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface User {
  _id: string;
  googleId?: string;
  username: string;
  email: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [roomId, setRoomId] = useState('');
  const [isInStudio, setIsInStudio] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth State
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');

  // Toast from store
  const { toastMessage, toastVisible, toastType, showToast, hideToast, isConnected } = useStore();

  // 1. Session Check
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_URL}/api/current_user`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (data && data._id) {
          setUser(data);
        }
      } catch (err) {
        console.log('Not logged in');
      } finally {
        setIsCheckingSession(false);
      }
    };
    fetchUser();
  }, []);

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

  const copyRoomId = useCallback(() => {
    navigator.clipboard.writeText(roomId);
    showToast('Room ID copied to clipboard!');
  }, [roomId, showToast]);

  // 3. Auth Handlers
  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  const handleLogout = () => {
    window.location.href = `${API_URL}/auth/logout`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const endpoint = authMode === 'signin' ? '/api/login' : '/api/register';

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      setUser(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- VIEW: LOADING ---
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-paper-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-paper-accent animate-spin" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // --- VIEW: LOGIN ---
  if (!user) {
    return (
      <div className="min-h-screen bg-paper-bg flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg border border-paper-border w-full max-w-md overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-paper-border">
            <button
              onClick={() => { setAuthMode('signin'); setError(''); }}
              className={`flex-1 py-4 font-bold text-sm transition-colors ${authMode === 'signin'
                  ? 'text-paper-accent border-b-2 border-paper-accent bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setError(''); }}
              className={`flex-1 py-4 font-bold text-sm transition-colors ${authMode === 'signup'
                  ? 'text-paper-accent border-b-2 border-paper-accent bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Sign Up
            </button>
          </div>

          <div className="p-8">
            <h1 className="text-2xl font-bold text-center text-paper-text mb-2">
              {authMode === 'signin' ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-center text-gray-500 mb-6 text-sm">
              {authMode === 'signin' ? 'Enter your details to sign in' : 'Start your creative journey today'}
            </p>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    type="text"
                    name="username"
                    placeholder="Full Name"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-2 border border-paper-border rounded-lg outline-none focus:border-paper-accent transition-colors"
                    required
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="email"
                  name="email"
                  placeholder="Email Address"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-2 border border-paper-border rounded-lg outline-none focus:border-paper-accent transition-colors"
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-2 border border-paper-border rounded-lg outline-none focus:border-paper-accent transition-colors"
                  required
                  minLength={6}
                />
              </div>

              {authMode === 'signup' && (
                <p className="text-xs text-gray-400">Min 6 characters, must include letters and numbers</p>
              )}

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-paper-accent text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : authMode === 'signin' ? (
                  <LogIn size={20} />
                ) : (
                  <UserPlus size={20} />
                )}
                {isSubmitting
                  ? 'Please wait...'
                  : authMode === 'signin'
                    ? 'Sign In'
                    : 'Create Account'}
              </button>
            </form>

            <div className="flex items-center my-6">
              <div className="flex-1 h-px bg-gray-200"></div>
              <span className="px-3 text-gray-400 text-xs font-bold">OR</span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-3"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
              {authMode === 'signin' ? 'Continue with Google' : 'Sign up with Google'}
            </button>
          </div>
        </div>

        <Toast message={toastMessage} visible={toastVisible} type={toastType} onClose={hideToast} />
      </div>
    );
  }

  // --- VIEW: LOBBY ---
  if (!isInStudio) {
    return (
      <div className="min-h-screen bg-paper-bg flex flex-col items-center justify-center p-4 text-paper-text font-sans relative">
        <button
          onClick={handleLogout}
          className="absolute top-4 right-4 flex items-center gap-2 text-gray-500 hover:text-red-500 transition-colors"
        >
          <LogOut size={20} /> Logout
        </button>

        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-paper-accent">Welcome, {user.username}</h1>
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

        <Toast message={toastMessage} visible={toastVisible} type={toastType} onClose={hideToast} />
      </div>
    );
  }

  // --- VIEW: STUDIO ---
  return (
    <div className="relative w-screen h-screen bg-paper-bg overflow-hidden">
      <Toolbar />

      {/* Connection Status + Room ID */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur border border-paper-border px-4 py-2 rounded-full text-sm font-mono text-paper-text z-10 flex items-center gap-3 shadow-sm">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <span>ID: <span className="font-bold select-all">{roomId}</span></span>
        <button onClick={copyRoomId} className="hover:text-paper-accent" title="Copy ID">
          <Copy size={14} />
        </button>
      </div>

      {/* Disconnection Banner */}
      {!isConnected && (
        <div className="absolute top-16 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm z-10 shadow-sm">
          ⚠️ Disconnected — Reconnecting...
        </div>
      )}

      <RasterWhiteboard roomId={roomId} />
      <Toast message={toastMessage} visible={toastVisible} type={toastType} onClose={hideToast} />
    </div>
  );
}