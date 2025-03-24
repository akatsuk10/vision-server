import prisma from "../config/db";

export const getAllProducts = async () => {
  return await prisma.product.findMany({
    include: { user: true, votes: true, comments: true },
  });
};


export const toggleVote = async (userId: string, productId: string) => {
  const existingVote = await prisma.vote.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  if (existingVote) {
    // User already voted -> Remove the vote (unvote)
    await prisma.vote.delete({ where: { id: existingVote.id } });
    return false; // Returning false means vote was removed
  } else {
    // User hasn't voted -> Add the vote
    await prisma.vote.create({ data: { userId, productId } });
    return true; // Returning true means vote was added
  }
};

export const addCommentToProduct = async (userId: string, productId: string, content: string) => {
  return await prisma.comment.create({ data: { userId, productId, content } });
};
