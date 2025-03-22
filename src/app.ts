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

// Middlewares
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON requests
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded requests
app.use(helmet()); // Security headers
app.use(compression()); // Response compression

// Routes
app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);

// Error Handling Middleware
app.use(errorMiddleware);

export default app;
