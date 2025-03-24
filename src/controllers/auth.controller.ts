import { Request, Response } from "express";
import { registerUser, authenticateUser, loginUser, getUserProfile, verifyEmail, setPassword, logoutUser } from "../services/auth.service";

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const data = await registerUser(email);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const verify = async (req: Request, res: Response) => {
    try {
      const { token } = req.query;
      const data = await verifyEmail(token as string);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  };

export const setPasswordController = async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const userId = req.user?.id;
    if (!userId) throw new Error("Unauthorized");

    const data = await setPassword(userId, password);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};



export async function googleOAuthHandler(req: Request, res: Response) {
  try {
    const code = req.query.code as string;
    const { accessToken, user } = await authenticateUser(code);

    res.json({ accessToken, user });
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "OAuth authentication failed" });
  }
}


export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const data = await loginUser(email, password);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const profile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized User" });
      return;
    }
    const user = await getUserProfile(userId);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.header("Authorization")?.replace("Bearer ", "");
  
      if (!token) {
         res.status(400).json({ success: false, message: "Token required" });
         return;
      }
  
      await logoutUser(token);
  
      res.json({ success: true, message: "Logged out successfully" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
};