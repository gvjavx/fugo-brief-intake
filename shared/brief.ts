import { z } from 'zod';

// Shared by the form (instant feedback) and the API (the check that counts).

export const BUDGET_RANGES = [
  '< Rp10 juta',
  'Rp10-25 juta',
  'Rp25-50 juta',
  'Rp50-100 juta',
  '> Rp100 juta',
] as const;

export const SERVICE_CATEGORIES = [
  'Branding',
  'Website',
  'Mobile App',
  'AI Automation',
  'Social Media',
  'Lainnya',
] as const;

export const PRIORITIES = ['High', 'Medium', 'Low'] as const;

export const PIPELINE_STATUSES = ['new', 'contacted', 'proposal', 'won', 'lost'] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export const AI_STATUSES = ['pending', 'processing', 'done', 'failed'] as const;
export type AiStatus = (typeof AI_STATUSES)[number];

/** Today's date in WIB as YYYY-MM-DD, so "not in the past" means the same thing on server and client. */
export function todayInJakarta(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
}

export const briefInputSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(120),
  email: z.string().trim().toLowerCase().pipe(z.email('Format email tidak valid')),
  company: z.string().trim().min(1, 'Nama perusahaan wajib diisi').max(160),
  needs: z.string().trim().min(10, 'Ceritakan kebutuhan minimal 10 karakter').max(5000),
  budget: z.enum(BUDGET_RANGES, 'Pilih salah satu rentang budget'),
  timeline: z.iso
    .date('Tanggal tidak valid')
    .refine((d) => d >= todayInJakarta(), 'Tanggal tidak boleh di masa lalu'),
});
export type BriefInput = z.infer<typeof briefInputSchema>;

export const aiResultSchema = z.object({
  summary: z.string().trim().min(1),
  service_category: z.enum(SERVICE_CATEGORIES),
  priority: z.enum(PRIORITIES),
  priority_reason: z.string().trim().min(1),
  missing_info: z.array(z.string().trim().min(1)),
  reply_draft: z.string().trim().min(1),
});
export type AiResult = z.infer<typeof aiResultSchema>;

export interface Brief extends BriefInput {
  id: number;
  pipeline_status: PipelineStatus;
  ai_status: AiStatus;
  ai_result: AiResult | null;
  ai_error: string | null;
  ai_attempts: number;
  ai_model: string | null;
  created_at: string;
}
