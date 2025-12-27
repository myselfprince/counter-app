// lib/db.js
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGO_URI environment variable');
}

// Cached connection for Next.js hot reloading
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((mongoose) => mongoose);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// --- Define the Schema ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // In production, hash this!
  totalCount: { type: Number, default: 0 },
  dailyCount: { type: Number, default: 0 },
  lastActiveDate: { type: String, default: '' }, // To track when to reset daily count
  dailyTarget: { type: Number, default: 100 },
  finalTarget: { type: Number, default: 10000 },
});

// Prevent model overwrite error in dev mode
export const User = mongoose.models.User || mongoose.model('User', userSchema);

export default connectDB;