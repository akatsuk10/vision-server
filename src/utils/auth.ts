import jwt from 'jsonwebtoken'
import redis from '../config/redis';

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

export const generateToken = async (userId: string) => {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });

  // Store token in Redis to track active sessions
  await redis.set(`token:${userId}`, token, "EX", 7 * 24 * 60 * 60);

  return token;
};

export function generateNonce(length = 24) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < length; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}