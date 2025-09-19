import { Request, Response } from "express";
import { registerUser, authenticateUser, loginUser, getUserProfile, verifyEmail, setPassword, logoutUser } from "../services/auth.service";
import { AppError, ErrorCode, logError } from "../utils/error";
import { generateNonce } from "../utils/auth";
import postgresPrisma from '../config/db';
import { generateToken } from "../utils/auth";
import nacl from 'tweetnacl';
import bs58 from 'bs58';

// In-memory nonce store (use Redis for production)
const walletNonces = new Map<string, string>();


export const getWalletNonce = async (req: Request, res: Response) => {
  try {
    const { wallet } = req.query;
    if (!wallet || typeof wallet !== 'string') {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Wallet is required', 400);
    }

    const nonce = generateNonce();
    walletNonces.set(wallet, nonce);
    res.json({ nonce });
  } catch (error: any) {
    await logError({
      code: error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR,
      message: error.message,
      error: error,
    });

    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const errorCode = error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR;
    res.status(statusCode).json({ success: false, error: { code: errorCode, message: error.message } });
  }
};



export const walletLogin = async (req: Request, res: Response) => {
  try {
    const { walletAddress, signature, nonce } = req.body;
    if (!walletAddress || !signature || !nonce) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Missing fields', 400);
    }

    const expectedNonce = walletNonces.get(walletAddress);
    if (!expectedNonce || expectedNonce !== nonce) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Invalid or expired nonce', 400);
    }

    // Verify the signature
    const pubkey = bs58.decode(walletAddress);
    const msg = new TextEncoder().encode(`Sign this message to verify your wallet. Nonce: ${nonce}`);
    const sig = bs58.decode(signature);
    const valid = nacl.sign.detached.verify(msg, sig, pubkey);
    if (!valid) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Invalid signature', 401);
    }

    // Find user by wallet address
    const user = await postgresPrisma.user.findUnique({ 
      where: { walletAddress },
      select:{
        id:true,
              }
      
    });

    if (!user) {
      // Clean up nonce after successful verification
      walletNonces.delete(walletAddress);
      res.json({ 
        success: true, 
        registered: false,
        message: 'Wallet not registered. Please sign up first.'
      });
    }else{

      
      // Generate access token
      const accessToken = await generateToken(user.id);
      
      // Clean up nonce after successful login
      walletNonces.delete(walletAddress);
      
      // Return success response with token and user data
      res.json({
        success: true,
        data: {
          accessToken,
          user
        },
        registered: true
      });
    }
  } catch (error: any) {
    await logError({
      code: error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR,
      message: error.message,
      error: error,
    });

    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const errorCode = error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR;
    res.status(statusCode).json({ success: false, error: { code: errorCode, message: error.message } });
  }
};



export const walletRegister = async (req: Request, res: Response) => {
  try {
    const { walletAddress, signature, nonce } = req.body;
    const userId = req.user?.id;
    
    // Basic validation
    if (!walletAddress || !signature || !nonce || !userId) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Missing required fields', 400);
    }

    // Verify nonce
    const expectedNonce = walletNonces.get(walletAddress);
    if (!expectedNonce || expectedNonce !== nonce) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'Invalid or expired nonce', 403);
    }

    // Verify signature
    const pubkey = bs58.decode(walletAddress);
    const message = `Sign this message to verify your wallet. Nonce: ${nonce}`;
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      pubkey
    );

    if (!isValid) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Invalid signature', 401);
    }

    // Check if wallet is already registered to another user
    const existingUser = await postgresPrisma.user.findFirst({ 
      where: { 
        walletAddress,
        id: { not: userId } // Exclude current user
      } 
    });

    if (existingUser) {
      throw new AppError(ErrorCode.DUPLICATE_ENTRY, 'Wallet address is already registered to another account', 409);
    }

    // Update user with wallet address
    const updatedUser = await postgresPrisma.user.update({
      where: { id: userId },
      data: { walletAddress },
      select: {
        id: true,
        email: true,
        walletAddress: true,
        createdAt: true
      }
    });

    // Clean up nonce
    walletNonces.delete(walletAddress);

    res.status(200).json({ 
      success: true, 
      data: {
        user: updatedUser,
        message: 'Wallet address successfully registered'
      }
    });

  } catch (error: any) {
    await logError({
      code: error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR,
      message: error.message,
      error: error,
    });

    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const errorCode = error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR;
    
     res.status(statusCode).json({ 
      success: false, 
      error: { 
        code: errorCode, 
        message: error.message 
      } 
    });
  }
};




export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const data = await registerUser(email);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    // Log the error
    await logError({
      code: ErrorCode.INVALID_INPUT,
      message: error.message,
      error: error
    });
    
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const errorCode = error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR;
    const errorMessage = statusCode !== 500 ? error.message : "An unexpected error occurred";
    
    res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage
      }
    });
  }
};

export const verify = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    const data = await verifyEmail(token as string);
    res.json({ success: true, data });
  } catch (error: any) {
    // Log the error
    await logError({
      code: ErrorCode.INVALID_INPUT,
      message: error.message,
      error: error
    });
    
    // Throw a standardized error
    throw new AppError(ErrorCode.INVALID_INPUT, error.message, 400);
  }
};



export const setPasswordController = async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      // Log unauthorized error
      await logError({
        code: ErrorCode.UNAUTHORIZED,
        message: "User not authenticated",
        error: new Error("Unauthorized")
      });
      
      throw new AppError(ErrorCode.UNAUTHORIZED, "User not authenticated", 401);
    }

    const data = await setPassword(userId, password);
    res.json({ success: true, data });
  } catch (error: any) {
    // Log the error with user ID if available
    await logError({
      userId: req.user?.id,
      code: error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR,
      message: error.message,
      error: error
    });
    
    // If it's already an AppError, rethrow it
    if (error instanceof AppError) {
      throw error;
    }
    
    // Otherwise, create a new AppError
    throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, error.message, 500);
  }
};

// export async function googleOAuthHandler(req: Request, res: Response) {
//   try {
//     const code = req.query.code as string;
//     const { accessToken, user } = await authenticateUser(code);

//     res.json({ accessToken, user });
//   } catch (error) {
//     console.log(error)
//     res.status(500).json({ error: "OAuth authentication failed" });
//   }
// }

export async function googleOAuthHandler(req: Request, res: Response) {
  try {
    const code = req.query.code as string;
    const { accessToken, user } = await authenticateUser(code);

    // Instead of sending JSON response, redirect to frontend with data
    const redirectUrl = `http://localhost:8080/auth/google/callback?accessToken=${encodeURIComponent(accessToken)}&user=${encodeURIComponent(JSON.stringify(user))}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.log(error);
    // Redirect to login page with error
    res.redirect('http://localhost:8080/login?error=oauth_failed');
  }
}

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const data = await loginUser(email, password);
    res.json({ success: true, data });
  } catch (error: any) {
    // Log the error
    await logError({
      code: ErrorCode.INVALID_CREDENTIALS,
      message: error.message,
      error: error
    });
    
    // Throw a standardized error
    throw new AppError(ErrorCode.INVALID_CREDENTIALS, error.message, 401);
  }
};

export const profile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      // Log unauthorized error
      await logError({
        code: ErrorCode.UNAUTHORIZED,
        message: "User not authenticated",
        error: new Error("Unauthorized")
      });
      
      throw new AppError(ErrorCode.UNAUTHORIZED, "User not authenticated", 401);
    }
    
    const data = await getUserProfile(userId);
    res.json({ success: true, data });
  } catch (error: any) {
    // Log the error with user ID if available
    await logError({
      userId: req.user?.id,
      code: error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR,
      message: error.message,
      error: error
    });
    
    // If it's already an AppError, rethrow it
    if (error instanceof AppError) {
      throw error;
    }
    
    // Otherwise, create a new AppError
    throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, error.message, 500);
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      // Log unauthorized error
      await logError({
        code: ErrorCode.UNAUTHORIZED,
        message: "User not authenticated",
        error: new Error("Unauthorized")
      });
      
      throw new AppError(ErrorCode.UNAUTHORIZED, "User not authenticated", 401);
    }
    
    await logoutUser(userId);
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error: any) {
    // Log the error with user ID if available
    await logError({
      userId: req.user?.id,
      code: error instanceof AppError ? error.code : ErrorCode.INTERNAL_SERVER_ERROR,
      message: error.message,
      error: error
    });
    
    // If it's already an AppError, rethrow it
    if (error instanceof AppError) {
      throw error;
    }
    
    // Otherwise, create a new AppError
    throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, error.message, 500);
  }
};