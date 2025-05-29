import { postgresPrisma } from "../config/db";
import redis from "../config/redis";
import { AppError, ErrorCode, logError } from "../utils/error";

// Fetch all products (No Redis caching needed here)
export const getAllProducts = async () => {
  try {
    return await postgresPrisma.product.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        votes: true,
        comments: true,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, error instanceof Error ? error.message : "Failed to fetch products", 500);
  }
};

//Create Product
export const createProduct = async (productData: {
  userId: string;
  name: string;
  tagline?: string;
  description: string;
  type?: string;
  image: string;
  tokenSymbol?: string;
  tokenImage?: string;
  link: string;
  website?: string;
  status?: string;
  tags?: string[];
  featured?: boolean;
  launchDate?: Date;
  hasPreInvestor?: boolean;
  preValuationPrice?: number;
  initialDeposit?: number;
  sharesVC?: number;
  ipoSlots?: number;
  makerNote?: string;
  demoVideo?: string;
  bannerImage?: string;
  logo?: string;
  galleryImages?: string[];
  downloadLinks?: string[];
  pricingTag?: string;
  promo?: string;
  twitter?: string;
  firstComment?: string;
  interactiveDemo?: string;
  topics?: string[];
  makers?: string[];
  scheduleDate?: Date;
}) => {
  try {
    // Check if user exists
    const userExists = await postgresPrisma.user.findUnique({ where: { id: productData.userId } });
    if (!userExists) {
      await logError({
        code: ErrorCode.RECORD_NOT_FOUND,
        message: "User not found",
        error: new Error("User not found")
      });
      throw new AppError(ErrorCode.RECORD_NOT_FOUND, "User not found", 404);
    }

    // Create the product
    const product = await postgresPrisma.product.create({
      data: {
        ...productData,
        views: 0,
        upvotes: 0
      },
    });

    // Invalidate cached product list
    await redis.del("products:all");

    return product;
  } catch (error) {
    await logError({
      code: error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR,
      message: error instanceof Error ? error.message : "Failed to create product",
      error: error
    });
    throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, error instanceof Error ? error.message : "Failed to create product", 500);
  }
};

// Toggle vote (Redis cache is invalidated)
export const toggleVote = async (userId: string, productId: string) => {
  try {
    const existingVote = await postgresPrisma.vote.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existingVote) {
      // Remove vote
      await postgresPrisma.vote.delete({
        where: { userId_productId: { userId, productId } },
      });
      return false; // Vote removed
    } else {
      // Add vote
      await postgresPrisma.vote.create({
        data: { userId, productId },
      });
      return true; // Vote added
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, error instanceof Error ? error.message : "Failed to toggle vote", 500);
  }
};

// Add comment to product
export const addCommentToProduct = async (userId: string, productId: string, content: string) => {
  try {
    const comment = await postgresPrisma.comment.create({
      data: { userId, productId, content },
    });
    return comment;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, error instanceof Error ? error.message : "Failed to add comment", 500);
  }
};

// Get votes for a product
export const getVotesForProduct = async (productId: string) => {
  try {
    const votes = await postgresPrisma.vote.findMany({
      where: { productId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
    return votes;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, error instanceof Error ? error.message : "Failed to get votes", 500);
  }
};

// Get comments for a product
export const getCommentsForProduct = async (productId: string) => {
  try {
    const comments = await postgresPrisma.comment.findMany({
      where: { productId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
    return comments;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, error instanceof Error ? error.message : "Failed to get comments", 500);
  }
};

export const getProductById = async (productId: string) => {
  try {
    // First, find the product
    const product = await postgresPrisma.product.findUnique({
      where: { id: productId },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        votes: true,
        comments: {
          include: {
            user: { select: { id: true, name: true, avatar: true } }
          }
        }
      }
    });

    if (!product) {
      await logError({
        code: ErrorCode.RECORD_NOT_FOUND,
        message: "Product not found",
        error: new Error("Product not found")
      });
      throw new AppError(ErrorCode.RECORD_NOT_FOUND, "Product not found", 404);
    }

    // Increment views (non-blocking, don't await)
    postgresPrisma.product.update({
      where: { id: productId },
      data: { views: { increment: 1 } }
    }).catch(() => {});

    return product;
  } catch (error) {
    await logError({
      code: error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR,
      message: error instanceof Error ? error.message : "Failed to fetch product",
      error: error
    });
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, error instanceof Error ? error.message : "Failed to fetch product", 500);
  }
};

export const deleteProduct = async (productId: string, userId: string) => {
  try {
    // Find the product first
    const product = await postgresPrisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      await logError({
        code: ErrorCode.RECORD_NOT_FOUND,
        message: "Product not found",
        error: new Error("Product not found")
      });
      throw new AppError(ErrorCode.RECORD_NOT_FOUND, "Product not found", 404);
    }
    if (product.userId !== userId) {
      await logError({
        code: ErrorCode.UNAUTHORIZED,
        message: "User not authorized to delete this product",
        error: new Error("Unauthorized delete attempt")
      });
      throw new AppError(ErrorCode.UNAUTHORIZED, "You are not authorized to delete this product", 403);
    }
    // Manually delete related votes and comments
    await postgresPrisma.vote.deleteMany({ where: { productId } });
    await postgresPrisma.comment.deleteMany({ where: { productId } });
    await postgresPrisma.product.delete({ where: { id: productId } });
    await redis.del("products:all");
    return { message: "Product deleted successfully" };
  } catch (error) {
    await logError({
      code: error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR,
      message: error instanceof Error ? error.message : "Failed to delete product",
      error: error
    });
    throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, error instanceof Error ? error.message : "Failed to delete product", 500);
  }
};
