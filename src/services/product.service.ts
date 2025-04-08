import { postgresPrisma } from "../config/db";
import redis from "../config/redis";
import { AppError, ErrorCode } from "../utils/error";

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
export const createProduct = async (userId: string, name: string, description: string, image:string, link:string) => {
  try {
    // Check if user exists
    const userExists = await postgresPrisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      throw new AppError(ErrorCode.RECORD_NOT_FOUND, "User not found", 404);
    }

    // Create the product
    const product = await postgresPrisma.product.create({
      data: {
        userId,
        name,         // ✅ Use 'name' instead of 'title'
        description,
        image,
        link,
      },
    });

    // Invalidate cached product list
    await redis.del("products:all");

    return product;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
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
