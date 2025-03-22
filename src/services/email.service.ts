import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

export const sendVerificationEmail = async (email: string, token: string) => {
  const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"Vision Hunt" <${process.env.SMTP_EMAIL}>`,
    to: email,
    subject: "Verify Your Email",
    html: `<p>Click <a href="${verificationLink}">here</a> to verify your email.</p>`,
  });
};
