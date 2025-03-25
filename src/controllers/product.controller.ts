import { Request, Response } from "express";
import { createProduct } from "../services/product.service";

export const createProductHandler = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { name, description, image,link } = req.body;
  
      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return; // ✅ Ensure function ends here
      }
  
      const product = await createProduct(userId, name, description,image,link);
      
      res.status(201).json({ message: "Product created", product }); // ✅ Do not return res.json
    } catch (error: any) {
      res.status(400).json({ error: error.message }); // ✅ Do not return res.json
    }
  };
  