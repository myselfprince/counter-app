'use client'

import { useState, useEffect, useCallback } from 'react';
import { authUser, logout, getData, syncOfflineClicks, updateTargets } from './actions';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); 
  const [error, setError] = useState('');
  
  // NEW: Track clicks that haven't reached the server yet
  const [pendingClicks, setPendingClicks] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // --- INITIAL LOAD & SYNC LOGIC ---
  
  const loadAndSync = useCallback(async () => {
    try {
      // 1. Load pending clicks from LocalStorage immediately
      const localPending = parseInt(localStorage.getItem('pendingClicks') || '0');
      setPendingClicks(localPending);

      // 2. Fetch latest Server Data
      const serverData = await getData();
      
      if (serverData) {
        // 3. If we have pending clicks and internet, try to sync immediately
        if (localPending > 0 && navigator.onLine) {
           await runSync(localPending, serverData);
        } else {
           // Just show data
           setUser(serverData);
        }
      } else {
        setUser(null); // Not logged in
      }
    } catch (err) {
      console.error("Load failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run on mount
  useEffect(() => {
    loadAndSync();

    // Add Event Listener for when Internet comes back
    const handleOnline = () => loadAndSync();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [loadAndSync]);


  // --- SYNC HELPER ---
  async function runSync(amountToSync, currentServerData) {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      // Call the new Bulk Action
      const updatedUser = await syncOfflineClicks(amountToSync);
      if (updatedUser) {
        // Success: Update state, Clear LocalStorage
        setUser(updatedUser);
        setPendingClicks(0);
        localStorage.setItem('pendingClicks', '0');
      }
    } catch (e) {
      console.error("Sync failed, keeping data in localStorage");
    } finally {
      setIsSyncing(false);
    }
  }


  // --- HANDLERS ---
  
  async function handleAuth(formData) {
    formData.append('mode', authMode);
    const res = await authUser(formData);
    if (res?.error) {
      setError(res.error);
    } else {
      loadAndSync(); 
      setError('');
    }
  }

  async function handleTap() {
    // 1. Update UI Immediately (Optimistic)
    setPendingClicks(prev => {
      const newVal = prev + 1;
      localStorage.setItem('pendingClicks', newVal.toString());
      return newVal;
    });

    // 2. Debounce/Check Internet to Sync
    // We wait 500ms to see if user taps again, or sync immediately if online
    if (navigator.onLine) {
      // We pass 1 because we just added 1. 
      // Note: A robust system usually uses a queue, but for this simpler app:
      // We will trigger a sync of ALL pending clicks in local storage.
      
      // Small timeout to allow rapid tapping without spamming the server
      setTimeout(() => {
        const currentPending = parseInt(localStorage.getItem('pendingClicks') || '0');
        if (currentPending > 0) {
           // We pass null for user data so it fetches fresh
           runSync(currentPending, null);
        }
      }, 2000); // Sync every 2 seconds if tapping continuously
    }
  }

  async function handleSettings(formData) {
    await updateTargets(formData);
    loadAndSync();
    alert('Targets updated!');
  }

  if (loading) return <div className="p-10 flex justify-center text-white">Loading...</div>;

  // --- LOGIN SCREEN ---
  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-black">
        <div className="bg-black p-8 rounded-xl shadow-lg w-full max-w-sm border">
          <h1 className="text-2xl font-bold mb-6 text-center text-white">
            {authMode === 'login' ? 'Login' : 'Create Account'}
          </h1>
          <form action={handleAuth} className="flex flex-col gap-4">
            <input name="username" placeholder="Username" required className="p-3 border rounded text-white bg-gray-700" />
            <input name="password" type="password" placeholder="Password" required className="p-3 border rounded text-white bg-gray-700" />
            <button className="bg-blue-600 text-white p-3 rounded hover:bg-blue-700 font-bold">
              {authMode === 'login' ? 'Enter' : 'Sign Up'}
            </button>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          </form>
          <p className="mt-4 text-center text-sm text-white cursor-pointer" 
             onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
            {authMode === 'login' ? "New? Click to Register" : "Have an account? Login"}
          </p>
        </div>
      </main>
    );
  }

  // --- DASHBOARD SCREEN ---
  
  // CALCULATE DISPLAY VALUES
  // Display = Server Value + Local Pending Value
  const displayDaily = (user.dailyCount || 0) + pendingClicks;
  const displayTotal = (user.totalCount || 0) + pendingClicks;

  const dailyProgress = Math.min((displayDaily / user.dailyTarget) * 100, 100);
  const totalProgress = Math.min((displayTotal / user.finalTarget) * 100, 100);

  return (
    <main className="flex min-h-screen flex-col items-center p-4 bg-black text-black">
      {/* Header */}
      <div className="w-full max-w-md flex justify-between items-center mb-8">
        <div className='flex flex-col'>
             <h2 className="font-bold text-white">Hi, {user.username}</h2>
             {pendingClicks > 0 && (
               <span className="text-xs text-yellow-500">
                 {isSyncing ? 'Syncing...' : 'Not Synced'} (+{pendingClicks})
               </span>
             )}
        </div>
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
        <span className="text-8xl font-bold">{displayDaily}</span>
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
            <span>Lifetime Total: {displayTotal} / {user.finalTarget}</span>
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