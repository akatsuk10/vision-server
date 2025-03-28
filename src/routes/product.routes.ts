import { Router } from "express";
import { getAllProducts} from "../services/product.service";
import { authMiddleware } from "../middlewares/auth.middleware";
import {commentOnProduct, toggleVoteProduct} from "../controllers/voteComment.controller"




const router = Router();

router.get("/", async (req, res) => {
  const products = await getAllProducts();
  res.json({ success: true, products });
});

// Vote on a product
router.post("/:productId/vote", authMiddleware, toggleVoteProduct);

// Comment on a product
router.post("/:productId/comment", authMiddleware, commentOnProduct);




export default router;
