import { Request, Response } from "express";
import { createProduct } from "../services/product.service";
import { AppError, ErrorCode, logError } from "../utils/error";

export const createProductHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, description, image, link } = req.body;

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

    const product = await createProduct(userId, name, description, image, link);
    
    return res.status(201).json({ success: true, message: "Product created", product });
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
  