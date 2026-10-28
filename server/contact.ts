import type { Express, RequestHandler } from "express";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { pool } from "./db";
import { authRateLimit } from "./auth";

const contactSchema = z.object({
  requestId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(10).max(10000),
}).strict();
type ContactMessage = z.infer<typeof contactSchema>;

export async function initializeContactSchema(): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS contact_messages (
    id uuid PRIMARY KEY,
    payload_hash varchar(64) NOT NULL,
    name varchar(120) NOT NULL,
    email varchar(254) NOT NULL,
    subject varchar(200) NOT NULL,
    message text NOT NULL,
    status varchar(16) NOT NULL DEFAULT 'new',
    created_at timestamptz NOT NULL DEFAULT now()
  ); CREATE INDEX IF NOT EXISTS contact_messages_created_idx ON contact_messages(created_at DESC)`);
}

export async function saveContactMessage(message: ContactMessage): Promise<{ id: string }> {
  const { requestId = randomUUID(), ...payload } = message;
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const { rows } = await pool.query(`INSERT INTO contact_messages(id,payload_hash,name,email,subject,message)
    VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(id) DO UPDATE SET id=contact_messages.id
    WHERE contact_messages.payload_hash=EXCLUDED.payload_hash
    RETURNING id`, [requestId, hash, payload.name, payload.email, payload.subject, payload.message]);
  if (!rows[0]) throw Object.assign(new Error("This reference belongs to another message. Please submit a new message."), { status: 409 });
  return rows[0];
}

/** Messages are acknowledged only after durable storage; inbox access needs the admin guard. */
export function registerContactRoutes(
  app: Express,
  adminGuard?: RequestHandler,
  dependencies: { save?: typeof saveContactMessage; rateLimit?: RequestHandler } = {},
): void {
  const save = dependencies.save || saveContactMessage;
  app.post("/api/contact", dependencies.rateLimit || authRateLimit("contact", 5), async (req, res) => {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ message: "Enter a name, valid email, subject, and message of 10 to 10,000 characters." });
    try {
      const { id } = await save(parsed.data);
      res.status(202).json({ received: true, reference: id, message: "Your message has been received and saved." });
    } catch (error: any) {
      if (error?.status === 409) return void res.status(409).json({ message: error.message });
      console.error("Contact message storage failed");
      res.status(503).json({ message: "Your message could not be saved. Your text has been kept so you can try again." });
    }
  });
  if (adminGuard) app.get("/api/admin/contact-messages", adminGuard, async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
      const { rows } = await pool.query("SELECT id,name,email,subject,message,status,created_at AS \"createdAt\" FROM contact_messages ORDER BY created_at DESC LIMIT $1", [limit]);
      res.json({ messages: rows });
    } catch {
      res.status(503).json({ message: "The support inbox is unavailable. Please try again." });
    }
  });
}
