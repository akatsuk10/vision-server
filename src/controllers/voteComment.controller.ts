import { Request, Response } from "express";
import { toggleVote, addCommentToProduct } from "../services/product.service";
import redis from "../config/redis";
import { AppError, ErrorCode, logError } from "../utils/error";

export const toggleVoteProduct = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { productId } = req.params;
  
      if (!userId) {
        // Log unauthorized error
        await logError({
          code: ErrorCode.UNAUTHORIZED,
          message: "User not authenticated",
          error: new Error("Unauthorized")
        });
        
        return res.status(401).json({ 
          success: false, 
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "User not authenticated"
          }
        });
      }
  
      // Redis Key for this vote
      const redisKey = `product:${productId}:votes`;
  
      // Check if vote count exists in Redis
      const cachedVotes = await redis.get(redisKey);
      if (cachedVotes) {
        console.log("Cache hit! Returning cached votes");
        return res.json({ success: true, message: "Cached Vote Data", votes: JSON.parse(cachedVotes) });
      }
  
      // Otherwise, toggle vote in DB
      const voteStatus = await toggleVote(userId, productId);
  
      // Clear the cached votes (invalidate cache)
      await redis.del(redisKey);
  
      return res.json({ success: true, message: voteStatus ? "Voted successfully" : "Vote removed" });
    } catch (error: any) {
      // Log the error with user ID if available
      await logError({
        userId: req.user?.id,
        code: error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR,
        message: error.message,
        error: error
      });
      
      // Send error response instead of throwing
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      const errorCode = error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR;
      const errorMessage = error.message || "An unexpected error occurred";
      
      return res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage
        }
      });
    }
  };

  export const commentOnProduct = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { productId } = req.params;
      const { content } = req.body;
  
      if (!userId) {
        // Log unauthorized error
        await logError({
          code: ErrorCode.UNAUTHORIZED,
          message: "User not authenticated",
          error: new Error("Unauthorized")
        });
        
        return res.status(401).json({ 
          success: false, 
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "User not authenticated"
          }
        });
      }
  
      // Add comment in DB
      const comment = await addCommentToProduct(userId, productId, content);
  
      // Redis Key for Comments
      const redisKey = `product:${productId}:comments`;
  
      // Invalidate (delete) cache
      await redis.del(redisKey);
  
      return res.json({ success: true, message: "Comment added successfully", comment });
    } catch (error: any) {
      // Log the error with user ID if available
      await logError({
        userId: req.user?.id,
        code: error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR,
        message: error.message,
        error: error
      });
      
      // Send error response instead of throwing
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      const errorCode = error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR;
      const errorMessage = error.message || "An unexpected error occurred";
      
      return res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage
        }
      });
    }
  };