import prisma from "../config/db";

export const getAllProducts = async () => {
  return await prisma.product.findMany({
    include: { user: true, votes: true, comments: true },
  });
};
