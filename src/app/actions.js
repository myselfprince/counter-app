'use server'

import connectDB, { User } from '@/lib/db';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// Use the env variable, OR fall back to a default 'secret' for development
const secretKey = process.env.JWT_SECRET || 'default_secret_key_change_me';
const SECRET = new TextEncoder().encode(secretKey);

// --- Helper: Get Current User ID from Cookie ---
async function getUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    // SAFETY CHECK: If userId isn't a string, force logout
    if (typeof payload.userId !== 'string') return null; 
    return payload.userId;
  } catch (e) {
    return null;
  }
}
// --- Helper: Get Today's Date String ---
function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

// 1. REGISTER / LOGIN
export async function authUser(formData) {
  await connectDB();
  const username = formData.get('username');
  const password = formData.get('password');
  const mode = formData.get('mode'); // 'login' or 'register'

  let user = await User.findOne({ username });

  if (mode === 'register') {
    if (user) return { error: 'User already exists' };
    user = await User.create({ username, password });
  } else {
    if (!user || user.password !== password) return { error: 'Invalid credentials' };
  }

  // Create Session Cookie
  const token = await new SignJWT({ userId: user._id.toString() }) 
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET);

  // FIXED: Added 'await' before cookies()
  const cookieStore = await cookies();
  cookieStore.set('token', token, { httpOnly: true, secure: true });
  
  return { success: true };
}

// 2. LOGOUT
export async function logout() {
  // FIXED: Added 'await' before cookies()
  const cookieStore = await cookies();
  cookieStore.delete('token');
}

// 3. GET DATA
export async function getData() {
  await connectDB();
  const userId = await getUserId();
  if (!userId) return null;

  const user = await User.findById(userId);
  
  // Check if we need to reset daily count
  const today = getTodayStr();
  if (user.lastActiveDate !== today) {
    user.dailyCount = 0;
    user.lastActiveDate = today;
    await user.save();
  }
  
  // Return plain JSON
  return JSON.parse(JSON.stringify(user));
}

// 4. INCREMENT COUNTER
export async function incrementCounter() {
  await connectDB();
  const userId = await getUserId();
  if (!userId) return;

  const user = await User.findById(userId);
  const today = getTodayStr();

  // Reset daily if new day
  if (user.lastActiveDate !== today) {
    user.dailyCount = 0;
    user.lastActiveDate = today;
  }

  user.dailyCount += 1;
  user.totalCount += 1;
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