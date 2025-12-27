'use client'

import { useState, useEffect } from 'react';
import { authUser, logout, getData, incrementCounter, updateTargets } from './actions';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [error, setError] = useState('');

  // Fetch data on load
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const data = await getData();
    setUser(data);
    setLoading(false);
  }

  // --- Handlers ---
  async function handleAuth(formData) {
    formData.append('mode', authMode);
    const res = await authUser(formData);
    if (res?.error) {
      setError(res.error);
    } else {
      loadData(); // Reload to get user data
      setError('');
    }
  }

  async function handleTap() {
    // Optimistic update (feels faster)
    setUser(prev => ({
      ...prev,
      dailyCount: prev.dailyCount + 1,
      totalCount: prev.totalCount + 1
    }));
    
    // Server update
    await incrementCounter();
  }

  async function handleSettings(formData) {
    await updateTargets(formData);
    loadData();
    alert('Targets updated!');
  }

  if (loading) return <div className="p-10">Loading...</div>;

  // --- LOGIN SCREEN ---
  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-100">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm">
          <h1 className="text-2xl font-bold mb-6 text-center text-black">
            {authMode === 'login' ? 'Login' : 'Create Account'}
          </h1>
          <form action={handleAuth} className="flex flex-col gap-4">
            <input name="username" placeholder="Username" required className="p-3 border rounded text-black" />
            <input name="password" type="password" placeholder="Password" required className="p-3 border rounded text-black" />
            <button className="bg-blue-600 text-white p-3 rounded hover:bg-blue-700 font-bold">
              {authMode === 'login' ? 'Enter' : 'Sign Up'}
            </button>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          </form>
          <p className="mt-4 text-center text-sm text-gray-600 cursor-pointer" 
             onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
            {authMode === 'login' ? "New? Click to Register" : "Have an account? Login"}
          </p>
        </div>
      </main>
    );
  }

  // --- DASHBOARD SCREEN ---
  const dailyProgress = Math.min((user.dailyCount / user.dailyTarget) * 100, 100);
  const totalProgress = Math.min((user.totalCount / user.finalTarget) * 100, 100);

  return (
    <main className="flex min-h-screen flex-col items-center p-4 bg-gray-50 text-black">
      {/* Header */}
      <div className="w-full max-w-md flex justify-between items-center mb-8">
        <h2 className="font-bold text-gray-700">Hi, {user.username}</h2>
        <form action={async () => { await logout(); setUser(null); }}>
          <button className="text-sm text-red-500 hover:underline">Logout</button>
        </form>
      </div>

      {/* Main Counter Button */}
      <button 
        onClick={handleTap}
        className="w-64 h-64 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex flex-col items-center justify-center shadow-2xl active:scale-95 transition-transform"
      >
        <span className="text-xl opacity-80">राधे राधे</span>
        <span className="text-8xl font-bold">{user.dailyCount}</span>
        <span className="text-sm mt-2 opacity-80">राधा कृष्ण</span>
      </button>

      {/* Stats Cards */}
      <div className="w-full max-w-md mt-10 grid gap-4">
        
        {/* Daily Target */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex justify-between text-sm mb-1">
            <span>Daily Goal: {user.dailyTarget}</span>
            <span>{Math.round(dailyProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${dailyProgress}%` }}></div>
          </div>
        </div>

        {/* Final Target */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex justify-between text-sm mb-1">
            <span>Lifetime Total: {user.totalCount} / {user.finalTarget}</span>
            <span>{Math.round(totalProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${totalProgress}%` }}></div>
          </div>
        </div>
        
        {/* Settings */}
        <details className="mt-6 bg-white p-4 rounded-lg shadow-sm">
          <summary className="cursor-pointer font-medium text-gray-600">Settings & Targets</summary>
          <form action={handleSettings} className="mt-4 flex flex-col gap-3">
            <label className="text-sm">Daily Target</label>
            <input name="dailyTarget" defaultValue={user.dailyTarget} type="number" className="border p-2 rounded" />
            
            <label className="text-sm">Ultimate Final Target</label>
            <input name="finalTarget" defaultValue={user.finalTarget} type="number" className="border p-2 rounded" />
            
            <button className="bg-gray-800 text-white p-2 rounded mt-2">Save Targets</button>
          </form>
        </details>

      </div>
    </main>
  );
}