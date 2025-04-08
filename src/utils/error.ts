import { PrismaClient } from '@prisma/client';
import { mongoPrisma } from '../config/db';

// Error codes enum for consistent error handling
export enum ErrorCode {
  // Authentication errors (1000-1099)
  AUTHENTICATION_FAILED = 'AUTH_001',
  INVALID_CREDENTIALS = 'AUTH_002',
  TOKEN_EXPIRED = 'AUTH_003',
  TOKEN_INVALID = 'AUTH_004',
  UNAUTHORIZED = 'AUTH_005',
  
  // Validation errors (2000-2099)
  INVALID_INPUT = 'VAL_001',
  MISSING_REQUIRED_FIELD = 'VAL_002',
  INVALID_FORMAT = 'VAL_003',
  
  // Database errors (3000-3099)
  DATABASE_CONNECTION_ERROR = 'DB_001',
  RECORD_NOT_FOUND = 'DB_002',
  DUPLICATE_ENTRY = 'DB_003',
  QUERY_FAILED = 'DB_004',
  
  // API errors (4000-4099)
  API_REQUEST_FAILED = 'API_001',
  API_RATE_LIMIT_EXCEEDED = 'API_002',
  API_TIMEOUT = 'API_003',
  
  // Server errors (5000-5099)
  INTERNAL_SERVER_ERROR = 'SRV_001',
  SERVICE_UNAVAILABLE = 'SRV_002',
  
  // Client errors (6000-6099)
  BAD_REQUEST = 'CLI_001',
  NOT_FOUND = 'CLI_002',
  FORBIDDEN = 'CLI_003',
  
  // File errors (7000-7099)
  FILE_UPLOAD_FAILED = 'FILE_001',
  FILE_NOT_FOUND = 'FILE_002',
  FILE_TOO_LARGE = 'FILE_003',
  
  // Unknown errors (9000-9099)
  UNKNOWN_ERROR = 'UNK_001'
}

// Error message mapping
export const ErrorMessages: Record<ErrorCode, string> = {
  // Authentication errors
  [ErrorCode.AUTHENTICATION_FAILED]: 'Authentication failed',
  [ErrorCode.INVALID_CREDENTIALS]: 'Invalid credentials provided',
  [ErrorCode.TOKEN_EXPIRED]: 'Authentication token has expired',
  [ErrorCode.TOKEN_INVALID]: 'Invalid authentication token',
  [ErrorCode.UNAUTHORIZED]: 'Unauthorized access',
  
  // Validation errors
  [ErrorCode.INVALID_INPUT]: 'Invalid input provided',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'Required field is missing',
  [ErrorCode.INVALID_FORMAT]: 'Invalid format for the provided data',
  
  // Database errors
  [ErrorCode.DATABASE_CONNECTION_ERROR]: 'Database connection error',
  [ErrorCode.RECORD_NOT_FOUND]: 'Record not found in database',
  [ErrorCode.DUPLICATE_ENTRY]: 'Duplicate entry detected',
  [ErrorCode.QUERY_FAILED]: 'Database query failed',
  
  // API errors
  [ErrorCode.API_REQUEST_FAILED]: 'API request failed',
  [ErrorCode.API_RATE_LIMIT_EXCEEDED]: 'API rate limit exceeded',
  [ErrorCode.API_TIMEOUT]: 'API request timed out',
  
  // Server errors
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'Internal server error',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
  
  // Client errors
  [ErrorCode.BAD_REQUEST]: 'Bad request',
  [ErrorCode.NOT_FOUND]: 'Resource not found',
  [ErrorCode.FORBIDDEN]: 'Access forbidden',
  
  // File errors
  [ErrorCode.FILE_UPLOAD_FAILED]: 'File upload failed',
  [ErrorCode.FILE_NOT_FOUND]: 'File not found',
  [ErrorCode.FILE_TOO_LARGE]: 'File size exceeds limit',
  
  // Unknown errors
  [ErrorCode.UNKNOWN_ERROR]: 'An unknown error occurred'
};

// Custom error class
export class AppError extends Error {
  code: ErrorCode;
  statusCode: number;
  
  constructor(code: ErrorCode, message?: string, statusCode: number = 500) {
    super(message || ErrorMessages[code]);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Error logging interface
interface ErrorLogOptions {
  userId?: string;
  code: ErrorCode;
  message?: string;
  error?: any;
  metadata?: Record<string, any>;
}

/**
 * Safely logs an error to the database without throwing exceptions
 * If userId is provided, logs to UserError collection
 * Otherwise, logs to PublicError collection
 */
export async function logError(options: ErrorLogOptions): Promise<void> {
  const { userId, code, message, error, metadata = {} } = options;
  
  try {
    // Format error message
    const errorMessage = message || ErrorMessages[code];
    
    // Format error object
    const errorString = error instanceof Error 
      ? JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
          ...(error instanceof AppError && { code: error.code, statusCode: error.statusCode })
        })
      : JSON.stringify(error);
    
    // Log to appropriate collection based on whether user is authenticated
    if (userId) {
      // Log to UserError collection
      await mongoPrisma.userError.create({
        data: {
          userId,
          code,
          message: errorMessage,
          error: errorString,
          metadata: metadata ? JSON.stringify(metadata) : null
        }
      });
    } else {
      // Log to PublicError collection
      await mongoPrisma.publicError.create({
        data: {
          code,
          message: errorMessage,
          error: errorString,
          metadata: metadata ? JSON.stringify(metadata) : null
        }
      });
    }
  } catch (logError) {
    // If error logging fails, log to console but don't throw
    console.error('Failed to log error to database:', logError);
    console.error('Original error:', options);
  }
}

/**
 * Helper function to create and log an error in one step
 * This function will not throw exceptions that could crash the server
 */
export async function createAndLogError(
  code: ErrorCode, 
  message?: string, 
  statusCode: number = 500,
  userId?: string,
  error?: any,
  metadata?: Record<string, any>
): Promise<AppError> {
  const appError = new AppError(code, message, statusCode);
  
  // Use a try-catch to prevent any errors from crashing the server
  try {
    await logError({
      userId,
      code,
      message: appError.message,
      error: error || appError,
      metadata
    });
  } catch (err) {
    // Just log to console, don't rethrow
    console.error('Error in createAndLogError:', err);
  }
  
  return appError;
}

/**
 * Middleware for Express to handle errors
 * This middleware will catch all errors and prevent the server from crashing
 */
export function errorHandler(err: any, req: any, res: any, next: any) {
  // Default error
  let statusCode = 500;
  let errorCode = ErrorCode.UNKNOWN_ERROR;
  let message = 'An unexpected error occurred';
  
  // Handle AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.code;
    message = err.message;
  }
  
  // Get user ID from request if available
  const userId = req.user?.id;
  
  // Log the error without throwing
  logError({
    userId,
    code: errorCode,
    message,
    error: err,
    metadata: {
      path: req.path,
      method: req.method,
      query: req.query,
      body: req.body,
      headers: req.headers
    }
  }).catch(err => {
    // Just log to console, don't rethrow
    console.error('Error in errorHandler middleware:', err);
  });
  
  // Send response
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message
    }
  });
}

/**
 * Global unhandled rejection handler to prevent server crashes
 */
export function setupGlobalErrorHandlers() {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process, just log the error
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Log the error but don't exit
    logError({
      code: ErrorCode.UNKNOWN_ERROR,
      message: 'Uncaught Exception',
      error,
      metadata: { type: 'uncaughtException' }
    }).catch(err => console.error('Failed to log uncaught exception:', err));
  });
}

export default {
  ErrorCode,
  ErrorMessages,
  AppError,
  logError,
  createAndLogError,
  errorHandler,
  setupGlobalErrorHandlers
};
