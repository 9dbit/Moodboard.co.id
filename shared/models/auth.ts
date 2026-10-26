import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, text, integer, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  subscriptionTier: varchar("subscription_tier").default("trial"),
  trialExpiresAt: timestamp("trial_expires_at"),
  whatsappNumber: varchar("whatsapp_number"),
  companyName: varchar("company_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const adminSettings = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  settingKey: varchar("setting_key").notNull().unique(),
  settingValue: text("setting_value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  amount: integer("amount").notNull(),
  currency: varchar("currency").default("IDR"),
  status: varchar("status").default("pending"),
  paymentMethod: varchar("payment_method"),
  gatewayTransactionId: varchar("gateway_transaction_id"),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const affiliateCodes = pgTable("affiliate_codes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  code: varchar("code").notNull().unique(),
  label: varchar("label"),
  clicks: integer("clicks").default(0),
  signups: integer("signups").default(0),
  conversions: integer("conversions").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const affiliateBanners = pgTable("affiliate_banners", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  linkUrl: text("link_url"),
  position: varchar("position").default("landing"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const affiliateReferrals = pgTable("affiliate_referrals", {
  id: serial("id").primaryKey(),
  codeId: integer("code_id").notNull(),
  referredUserId: varchar("referred_user_id"),
  status: varchar("status").default("clicked"),
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const magicLinks = pgTable("magic_links", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull(),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertMagicLinkSchema = createInsertSchema(magicLinks).omit({ id: true, createdAt: true });

export const insertAdminSettingSchema = createInsertSchema(adminSettings).omit({ id: true, updatedAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAffiliateCodeSchema = createInsertSchema(affiliateCodes).omit({ id: true, clicks: true, signups: true, conversions: true, createdAt: true });
export const insertAffiliateBannerSchema = createInsertSchema(affiliateBanners).omit({ id: true, createdAt: true });
export const insertAffiliateReferralSchema = createInsertSchema(affiliateReferrals).omit({ id: true, createdAt: true });

export type MagicLink = typeof magicLinks.$inferSelect;
export type InsertMagicLink = z.infer<typeof insertMagicLinkSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type AdminSetting = typeof adminSettings.$inferSelect;
export type InsertAdminSetting = z.infer<typeof insertAdminSettingSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type AffiliateCode = typeof affiliateCodes.$inferSelect;
export type InsertAffiliateCode = z.infer<typeof insertAffiliateCodeSchema>;
export type AffiliateBanner = typeof affiliateBanners.$inferSelect;
export type InsertAffiliateBanner = z.infer<typeof insertAffiliateBannerSchema>;
export type AffiliateReferral = typeof affiliateReferrals.$inferSelect;
export type InsertAffiliateReferral = z.infer<typeof insertAffiliateReferralSchema>;
