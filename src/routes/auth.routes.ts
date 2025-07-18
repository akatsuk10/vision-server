import { Router } from "express";
import { register, login, profile, verify, setPasswordController, logout, googleOAuthHandler } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { getWalletNonce, walletLogin, walletRegister } from "../controllers/auth.controller";

const router = Router();

router.post("/register", register);
router.get("/verify-email", verify);
router.post("/set-password", authMiddleware, setPasswordController);
router.get("/google", googleOAuthHandler);
router.post("/login", login);
router.get("/profile", authMiddleware, profile);
router.post("/logout", authMiddleware, logout);

// Solana wallet auth endpoints
router.get("/wallet-nonce", getWalletNonce);
router.post("/wallet-login", walletLogin);
router.post("/wallet-register", walletRegister);

export default router;