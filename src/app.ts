import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import compression from "compression";
import productRoutes from "./routes/product.routes";
import authRoutes from "./routes/auth.routes";
import { errorMiddleware } from "./middlewares/error.middleware";

dotenv.config(); // Load environment variables

const app = express();
// CORS configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['set-cookie']
  };
  
// Middlewares
app.use(cors(corsOptions)); // Enable CORS
app.use(express.json()); // Parse JSON requests
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded requests
app.use(helmet()); // Security headers
app.use(compression()); // Response compression

// BigInt JSON serialization middleware


// Routes
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/auth", authRoutes);

// Error Handling Middleware
app.use(errorMiddleware);

export default app;
