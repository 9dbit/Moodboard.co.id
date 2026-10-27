import type { RequestHandler } from "express";
import type { User } from "@shared/schema";

declare global {
  namespace Express {
    interface Request { dbUser?: User; }
  }
}
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.dbUser) return void res.status(401).json({ message: "Unauthorized" });
  next();
};
