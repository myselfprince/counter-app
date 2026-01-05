'use server'

import connectDB, { User } from '@/lib/db';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.JWT_SECRET || 'default_secret_key_change_me';
const SECRET = new TextEncoder().encode(secretKey);

// ... (Keep getUserId and getTodayStr helper functions exactly as they are) ...
async function getUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (typeof payload.userId !== 'string') return null; 
    return payload.userId;
  } catch (e) {
    return null;
  }
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

// 1. REGISTER / LOGIN (UPDATED: 30 Days Session)
export async function authUser(formData) {
  await connectDB();
  const username = formData.get('username');
  const password = formData.get('password');
  const mode = formData.get('mode');

  let user = await User.findOne({ username });

  if (mode === 'register') {
    if (user) return { error: 'User already exists' };
    user = await User.create({ username, password });
  } else {
    if (!user || user.password !== password) return { error: 'Invalid credentials' };
  }

  // UPDATED: Increased to 30 days
  const token = await new SignJWT({ userId: user._id.toString() }) 
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d') 
    .sign(SECRET);

  const cookieStore = await cookies();
  // UPDATED: Added maxAge to ensure browser keeps it
  cookieStore.set('token', token, { 
    httpOnly: true, 
    secure: true,
    maxAge: 60 * 60 * 24 * 30 // 30 Days in seconds
  });
  
  return { success: true };
}

// 2. LOGOUT
export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('token');
}

// 3. GET DATA
export async function getData() {
  await connectDB();
  const userId = await getUserId();
  if (!userId) return null;

  const user = await User.findById(userId);
  
  const today = getTodayStr();
  if (user.lastActiveDate !== today) {
    user.dailyCount = 0;
    user.lastActiveDate = today;
    await user.save();
  }
  
  return JSON.parse(JSON.stringify(user));
}

// 4. NEW: SYNC OFFLINE CLICKS (Bulk Update)
// This replaces the simple incrementCounter for offline usage
export async function syncOfflineClicks(amount) {
  if (!amount || amount <= 0) return null;

  await connectDB();
  const userId = await getUserId();
  if (!userId) return;

  const user = await User.findById(userId);
  const today = getTodayStr();

  if (user.lastActiveDate !== today) {
    user.dailyCount = 0;
    user.lastActiveDate = today;
  }

  user.dailyCount += amount;
  user.totalCount += amount;
  await user.save();
  return JSON.parse(JSON.stringify(user));
}

// 5. UPDATE TARGETS (Keep as is)
export async function updateTargets(formData) {
  await connectDB();
  const userId = await getUserId();
  if (!userId) return;

  await User.findByIdAndUpdate(userId, {
    dailyTarget: Number(formData.get('dailyTarget')),
    finalTarget: Number(formData.get('finalTarget'))
  });
}