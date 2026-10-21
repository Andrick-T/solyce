import { rateLimit } from "express-rate-limit";

function createAuthRateLimiter({ windowMs, limit, code, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code,
        message,
      },
    },
  });
}

export const studentLoginLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  code: "LOGIN_RATE_LIMITED",
  message: "Too many sign-in attempts. Please try again in 15 minutes.",
});

export const adminLoginLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  code: "LOGIN_RATE_LIMITED",
  message: "Too many sign-in attempts. Please try again in 15 minutes.",
});

export const instructorLoginLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  code: "LOGIN_RATE_LIMITED",
  message: "Too many sign-in attempts. Please try again in 15 minutes.",
});

export const studentRegistrationLimiter = createAuthRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  code: "REGISTRATION_RATE_LIMITED",
  message: "Too many registration attempts. Please try again in one hour.",
});
