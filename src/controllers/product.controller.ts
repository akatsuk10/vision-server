import { Request, Response } from "express";
import { createProduct, getProductById, deleteProduct } from "../services/product.service";
import { AppError, ErrorCode, logError } from "../utils/error";

// Helper function to safely serialize objects with BigInt values
const safeJsonStringify = (data: any): any => {
  return JSON.parse(JSON.stringify(data, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  ));
};

// Export all handlers at the bottom of the file
export const createProductHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    // Destructure the request body
    const { 
      product: productData,
      onChain: onChainData,
      pdas: pdasData
    } = req.body;
    
    // Extract product fields with defaults
    const {
      name = '',
      description = '',
      tokenSymbol = '',
      initialDepositLamports = 0,
      ipoSlots = 0,
      initialTokenSupply = '0',
      launchDate = '',
      imageHash = '',
      image = undefined,
      website = undefined,
      status = 'draft',
      tags = [],
      featured = false,
      twitter = undefined,
      demoVideo = undefined,
      bannerImage = undefined,
      logo = undefined,
      galleryImages = [],
      downloadLinks = [],
      pricingTag = undefined,
      promo = undefined,
      firstComment = undefined,
      interactiveDemo = undefined,
      topics = [],
      makers = [],
      scheduleDate = undefined
    } = productData || {};
    
    // Extract on-chain data with defaults
    const {
      mint: mintData,
      tokenPool: tokenPoolData,
      slot = '0',
      blockTime = '0'
    } = onChainData || {};
    
    // Extract PDAs with defaults
    const {
      product: productPDA = '',
      treasury: treasuryPDA = '',
      poolAuthority: poolAuthorityPDA = '',
      tokenPool: tokenPoolPDA = ''
    } = pdasData || {};
    
    // Handle mint and tokenPool which can be objects or strings
    const mint = typeof mintData === 'object' ? mintData?.address : mintData;
    const tokenPool = typeof tokenPoolData === 'object' ? tokenPoolData?.address : tokenPoolData;

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

    // Validate required fields
    const requiredFields = [
      { field: 'name', value: name, message: 'Product name is required' },
      { field: 'description', value: description, message: 'Product description is required' },
      { field: 'tokenSymbol', value: tokenSymbol, message: 'Token symbol is required' },
      { field: 'initialDepositLamports', value: initialDepositLamports, message: 'Initial deposit amount is required' },
      { field: 'initialTokenSupply', value: initialTokenSupply, message: 'Initial token supply is required' },
      { field: 'ipoSlots', value: ipoSlots, message: 'Number of IPO slots is required' },
      { field: 'imageHash', value: imageHash, message: 'Image hash is required' }
    ];

    const missingField = requiredFields.find(field => !field.value && field.value !== 0);
    if (missingField) {
      await logError({
        code: ErrorCode.BAD_REQUEST,
        message: missingField.message,
        error: new Error(`Missing required field: ${missingField.field}`)
      });
      return res.status(400).json({ 
        success: false, 
        error: missingField.message 
      });
    }

    // Log the incoming request for debugging
    console.log('Incoming product data:', JSON.stringify({
      name,
      description,
      launchDate,
      tokenSymbol,
      initialDepositLamports,
      initialTokenSupply,
      ipoSlots,
      imageHash
    }, null, 2));

    // Parse launch date
    let parsedLaunchDate: Date = new Date(); // Default to current date
    if (launchDate) {
      parsedLaunchDate = new Date(launchDate);
      if (isNaN(parsedLaunchDate.getTime())) {
        await logError({
          code: ErrorCode.BAD_REQUEST,
          message: "Invalid launch date format",
          error: new Error("Invalid Date")
        });
        return res.status(400).json({ 
          success: false, 
          error: "Invalid launch date format. Please use ISO 8601 format (e.g., '2023-01-01T00:00:00.000Z')" 
        });
      }
    }

    // Create product data object with proper types and validation
    const productInput = {
      userId,
      name,
      description,
      tokenSymbol,
      initialDepositLamports: BigInt(initialDepositLamports),
      ipoSlots: Number(ipoSlots),
      initialTokenSupply: String(initialTokenSupply),
      launchDate: parsedLaunchDate,
      imageHash,
      
      // On-chain fields
      mint,
      tokenPool,
      slot: slot ? BigInt(slot) : BigInt(0),
      blockTime: blockTime ? BigInt(blockTime) : BigInt(0),
      
      // PDA addresses
      productPDA,
      treasuryPDA,
      poolAuthorityPDA,
      tokenPoolPDA,
      
      // Additional metadata
      image,
      website,
      status: status || 'draft',
      tags: tags || [],
      featured: Boolean(featured),
      twitter,
      demoVideo,
      bannerImage,
      logo,
      galleryImages: galleryImages || [],
      downloadLinks: downloadLinks || [],
      pricingTag,
      promo,
      firstComment,
      interactiveDemo,
      topics: topics || [],
      makers: makers || [],
      scheduleDate: scheduleDate ? new Date(scheduleDate) : undefined
    };

    try {
      console.log('Creating product with data:', JSON.stringify({
        ...productInput,
        // Don't log the entire object to avoid sensitive data in logs
        userId: productInput.userId ? '[REDACTED]' : undefined
      }, null, 2));

      const product = await createProduct({
        ...productInput,
        // Ensure all required fields are present
        status: productInput.status || 'draft',
        tags: productInput.tags || [],
        galleryImages: productInput.galleryImages || [],
        downloadLinks: productInput.downloadLinks || [],
        topics: productInput.topics || [],
        makers: productInput.makers || []
      });

      // Serialize the product with BigInt support
      return res.status(201).json({
        success: true,
        data: safeJsonStringify(product)
      });
    } catch (error: any) {
      console.error('Error creating product:', error);
      
      // Log detailed error information
      const errorMessage = error.message || "Failed to create product";
      const errorCode = error.code || ErrorCode.INTERNAL_SERVER_ERROR;
      const statusCode = error.statusCode || 500;

      await logError({
        userId: req.user?.id,
        code: errorCode,
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });

      // Create a safe error response
      const errorResponse = {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage
        }
      };

      // Ensure proper serialization of BigInt values
      const safeResponse = JSON.parse(JSON.stringify(errorResponse, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value
      ));

      return res.status(statusCode).json(safeResponse);
    }
  } catch (error: any) {
    console.error('Unexpected error in createProductHandler:', error);
    const errorMessage = 'An unexpected error occurred while processing your request';
    
    await logError({
      userId: req.user?.id,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });

    return res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: errorMessage
      }
    });
  }
};

export const getProductByIdHandler = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const product = await getProductById(productId);
    return res.status(200).json({ 
      success: true, 
      product: safeJsonStringify(product) 
    });
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
    return res.status(200).json({ 
      success: true, 
      data: safeJsonStringify(result) 
    });
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
  