import { Router } from "express";
import { getAllProducts } from "../services/product.service";

const router = Router();

router.get("/", async (req, res) => {
  const products = await getAllProducts();
  res.json({ success: true, products });
});

export default router;
