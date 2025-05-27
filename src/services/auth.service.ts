import { postgresPrisma } from "../config/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import axios from "axios"
import { sendVerificationEmail } from "./email.service";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import redis from "../config/redis";
import { generateToken } from "../utils/auth";
import { AppError, ErrorCode } from "../utils/error";

dotenv.config();
const emailSchema = z.string().email();

export const invalidateToken = async (token: string) => {
  await redis.set(`blacklist:${token}`, "true", "EX", 7 * 24 * 60 * 60); // Add token to blacklist for 7 days
};

// Step 1: Register user and send verification email
export const registerUser = async (email: string) => {
  // Validate email format
  const parsed = emailSchema.safeParse(email);
   if (!parsed.success) {
      throw new AppError(ErrorCode.INVALID_INPUT, "Invalid email address", 400);
    }
  // Check if email is already in use
  const existingUser = await postgresPrisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError(ErrorCode.INVALID_INPUT, "Email already exists", 400);
  }

  // Create verification token and user
  const verificationToken = uuidv4();
  
  // Store verification data in Redis temporarily (expires in 24 hours)
  const verificationData = {
    email,
    token: verificationToken,
    createdAt: new Date().toISOString()
  };
  
  // Store in Redis with 24 hour expiration
  await redis.setex(`verification:${verificationToken}`, 24 * 60 * 60, JSON.stringify(verificationData));
  
  // Also store by email to prevent duplicate registration attempts
  await redis.setex(`pending:${email}`, 24 * 60 * 60, verificationToken);

  // Send verification email
  await sendVerificationEmail(email, verificationToken);

  return { message: "Verification email sent" };
};

// Step 2: Verify email - Only create user in database after verification
export const verifyEmail = async (token: string) => {
  // Get verification data from Redis
  const verificationDataStr = await redis.get(`verification:${token}`);
  
  if (!verificationDataStr) {
    throw new AppError(ErrorCode.TOKEN_INVALID, "Invalid or expired verification token", 400);
  }

  const verificationData = JSON.parse(verificationDataStr);
  const { email } = verificationData;

  // Check if user already exists (in case of race condition)
  const existingUser = await postgresPrisma.user.findUnique({ where: { email } });
  if (existingUser) {
    // Clean up Redis data
    await redis.del(`verification:${token}`, `pending:${email}`);
    throw new AppError(ErrorCode.DUPLICATE_ENTRY, "Email already exists", 400);
  }

  // NOW create the user in database (only after verification)
  const user = await postgresPrisma.user.create({
    data: {
      email,
      isEmailVerified: true, // Already verified since they clicked the link
    },
  });

  // Clean up Redis verification data
  await redis.del(`verification:${token}`, `pending:${email}`);

  // Generate temporary token for password setup
  const tempToken = await generateToken(user.id);
  
  return { tempToken, userId: user.id };
};

// Step 3: Set Password
export const setPassword = async (userId: string, password: string) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  await postgresPrisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
    },
  });
  const accessToken = await generateToken(userId);
  return { accessToken };
};

//Step 4 : Google Oauth 2.0
async function getTokens(code: string) {
  const url = "https://oauth2.googleapis.com/token";
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECERET  ;
  if (!clientId || !clientSecret) {
    return ("Google OAuth credentials are not configured");
  }
  const values = {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${process.env.SERVER_URI}/auth/google`,
    grant_type: "authorization_code",
  };
  return axios
    .post(url, new URLSearchParams(values), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })
    .then((res) => res.data)
    .catch((error) => {
      console.error("Failed to fetch auth tokens", error.message);
      return(error.message);
    });
}

export async function authenticateUser(code: string) {
  const { id_token, access_token } = await getTokens(code);
  const googleUser = await axios
    .get(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`, {
      headers: { Authorization: `Bearer ${id_token}` },
    })
    .then((res) => res.data)
    .catch((error) => {
      console.error("Failed to fetch user", error.message);
      return(error.message);
    });
  let user = await postgresPrisma.user.findUnique({
    where: { email: googleUser.email },
  });
  if (!user) {
    user = await postgresPrisma.user.create({
      data: {
        email: googleUser.email,
        name: googleUser.name,
        isEmailVerified: true,
      },
    });
  }
  const oldToken = await redis.get(`token:${user.id}`);
  if (oldToken) {
    await invalidateToken(oldToken);
  }
  const accessToken = await generateToken(user.id);
  await redis.set(`token:${user.id}`, accessToken);
  return { accessToken, user };
}
// Step 5: Login user
export const loginUser = async (email: string, password: string) => {
    const user = await postgresPrisma.user.findUnique({ where: { email } });
    if (!user || !user.password) return("Invalid credentials");
    if (!user.isEmailVerified) return("Email not verified");
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return("Invalid credentials");
    // ✅ Retrieve old token and blacklist it
    const oldToken = await redis.get(`token:${user.id}`);
    if (oldToken) {
      await invalidateToken(oldToken);
    }
    const accessToken = await generateToken(user.id);
    return { accessToken };

};
// Get user profile
export const getUserProfile = async (userId: string) => {
  return await postgresPrisma.user.findUnique({ where: { id: userId } });
};

export const logoutUser = async (token: string) => {
    await invalidateToken(token); // Blacklist the token
};
  
