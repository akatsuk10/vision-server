import prisma from "../config/db";
import bcrypt from "bcryptjs";
import axios from "axios"
import { sendVerificationEmail } from "./email.service";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import redis from "../config/redis";
import { generateToken } from "../utils/auth";

dotenv.config();

export const invalidateToken = async (token: string) => {
  await redis.set(`blacklist:${token}`, "true", "EX", 7 * 24 * 60 * 60); // Add token to blacklist for 7 days
};

// Step 1: Register user and send verification email
export const registerUser = async (email: string) => {
    let user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      throw new Error("Email is already in use");
    }
    const verificationToken = uuidv4();
    user = await prisma.user.create({
      data: {
        email,
        verificationToken,
      },
    });
    await sendVerificationEmail(email, verificationToken);
    return { message: "Verification email sent" };
  };

// Step 2: Verify email
export const verifyEmail = async (token: string) => {
  const user = await prisma.user.findUnique({ where: { verificationToken: token } });
  if (!user) {
    throw new Error("Invalid or expired token");
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      verificationToken: null,
    },
  });
  const tempToken = await generateToken(user.id);
  return { tempToken };
};

// Step 3: Set Password
export const setPassword = async (userId: string, password: string) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.user.update({
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
    throw new Error("Google OAuth credentials are not configured");
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
      throw new Error(error.message);
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
      throw new Error(error.message);
    });
  let user = await prisma.user.findUnique({
    where: { email: googleUser.email },
  });
  if (!user) {
    user = await prisma.user.create({
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
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) throw new Error("Invalid credentials");
    if (!user.isEmailVerified) throw new Error("Email not verified");
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new Error("Invalid credentials");
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
  return await prisma.user.findUnique({ where: { id: userId } });
};

export const logoutUser = async (token: string) => {
    await invalidateToken(token); // Blacklist the token
};
  
