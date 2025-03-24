import { Request, Response } from "express";
import { toggleVote, addCommentToProduct } from "../services/product.service";

export const toggleVoteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id; // Extracted from token in middleware
    const { productId } = req.params;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const voteStatus = await toggleVote(userId, productId);
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

    const comment = await addCommentToProduct(userId, productId, content);
    res.json({ message: "Comment added", comment });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
