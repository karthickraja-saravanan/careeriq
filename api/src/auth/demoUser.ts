import type { RequestHandler } from "express";

/**
 * Demo mode: every request acts as one seeded user (see migration 002).
 * All repository functions still take a userId and filter on it, so replacing this
 * middleware with real authentication needs no changes in the data layer.
 */
export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

declare module "express-serve-static-core" {
  interface Request {
    userId: string;
  }
}

export const demoUser: RequestHandler = (req, _res, next) => {
  req.userId = DEMO_USER_ID;
  next();
};
