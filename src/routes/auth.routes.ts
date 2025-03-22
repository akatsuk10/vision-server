import { Router } from "express";
import { register, login, profile, verify, setPasswordController, logout } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.post("/register", register);
router.get("/verify-email", verify);
router.post("/set-password", authMiddleware, setPasswordController);
router.post("/login", login);
router.get("/profile", authMiddleware, profile);
router.post("/logout", authMiddleware, logout);

export default router;
