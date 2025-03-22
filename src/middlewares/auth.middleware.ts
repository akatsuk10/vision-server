import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import redis from "../config/redis"; // Import Redis instance

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// ✅ Extend Express Request type to include user property
declare module "express" {
  interface Request {
    user?: { id: string };
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    // ✅ Check if the token is blacklisted in Redis
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      res.status(401).json({ success: false, message: "Invalid token, access denied." });
      return;
    }

    // ✅ Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    // ✅ Attach user ID to request object
    req.user = { id: decoded.userId };

    next(); // Move to the next middleware or controller
  } catch (error) {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};
