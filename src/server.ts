import app from "./app";
import dotenv from "dotenv";
import { setupGlobalErrorHandlers } from "./utils/error";

dotenv.config();

// Set up global error handlers to prevent server crashes
setupGlobalErrorHandlers();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});