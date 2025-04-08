import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../utils/error";

// Use the errorHandler from our error utility
export const errorMiddleware = errorHandler;
