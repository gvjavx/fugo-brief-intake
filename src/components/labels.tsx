import type { AiStatus, PipelineStatus } from '../../shared/brief';

export const PIPELINE_LABELS: Record<PipelineStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  proposal: 'Proposal',
  won: 'Won',
  lost: 'Lost',
};

const AI_STATUS_LABELS: Record<AiStatus, string> = {
  pending: 'Menunggu',
  processing: 'Diproses',
  done: 'Selesai',
  failed: 'Gagal',
};

const PRIORITY_DOTS = { High: '●●●', Medium: '●●○', Low: '●○○' } as const;

// Dots plus the word, so priority does not depend on colour alone.
export function PriorityMark({ priority }: { priority: string | undefined }) {
  if (!priority || !(priority in PRIORITY_DOTS)) return <span className="muted">—</span>;
  return (
    <span className={`priority priority-${priority.toLowerCase()}`}>
      <span aria-hidden="true">{PRIORITY_DOTS[priority as keyof typeof PRIORITY_DOTS]}</span> {priority}
    </span>
  );
}

export function AiStatusMark({ status }: { status: AiStatus }) {
  return <span className={`ai-status ai-${status}`}>{AI_STATUS_LABELS[status]}</span>;
}

const dateFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
const dateTimeFormat = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
});

/** 'YYYY-MM-DD' (a calendar date, no timezone) → "31 Des 2026". */
export function formatDate(isoDate: string) {
  return dateFormat.format(new Date(`${isoDate}T00:00:00+07:00`));
}

export function formatDateTime(timestamp: string) {
  return dateTimeFormat.format(new Date(timestamp));
}
