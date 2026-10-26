import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, serial, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";
export * from "./models/chat";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  studioName: text("studio_name"),
  studioLogoPath: text("studio_logo_path"),
  designerName: text("designer_name"),
  projectName: text("project_name"),
  descriptionRaw: text("description_raw"),
  descriptionAi: text("description_ai"),
  descriptionEnabled: boolean("description_enabled").default(true),
  leadStatus: text("lead_status").default("warm"),
  clientCompany: text("client_company"),
  clientOwnerName: text("client_owner_name"),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  clientLocation: text("client_location"),
  showFooter: boolean("show_footer").default(true),
  paperSize: text("paper_size").default("A3"),
  orientation: text("orientation").default("horizontal"),
  imageLayout: text("image_layout").default("original"),
  gridColumns: integer("grid_columns").default(3),
  descriptionFontSize: text("description_font_size").default("normal"),
  fontFamily: text("font_family").default("Montserrat"),
  projectCategory: text("project_category").default("architecture"),
  signatureField: text("signature_field"),
  pageDescriptions: jsonb("page_descriptions").$type<Array<{ title: string; description: string }>>(),
  studioWebsite: text("studio_website"),
  studioSocialMedia: text("studio_social_media"),
  studioContactNumber: text("studio_contact_number"),
  canvasBackground: text("canvas_background").default("#ffffff"),
  coverImageStyle: text("cover_image_style").default("rounded"),
  showCover: boolean("show_cover").default(true),
  coverTitleColor: text("cover_title_color"),
  coverDescColor: text("cover_desc_color"),
  coverTitleWeight: text("cover_title_weight").default("bold"),
  coverTitleTransform: text("cover_title_transform").default("uppercase"),
  shareToken: text("share_token"),
  shareExpiresAt: timestamp("share_expires_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const pins = pgTable("pins", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sourceUrl: text("source_url"),
  imageUrl: text("image_url"),
  imagePath: text("image_path"),
  title: text("title"),
  descriptionAi: text("description_ai"),
  descriptionCustomInput: text("description_custom_input"),
  descriptionFinal: text("description_final"),
  descriptionEnabled: boolean("description_enabled").default(true),
  width: integer("width"),
  height: integer("height"),
  dominantColors: jsonb("dominant_colors").$type<string[]>(),
  tags: jsonb("tags").$type<string[]>(),
  shotType: text("shot_type"),
  note: text("note"),
  approvalStatus: text("approval_status"),
  position: integer("position").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").default("pinterest_board"),
  url: text("url"),
  status: text("status").default("queued"),
  totalItems: integer("total_items").default(0),
  importedItems: integer("imported_items").default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  pins: many(pins),
  sources: many(sources),
}));

export const pinsRelations = relations(pins, ({ one }) => ({
  project: one(projects, { fields: [pins.projectId], references: [projects.id] }),
}));

export const sourcesRelations = relations(sources, ({ one }) => ({
  project: one(projects, { fields: [sources.projectId], references: [projects.id] }),
}));

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPinSchema = createInsertSchema(pins).omit({
  id: true,
  createdAt: true,
});

export const insertSourceSchema = createInsertSchema(sources).omit({
  id: true,
  createdAt: true,
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Pin = typeof pins.$inferSelect;
export type InsertPin = z.infer<typeof insertPinSchema>;
export type Source = typeof sources.$inferSelect;
export type InsertSource = z.infer<typeof insertSourceSchema>;
