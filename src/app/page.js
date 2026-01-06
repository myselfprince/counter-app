'use client'

import { useState, useEffect, useRef } from 'react';
import { authUser, logout, getData, syncOfflineClicks, updateTargets } from './actions';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); 
  const [error, setError] = useState('');
  
  // LOCAL STATE
  const [pendingClicks, setPendingClicks] = useState(0);
  
  // REFS (Used for logic that doesn't need to trigger re-renders)
  const isSyncingRef = useRef(false);

  // --- 1. INITIAL LOADING (Run once on mount) ---
  useEffect(() => {
    async function init() {
      try {
        // A. Load Local Pending Clicks immediately
        const local = parseInt(localStorage.getItem('pendingClicks') || '0');
        setPendingClicks(local);

        // B. Fetch Server Data
        const serverData = await getData();
        if (serverData) {
          setUser(serverData);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Init failed", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);


  // --- 2. PERIODIC SYNC & ONLINE LISTENER ---
  useEffect(() => {
    // FUNCTION: The Sync Logic
    const runSync = async () => {
      // Guard clauses: Don't sync if already syncing, no internet, or no user
      if (isSyncingRef.current || !navigator.onLine || !user) return;
      
      // Read directly from localStorage to get the absolute latest value
      const currentPending = parseInt(localStorage.getItem('pendingClicks') || '0');
      
      if (currentPending <= 0) return; // Nothing to sync

      try {
        isSyncingRef.current = true;
        
        // Send data to server
        const updatedUser = await syncOfflineClicks(currentPending);
        
        if (updatedUser) {
          // SUCCESS: 
          // 1. Update Server Data in State
          setUser(updatedUser);

          // 2. Safely subtract the amount we just sent from Pending Clicks
          setPendingClicks(prev => {
            const newVal = Math.max(0, prev - currentPending);
            localStorage.setItem('pendingClicks', newVal.toString());
            return newVal;
          });
        }
      } catch (err) {
        console.error("Sync failed, retrying later.");
      } finally {
        isSyncingRef.current = false;
      }
    };

    // TRIGGER 1: Run every 5 seconds
    const intervalId = setInterval(runSync, 5000);

    // TRIGGER 2: Run immediately when Internet comes back
    const handleOnline = () => runSync();
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
    };
  }, [user]); // Re-create listeners if user logs in/out


  // --- HANDLERS ---

  async function handleAuth(formData) {
    formData.append('mode', authMode);
    const res = await authUser(formData);
    if (res?.error) {
      setError(res.error);
    } else {
      // On successful login, fetch fresh data
      const data = await getData();
      setUser(data);
      setError('');
    }
  }

  function handleTap() {
    // Optimistic Update: Update State & LocalStorage immediately
    setPendingClicks(prev => {
      const newVal = prev + 1;
      localStorage.setItem('pendingClicks', newVal.toString());
      return newVal;
    });
    // We do NOT trigger sync here. The periodic timer handles it.
    // This makes the UI extremely fast.
  }

  async function handleSettings(formData) {
    await updateTargets(formData);
    // Refresh data after update
    const data = await getData();
    setUser(data);
    alert('Targets updated!');
  }


  // --- RENDER ---

  if (loading) return <div className="p-10 flex justify-center text-white">Loading...</div>;

  // LOGIN SCREEN
  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-black">
        <div className="bg-black p-8 rounded-xl shadow-lg w-full max-w-sm border border-gray-800">
          <h1 className="text-2xl font-bold mb-6 text-center text-white">
            {authMode === 'login' ? 'Login' : 'Create Account'}
          </h1>
          <form action={handleAuth} className="flex flex-col gap-4">
            <input name="username" placeholder="Username" required className="p-3 border rounded text-white bg-gray-900 border-gray-700" />
            <input name="password" type="password" placeholder="Password" required className="p-3 border rounded text-white bg-gray-900 border-gray-700" />
            <button className="bg-blue-600 text-white p-3 rounded hover:bg-blue-700 font-bold">
              {authMode === 'login' ? 'Enter' : 'Sign Up'}
            </button>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          </form>
          <p className="mt-4 text-center text-sm text-gray-400 cursor-pointer hover:text-white" 
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
            {authMode === 'login' ? "New? Click to Register" : "Have an account? Login"}
          </p>
        </div>
      </main>
    );
  }

  // DASHBOARD SCREEN

  // Logic: Total Display = What Server has + What we haven't sent yet
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
             
        </div>
        <form action={async () => { await logout(); setUser(null); }}>
          <button className="text-sm text-red-500 hover:underline">Logout</button>
        </form>
      </div>

      {/* Main Counter Button */}
      <button 
        onClick={handleTap}
        className="w-64 h-64 rounded-full bg-black border border-gray-800 text-white flex flex-col items-center justify-center shadow-2xl active:scale-95 transition-transform select-none touch-manipulation"
      >
        <span className="text-3xl opacity-80">राधे राधे</span>
        {/* <span className="text-8xl font-bold">{displayDaily}</span> */}
        <span className="text-5xl font-bold">राधा कृष्ण</span>
        <span className="text-sm mt-2 opacity-80">{displayDaily}</span>
      </button>

      {/* Stats Cards */}
      <div className="w-full max-w-md mt-10 grid gap-4">
        
        {/* Daily Target */}
        <div className="bg-black border border-gray-700 p-4 rounded-lg shadow-sm text-gray-700">
          <div className="flex justify-between text-sm mb-1">
            <span>Daily Goal: {user.dailyTarget}</span>
            <span>{Math.round(dailyProgress)}%</span>
          </div>
          <div className=" w-full bg-gray-800 rounded-full h-2.5 bg-gray-600">
            <div className="bg-green-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${dailyProgress}%` }}></div>
          </div>
        </div>

        {/* Final Target */}
        <div className="p-4 rounded-lg shadow-sm bg-black border text-gray-700 border-gray-700">
          <div className="flex justify-between text-sm mb-1">
            <span>Lifetime Total: {displayTotal} / {user.finalTarget}</span>
            <span>{Math.round(totalProgress)}%</span>
          </div>
          <div className="w-full bg-gray-800  rounded-full h-2.5">
            <div className="bg-indigo-500  h-2.5 rounded-full transition-all duration-300" style={{ width: `${totalProgress}%` }}></div>
          </div>
        </div>
        
        {/* Settings */}
        <details className="mt-6 bg-black border text-white p-4 rounded-lg shadow-sm border-gray-700">
          <summary className="cursor-pointer font-medium text-gray-600">Settings & Targets</summary>
          <form action={handleSettings} className="mt-4 flex flex-col gap-3">
            <label className="text-sm">Daily Target</label>
            <input name="dailyTarget" defaultValue={user.dailyTarget} type="number" className="border p-2 rounded" />
            
            <label className="text-sm">Ultimate Final Target</label>
            <input name="finalTarget" defaultValue={user.finalTarget} type="number" className="border p-2 rounded" />
            
            <button className="bg-gray-800 text-white p-2 rounded mt-2">Save Targets</button>
          </form>
        </details>
        {pendingClicks > 0 && (
                <span className="text-xs text-yellow-500 animate-pulse">
                  Syncing {pendingClicks} clicks...
                </span>
             )}
      </div>
    </main>
  );
}