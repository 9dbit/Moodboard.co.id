import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, type User } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      dbUser?: User;
    }
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    // Replit-managed Clerk adds userId to sessionClaims. Migrated users receive
    // their legacy Replit subject there; new users receive their Clerk ID.
    // The native auth.userId fallback covers sessions created before that claim
    // is available without changing the migrated-user bridge.
    const userId =
      (auth.sessionClaims?.userId as string | undefined) || auth.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!dbUser) {
      const [inserted] = await db
        .insert(users)
        // Identity fields are intentionally not copied into the local table:
        // they are nullable, are not FK targets, and Clerk is their source of
        // truth. The local row stores application state only.
        .values({ id: userId })
        .onConflictDoNothing()
        .returning();
      dbUser = inserted;
      if (!dbUser) {
        [dbUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
      }
    }

    if (!dbUser) {
      return res.status(403).json({ message: "Account access unavailable" });
    }

    req.dbUser = dbUser;
    next();
  } catch (error) {
    next(error);
  }
};