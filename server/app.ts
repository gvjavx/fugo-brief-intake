import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';
import {
  PIPELINE_STATUSES,
  PRIORITIES,
  SERVICE_CATEGORIES,
  briefInputSchema,
} from '../shared/brief.js';
import {
  SESSION_COOKIE,
  checkAdminCredentials,
  createSessionToken,
  readSession,
  requireAdmin,
  sessionCookieOptions,
} from './auth.js';
import {
  claimForProcessing,
  createBrief,
  getBrief,
  listBriefs,
  processBrief,
  updatePipelineStatus,
} from './briefs.js';

export const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors;
}

/** Starts AI processing without making the caller wait. On Vercel, waitUntil keeps the function alive until it finishes. */
async function startProcessing(id: number) {
  if (await claimForProcessing(id)) waitUntil(processBrief(id));
}

const idParam = z.coerce.number().int().positive();

// Public

app.post('/api/briefs', async (req, res) => {
  const parsed = briefInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Data brief belum valid', fields: fieldErrors(parsed.error) });
    return;
  }
  const brief = await createBrief(parsed.data);
  await startProcessing(brief.id);
  res.status(201).json({ id: brief.id });
});

// Auth

const loginSchema = z.object({ email: z.string(), password: z.string() });

app.post('/api/auth/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success || !checkAdminCredentials(parsed.data.email, parsed.data.password)) {
    res.status(401).json({ error: 'Email atau password salah' });
    return;
  }
  res.cookie(SESSION_COOKIE, createSessionToken(parsed.data.email), sessionCookieOptions());
  res.json({ email: parsed.data.email });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: undefined });
  res.status(204).end();
});

app.get('/api/auth/me', (req, res) => {
  const email = readSession(req);
  if (!email) {
    res.status(401).json({ error: 'Belum login' });
    return;
  }
  res.json({ email });
});

// Admin

const admin = express.Router();
admin.use(requireAdmin);

const listQuerySchema = z.object({
  priority: z.enum(PRIORITIES).optional(),
  category: z.enum(SERVICE_CATEGORIES).optional(),
});

admin.get('/briefs', async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Filter tidak valid', fields: fieldErrors(parsed.error) });
    return;
  }
  res.json(await listBriefs(parsed.data));
});

admin.get('/briefs/:id', async (req, res) => {
  const id = idParam.safeParse(req.params.id);
  const brief = id.success ? await getBrief(id.data) : undefined;
  if (!brief) {
    res.status(404).json({ error: 'Brief tidak ditemukan' });
    return;
  }
  res.json(brief);
});

const statusSchema = z.object({ pipeline_status: z.enum(PIPELINE_STATUSES) });

admin.patch('/briefs/:id/status', async (req, res) => {
  const id = idParam.safeParse(req.params.id);
  const body = statusSchema.safeParse(req.body);
  if (!id.success || !body.success) {
    res.status(400).json({ error: 'Status tidak valid' });
    return;
  }
  const brief = await updatePipelineStatus(id.data, body.data.pipeline_status);
  if (!brief) {
    res.status(404).json({ error: 'Brief tidak ditemukan' });
    return;
  }
  res.json(brief);
});

admin.post('/briefs/:id/reprocess', async (req, res) => {
  const id = idParam.safeParse(req.params.id);
  if (!id.success || !(await getBrief(id.data))) {
    res.status(404).json({ error: 'Brief tidak ditemukan' });
    return;
  }
  if (!(await claimForProcessing(id.data))) {
    res.status(409).json({ error: 'Brief ini sedang diproses AI' });
    return;
  }
  waitUntil(processBrief(id.data));
  res.status(202).json({ ai_status: 'processing' });
});

app.use('/api/admin', admin);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan di server. Coba lagi sebentar.' });
});
