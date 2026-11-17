import { pool } from './db.js';
import { AI_MODEL, analyzeBrief } from './ai.js';
import { todayInJakarta, type Brief, type BriefInput, type PipelineStatus } from '../shared/brief.js';

const COLUMNS = `id, name, email, company, needs, budget, timeline, pipeline_status,
  ai_status, ai_result, ai_error, ai_attempts, ai_model, created_at`;

export async function createBrief(input: BriefInput): Promise<Brief> {
  const { rows } = await pool.query<Brief>(
    `INSERT INTO briefs (name, email, company, needs, budget, timeline)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
    [input.name, input.email, input.company, input.needs, input.budget, input.timeline],
  );
  return rows[0];
}

export interface BriefFilters {
  priority?: string;
  category?: string;
}

export async function listBriefs({ priority, category }: BriefFilters): Promise<Brief[]> {
  const { rows } = await pool.query<Brief>(
    `SELECT ${COLUMNS} FROM briefs
     WHERE ($1::text IS NULL OR priority = $1)
       AND ($2::text IS NULL OR service_category = $2)
     ORDER BY created_at DESC, id DESC
     LIMIT 200`,
    [priority ?? null, category ?? null],
  );
  return rows;
}

export async function getBrief(id: number): Promise<Brief | undefined> {
  const { rows } = await pool.query<Brief>(`SELECT ${COLUMNS} FROM briefs WHERE id = $1`, [id]);
  return rows[0];
}

export async function updatePipelineStatus(id: number, status: PipelineStatus): Promise<Brief | undefined> {
  const { rows } = await pool.query<Brief>(
    `UPDATE briefs SET pipeline_status = $2, updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, status],
  );
  return rows[0];
}

/**
 * Claims the brief for AI processing. Returns false when another run already holds it.
 * A claim older than 2 minutes counts as abandoned (e.g. the serverless function was killed),
 * so a stuck brief can always be retried from the dashboard.
 */
export async function claimForProcessing(id: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE briefs
     SET ai_status = 'processing', ai_error = NULL, ai_attempts = ai_attempts + 1, updated_at = now()
     WHERE id = $1
       AND (ai_status <> 'processing' OR updated_at < now() - interval '2 minutes')`,
    [id],
  );
  return rowCount === 1;
}

/** Runs the LLM for an already-claimed brief and stores the outcome. Never throws. */
export async function processBrief(id: number): Promise<void> {
  try {
    const brief = await getBrief(id);
    if (!brief) return;
    const result = await analyzeBrief(brief, todayInJakarta());
    await pool.query(
      `UPDATE briefs SET ai_status = 'done', ai_result = $2, ai_model = $3, updated_at = now() WHERE id = $1`,
      [id, result, AI_MODEL],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`AI processing failed for brief ${id}:`, message);
    await pool
      .query(
        `UPDATE briefs SET ai_status = 'failed', ai_error = $2, ai_model = $3, updated_at = now() WHERE id = $1`,
        [id, message.slice(0, 500), AI_MODEL],
      )
      .catch((dbErr) => console.error(`Could not mark brief ${id} as failed:`, dbErr));
  }
}
