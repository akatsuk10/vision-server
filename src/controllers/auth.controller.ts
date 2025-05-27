import { Request, Response } from "express";
import { registerUser, authenticateUser, loginUser, getUserProfile, verifyEmail, setPassword, logoutUser } from "../services/auth.service";
import { AppError, ErrorCode, logError } from "../utils/error";

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