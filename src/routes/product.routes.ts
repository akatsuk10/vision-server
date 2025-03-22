import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.json({ success: true, message: "Product API is working!" });
});

export default router;