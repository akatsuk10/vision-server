import prisma from "../config/db";
import redis from "../config/redis";

// Fetch all products (No Redis caching needed here)
export const getAllProducts = async () => {
  return await prisma.product.findMany({
    include: { user: true, votes: true, comments: true },
  });
};

//Create Product
export const createProduct = async (userId: string, name: string, description: string, image:string, link:string) => {
  // Check if user exists
  const userExists = await prisma.user.findUnique({ where: { id: userId } });
  if (!userExists) {
    throw new Error("User not found");
  }

  // Create the product
  const product = await prisma.product.create({
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
};

// Toggle vote (Redis cache is invalidated)
export const toggleVote = async (userId: string, productId: string) => {
  const existingVote = await prisma.vote.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  if (existingVote) {
    await prisma.vote.delete({ where: { id: existingVote.id } });
    // Invalidate cache
    await redis.del(`product:${productId}:votes`);
    return false;
  } else {
    await prisma.vote.create({ data: { userId, productId } });
    // Invalidate cache
    await redis.del(`product:${productId}:votes`);
    return true;
  }
};

// Add comment (Redis cache is invalidated)
export const addCommentToProduct = async (userId: string, productId: string, content: string) => {
  const comment = await prisma.comment.create({ data: { userId, productId, content } });

  // Invalidate comments cache
  await redis.del(`product:${productId}:comments`);
  return comment;
};

// ✅ New Function: Get Votes (Use Redis for caching)
export const getVotesForProduct = async (productId: string) => {
  const redisKey = `product:${productId}:votes`;

  // Check Redis cache
  const cachedVotes = await redis.get(redisKey);
  if (cachedVotes) {
    return JSON.parse(cachedVotes);
  }

  // Fetch from DB
  const votes = await prisma.vote.count({ where: { productId } });

  // Cache votes in Redis for 10 minutes
  await redis.set(redisKey, JSON.stringify(votes), "EX", 600);

  return votes;
};

// ✅ New Function: Get Comments (Use Redis for caching)
export const getCommentsForProduct = async (productId: string) => {
  const redisKey = `product:${productId}:comments`;

  // Check Redis cache
  const cachedComments = await redis.get(redisKey);
  if (cachedComments) {
    return JSON.parse(cachedComments);
  }

  // Fetch from DB
  const comments = await prisma.comment.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
  });

  // Cache comments in Redis for 10 minutes
  await redis.set(redisKey, JSON.stringify(comments), "EX", 600);
  return comments;
};
