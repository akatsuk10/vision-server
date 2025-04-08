import { Router, Request, Response, RequestHandler } from "express";
import { getAllProducts} from "../services/product.service";
import { authMiddleware } from "../middlewares/auth.middleware";
import {commentOnProduct, toggleVoteProduct} from "../controllers/voteComment.controller"
import { createProductHandler } from "../controllers/product.controller";
import { AppError, ErrorCode, logError } from "../utils/error";

const router = Router();

const getAllProductsHandler: RequestHandler = async (req, res) => {
  try {
    const products = await getAllProducts();
    res.json({ success: true, products });
  } catch (error: any) {
    // Log the error
    await logError({
      code: error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR,
      message: error.message,
      error: error
    });
    
    // Send error response
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const errorCode = error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR;
    const errorMessage = error.message || "An unexpected error occurred";
    
    res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage
      }
    });
  }
};

router.get("/", getAllProductsHandler);

// Vote on a product
router.post("/:productId/vote", authMiddleware, toggleVoteProduct as unknown as RequestHandler);

// Comment on a product
router.post("/:productId/comment", authMiddleware, commentOnProduct as unknown as RequestHandler);

router.post("/", authMiddleware, createProductHandler as unknown as RequestHandler);

export default router;
