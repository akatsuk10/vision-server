import { Request, Response } from "express";
import { toggleVote, addCommentToProduct } from "../services/product.service";
import redis from "../config/redis";

export const toggleVoteProduct = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { productId } = req.params;
  
      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }
  
      // Redis Key for this vote
      const redisKey = `product:${productId}:votes`;
  
      // Check if vote count exists in Redis
      const cachedVotes = await redis.get(redisKey);
      if (cachedVotes) {
        console.log("Cache hit! Returning cached votes");
        res.json({ message: "Cached Vote Data", votes: JSON.parse(cachedVotes) });
        return;
      }
  
      // Otherwise, toggle vote in DB
      const voteStatus = await toggleVote(userId, productId);
  
      // Clear the cached votes (invalidate cache)
      await redis.del(redisKey);
  
      res.json({ message: voteStatus ? "Voted successfully" : "Vote removed" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  export const commentOnProduct = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { productId } = req.params;
      const { content } = req.body;
  
      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }
  
      // Add comment in DB
      const comment = await addCommentToProduct(userId, productId, content);
  
      // Redis Key for Comments
      const redisKey = `product:${productId}:comments`;
  
      // Invalidate (delete) cache
      await redis.del(redisKey);
  
      res.json({ message: "Comment added", comment });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };