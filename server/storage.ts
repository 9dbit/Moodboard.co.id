import { db } from "./db";
import { eq, and, desc, sql, count } from "drizzle-orm";
import {
  projects,
  pins,
  sources,
  users,
  adminSettings,
  transactions,
  affiliateCodes,
  affiliateBanners,
  affiliateReferrals,
  magicLinks,
  type Project,
  type InsertProject,
  type Pin,
  type InsertPin,
  type Source,
  type InsertSource,
  type User,
  type AdminSetting,
  type InsertAdminSetting,
  type Transaction,
  type InsertTransaction,
  type AffiliateCode,
  type InsertAffiliateCode,
  type AffiliateBanner,
  type InsertAffiliateBanner,
  type AffiliateReferral,
  type InsertAffiliateReferral,
  type MagicLink,
  type InsertMagicLink,
  type UpsertUser,
} from "@shared/schema";
import { randomBytes } from "crypto";

export interface IStorage {
  createProject(data: InsertProject): Promise<Project>;
  getProject(id: number): Promise<Project | undefined>;
  getProjectsByUser(userId: string): Promise<Project[]>;
  updateProject(id: number, data: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<void>;
  getProjectByShareToken(token: string): Promise<Project | undefined>;
  generateShareToken(id: number): Promise<string>;

  createPin(data: InsertPin): Promise<Pin>;
  getPin(id: number): Promise<Pin | undefined>;
  getPinsByProject(projectId: number): Promise<Pin[]>;
  updatePin(id: number, data: Partial<Pin>): Promise<Pin | undefined>;
  deletePin(id: number): Promise<void>;
  clearPinDescriptions(projectId: number): Promise<void>;

  createSource(data: InsertSource): Promise<Source>;
  getSourcesByProject(projectId: number): Promise<Source[]>;
  updateSource(id: number, data: Partial<Source>): Promise<Source | undefined>;

  getAllUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  getUserCount(): Promise<number>;
  getUserCountByTier(tier: string): Promise<number>;

  getAdminSetting(key: string): Promise<string | null>;
  setAdminSetting(key: string, value: string): Promise<AdminSetting>;
  getAllAdminSettings(): Promise<AdminSetting[]>;

  createTransaction(data: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, data: Partial<Transaction>): Promise<Transaction | undefined>;
  getTransactionByGatewayId(gatewayId: string): Promise<Transaction | undefined>;
  getTransactions(): Promise<Transaction[]>;
  getTransactionsByUser(userId: string): Promise<Transaction[]>;
  getTransactionStats(): Promise<{ totalRevenue: number; monthlyRevenue: number; transactionCount: number }>;

  createAffiliateCode(data: InsertAffiliateCode): Promise<AffiliateCode>;
  getAffiliateCodesByUser(userId: string): Promise<AffiliateCode[]>;
  getAffiliateCodeByCode(code: string): Promise<AffiliateCode | undefined>;
  getAllAffiliateCodes(): Promise<AffiliateCode[]>;
  updateAffiliateCode(id: number, data: Partial<AffiliateCode>): Promise<AffiliateCode | undefined>;
  deleteAffiliateCode(id: number): Promise<void>;
  incrementAffiliateClicks(code: string): Promise<void>;
  incrementAffiliateSignups(code: string): Promise<void>;
  incrementAffiliateConversions(code: string): Promise<void>;

  createAffiliateBanner(data: InsertAffiliateBanner): Promise<AffiliateBanner>;
  getAffiliateBanners(activeOnly?: boolean): Promise<AffiliateBanner[]>;
  updateAffiliateBanner(id: number, data: Partial<AffiliateBanner>): Promise<AffiliateBanner | undefined>;
  deleteAffiliateBanner(id: number): Promise<void>;

  createAffiliateReferral(data: InsertAffiliateReferral): Promise<AffiliateReferral>;
  getAffiliateReferralsByCode(codeId: number): Promise<AffiliateReferral[]>;

  getAllProjects(): Promise<Project[]>;

  createMagicLink(data: InsertMagicLink): Promise<MagicLink>;
  getMagicLinkByToken(token: string): Promise<MagicLink | undefined>;
  markMagicLinkUsed(token: string): Promise<void>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(data: UpsertUser): Promise<User>;
}

class DatabaseStorage implements IStorage {
  async createProject(data: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(data).returning();
    return project;
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getProjectsByUser(userId: string): Promise<Project[]> {
    return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt));
  }

  async updateProject(id: number, data: Partial<Project>): Promise<Project | undefined> {
    // Ownership and row identity never change through an editor patch.
    const { id: _id, userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...editable } = data;
    const [project] = await db
      .update(projects)
      .set({ ...editable, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getProjectByShareToken(token: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.shareToken, token));
    return project;
  }

  async generateShareToken(id: number): Promise<string> {
    const token = randomBytes(24).toString("hex");
    await db
      .update(projects)
      .set({ shareToken: token, updatedAt: new Date() })
      .where(eq(projects.id, id));
    return token;
  }

  async createPin(data: InsertPin): Promise<Pin> {
    const [pin] = await db.insert(pins).values(data).returning();
    return pin;
  }

  async getPin(id: number): Promise<Pin | undefined> {
    const [pin] = await db.select().from(pins).where(eq(pins.id, id));
    return pin;
  }

  async getPinsByProject(projectId: number): Promise<Pin[]> {
    return db.select().from(pins).where(eq(pins.projectId, projectId)).orderBy(pins.position);
  }

  async updatePin(id: number, data: Partial<Pin>): Promise<Pin | undefined> {
    // All callers, including snapshot restoration, retain the original parent.
    const { id: _id, projectId: _projectId, createdAt: _createdAt, ...editable } = data;
    const [pin] = await db.update(pins).set(editable).where(eq(pins.id, id)).returning();
    return pin;
  }

  async deletePin(id: number): Promise<void> {
    await db.delete(pins).where(eq(pins.id, id));
  }

  async clearPinDescriptions(projectId: number): Promise<void> {
    await db.update(pins)
      .set({ descriptionAi: null, descriptionFinal: null, descriptionCustomInput: null })
      .where(eq(pins.projectId, projectId));
  }

  async createSource(data: InsertSource): Promise<Source> {
    const [source] = await db.insert(sources).values(data).returning();
    return source;
  }

  async getSourcesByProject(projectId: number): Promise<Source[]> {
    return db.select().from(sources).where(eq(sources.projectId, projectId));
  }

  async updateSource(id: number, data: Partial<Source>): Promise<Source | undefined> {
    const [source] = await db.update(sources).set(data).where(eq(sources.id, id)).returning();
    return source;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return user;
  }

  async getUserCount(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(users);
    return result?.count || 0;
  }

  async getUserCountByTier(tier: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(users).where(eq(users.subscriptionTier, tier));
    return result?.count || 0;
  }

  async getAdminSetting(key: string): Promise<string | null> {
    const [setting] = await db.select().from(adminSettings).where(eq(adminSettings.settingKey, key));
    return setting?.settingValue || null;
  }

  async setAdminSetting(key: string, value: string): Promise<AdminSetting> {
    const existing = await this.getAdminSetting(key);
    if (existing !== null) {
      const [updated] = await db.update(adminSettings).set({ settingValue: value, updatedAt: new Date() }).where(eq(adminSettings.settingKey, key)).returning();
      return updated;
    }
    const [created] = await db.insert(adminSettings).values({ settingKey: key, settingValue: value }).returning();
    return created;
  }

  async getAllAdminSettings(): Promise<AdminSetting[]> {
    return db.select().from(adminSettings);
  }

  async createTransaction(data: InsertTransaction): Promise<Transaction> {
    const [tx] = await db.insert(transactions).values(data).returning();
    return tx;
  }

  async updateTransaction(id: number, data: Partial<Transaction>): Promise<Transaction | undefined> {
    const [tx] = await db.update(transactions).set({ ...data, updatedAt: new Date() }).where(eq(transactions.id, id)).returning();
    return tx;
  }

  async getTransactionByGatewayId(gatewayId: string): Promise<Transaction | undefined> {
    const [tx] = await db.select().from(transactions).where(eq(transactions.gatewayTransactionId, gatewayId));
    return tx;
  }

  async getTransactions(): Promise<Transaction[]> {
    return db.select().from(transactions).orderBy(desc(transactions.createdAt));
  }

  async getTransactionsByUser(userId: string): Promise<Transaction[]> {
    return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt));
  }

  async getTransactionStats(): Promise<{ totalRevenue: number; monthlyRevenue: number; transactionCount: number }> {
    const allTx = await db.select().from(transactions).where(eq(transactions.status, "completed"));
    const totalRevenue = allTx.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyTx = allTx.filter(tx => tx.createdAt >= monthStart);
    const monthlyRevenue = monthlyTx.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    return { totalRevenue, monthlyRevenue, transactionCount: allTx.length };
  }

  async createAffiliateCode(data: InsertAffiliateCode): Promise<AffiliateCode> {
    const [code] = await db.insert(affiliateCodes).values(data).returning();
    return code;
  }

  async getAffiliateCodesByUser(userId: string): Promise<AffiliateCode[]> {
    return db.select().from(affiliateCodes).where(eq(affiliateCodes.userId, userId)).orderBy(desc(affiliateCodes.createdAt));
  }

  async getAffiliateCodeByCode(code: string): Promise<AffiliateCode | undefined> {
    const [result] = await db.select().from(affiliateCodes).where(eq(affiliateCodes.code, code));
    return result;
  }

  async getAllAffiliateCodes(): Promise<AffiliateCode[]> {
    return db.select().from(affiliateCodes).orderBy(desc(affiliateCodes.createdAt));
  }

  async updateAffiliateCode(id: number, data: Partial<AffiliateCode>): Promise<AffiliateCode | undefined> {
    const [updated] = await db.update(affiliateCodes).set(data).where(eq(affiliateCodes.id, id)).returning();
    return updated;
  }

  async deleteAffiliateCode(id: number): Promise<void> {
    await db.delete(affiliateCodes).where(eq(affiliateCodes.id, id));
  }

  async incrementAffiliateClicks(code: string): Promise<void> {
    await db.update(affiliateCodes).set({ clicks: sql`${affiliateCodes.clicks} + 1` }).where(eq(affiliateCodes.code, code));
  }

  async incrementAffiliateSignups(code: string): Promise<void> {
    await db.update(affiliateCodes).set({ signups: sql`${affiliateCodes.signups} + 1` }).where(eq(affiliateCodes.code, code));
  }

  async incrementAffiliateConversions(code: string): Promise<void> {
    await db.update(affiliateCodes).set({ conversions: sql`${affiliateCodes.conversions} + 1` }).where(eq(affiliateCodes.code, code));
  }

  async createAffiliateBanner(data: InsertAffiliateBanner): Promise<AffiliateBanner> {
    const [banner] = await db.insert(affiliateBanners).values(data).returning();
    return banner;
  }

  async getAffiliateBanners(activeOnly?: boolean): Promise<AffiliateBanner[]> {
    if (activeOnly) {
      return db.select().from(affiliateBanners).where(eq(affiliateBanners.isActive, true));
    }
    return db.select().from(affiliateBanners);
  }

  async updateAffiliateBanner(id: number, data: Partial<AffiliateBanner>): Promise<AffiliateBanner | undefined> {
    const [updated] = await db.update(affiliateBanners).set(data).where(eq(affiliateBanners.id, id)).returning();
    return updated;
  }

  async deleteAffiliateBanner(id: number): Promise<void> {
    await db.delete(affiliateBanners).where(eq(affiliateBanners.id, id));
  }

  async createAffiliateReferral(data: InsertAffiliateReferral): Promise<AffiliateReferral> {
    const [referral] = await db.insert(affiliateReferrals).values(data).returning();
    return referral;
  }

  async getAffiliateReferralsByCode(codeId: number): Promise<AffiliateReferral[]> {
    return db.select().from(affiliateReferrals).where(eq(affiliateReferrals.codeId, codeId));
  }

  async getAllProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async createMagicLink(data: InsertMagicLink): Promise<MagicLink> {
    const [link] = await db.insert(magicLinks).values(data).returning();
    return link;
  }

  async getMagicLinkByToken(token: string): Promise<MagicLink | undefined> {
    const [link] = await db.select().from(magicLinks).where(eq(magicLinks.token, token));
    return link;
  }

  async markMagicLinkUsed(token: string): Promise<void> {
    await db.update(magicLinks).set({ used: true }).where(eq(magicLinks.token, token));
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(data: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(data)
      .onConflictDoUpdate({
        target: users.id,
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
    return user;
  }
}

export const storage = new DatabaseStorage();
