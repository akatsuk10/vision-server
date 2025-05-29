import { Request, Response } from "express";
import { createProduct, getProductById, deleteProduct } from "../services/product.service";
import { AppError, ErrorCode, logError } from "../utils/error";

export const createProductHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const {
      name,
      tagline,
      description,
      type,
      image,
      tokenSymbol,
      tokenImage,
      link,
      website,
      status,
      tags,
      featured,
      launchDate,
      hasPreInvestor,
      preValuationPrice,
      initialDeposit,
      sharesVC,
      ipoSlots,
      makerNote,
      demoVideo,
      bannerImage,
      logo,
      galleryImages,
      downloadLinks,
      pricingTag,
      promo,
      twitter,
      firstComment,
      interactiveDemo,
      topics,
      makers,
      scheduleDate
    } = req.body;

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

    const product = await createProduct({
      userId,
      name,
      tagline,
      description,
      type,
      image,
      tokenSymbol,
      tokenImage,
      link,
      website,
      status,
      tags,
      featured,
      launchDate,
      hasPreInvestor,
      preValuationPrice,
      initialDeposit,
      sharesVC,
      ipoSlots,
      makerNote,
      demoVideo,
      bannerImage,
      logo,
      galleryImages,
      downloadLinks,
      pricingTag,
      promo,
      twitter,
      firstComment,
      interactiveDemo,
      topics,
      makers,
      scheduleDate
    });
    
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

export const getProductByIdHandler = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const product = await getProductById(productId);
    return res.status(200).json({ success: true, product });
  } catch (error: any) {
    await logError({
      code: error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR,
      message: error.message,
      error: error
    });
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

export const deleteProductHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { productId } = req.params;
    if (!userId) {
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
    const result = await deleteProduct(productId, userId);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    await logError({
      code: error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR,
      message: error.message,
      error: error
    });
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
  