'use server'

import connectDB, { User } from '@/lib/db';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.JWT_SECRET || 'default_secret_key_change_me';
const SECRET = new TextEncoder().encode(secretKey);

async function getUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload.userId;
  } catch (e) {
    return null;
  }
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

// 1. REGISTER / LOGIN
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

  const token = await new SignJWT({ userId: user._id.toString() }) 
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d') 
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set('token', token, { 
    httpOnly: true, 
    secure: true,
    maxAge: 60 * 60 * 24 * 30 
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
  if (!user) return null;
  
  const today = getTodayStr();
  if (user.lastActiveDate !== today) {
    user.dailyCount = 0;
    user.lastActiveDate = today;
    await user.save();
  }
  
  return JSON.parse(JSON.stringify(user));
}

// 4. SYNC OFFLINE CLICKS (Bulk Update)
export async function syncOfflineClicks(amount) {
  if (!amount || amount <= 0) return null;

  await connectDB();
  const userId = await getUserId();
  if (!userId) return null;

  const user = await User.findById(userId);
  if (!user) return null;

  const today = getTodayStr();

  // Reset daily count if it's a new day
  if (user.lastActiveDate !== today) {
    user.dailyCount = 0;
    user.lastActiveDate = today;
  }

  // Atomic Increment is preferred in MongoDB usually, but this works for simple apps
  user.dailyCount += amount;
  user.totalCount += amount;
  
  await user.save();
  return JSON.parse(JSON.stringify(user));
}

// 5. UPDATE TARGETS
export async function updateTargets(formData) {
  await connectDB();
  const userId = await getUserId();
  if (!userId) return;

  await User.findByIdAndUpdate(userId, {
    dailyTarget: Number(formData.get('dailyTarget')),
    finalTarget: Number(formData.get('finalTarget'))
  });
}