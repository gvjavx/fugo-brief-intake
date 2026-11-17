import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PIPELINE_STATUSES, type Brief, type PipelineStatus } from '../../shared/brief';
import { api } from '../api';
import { AiStatusMark, PIPELINE_LABELS, PriorityMark, formatDate, formatDateTime } from '../components/labels';

const POLL_MS = 2000;

export function BriefDetail() {
  const { id } = useParams();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  const load = useCallback(
    () =>
      api<Brief>(`/admin/briefs/${id}`)
        .then(setBrief)
        .catch((err) => setError(err.message)),
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  const aiBusy = brief?.ai_status === 'pending' || brief?.ai_status === 'processing';
  useEffect(() => {
    if (!aiBusy) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [aiBusy, load]);

  async function reprocess() {
    setActionError('');
    try {
      await api(`/admin/briefs/${id}/reprocess`, { method: 'POST' });
      setBrief((b) => b && { ...b, ai_status: 'processing', ai_error: null });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal memulai proses ulang');
    }
  }

  async function changeStatus(status: PipelineStatus) {
    setActionError('');
    setSavingStatus(true);
    try {
      setBrief(await api<Brief>(`/admin/briefs/${id}/status`, { method: 'PATCH', body: { pipeline_status: status } }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Status gagal disimpan');
    } finally {
      setSavingStatus(false);
    }
  }

  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (!brief) return <p className="muted">Memuat…</p>;

  return (
    <>
      <Link to="/admin" className="back-link">← Semua brief</Link>
      <div className="page-head">
        <h1>{brief.company}</h1>
        <span className="mono muted">#{brief.id} · masuk {formatDateTime(brief.created_at)}</span>
      </div>

      <fieldset className="pipeline-steps" disabled={savingStatus}>
        <legend>Status pipeline</legend>
        {PIPELINE_STATUSES.map((status) => (
          <label key={status} className={`step step-${status}`}>
            <input type="radio" name="pipeline" checked={brief.pipeline_status === status} onChange={() => changeStatus(status)} />
            <span>{PIPELINE_LABELS[status]}</span>
          </label>
        ))}
      </fieldset>
      {actionError && <p className="form-error" role="alert">{actionError}</p>}

      <div className="detail-grid">
        <section className="panel">
          <h2 className="panel-title">Brief dari klien</h2>
          <dl className="recap">
            <dt>Nama</dt>
            <dd>{brief.name}</dd>
            <dt>Email</dt>
            <dd><a href={`mailto:${brief.email}`}>{brief.email}</a></dd>
            <dt>Budget</dt>
            <dd>{brief.budget}</dd>
            <dt>Target selesai</dt>
            <dd>{formatDate(brief.timeline)}</dd>
            <dt>Kebutuhan</dt>
            <dd className="prewrap">{brief.needs}</dd>
          </dl>
        </section>

        <section className="panel panel-ai" aria-live="polite">
          <div className="panel-title-row">
            <h2 className="panel-title">Analisis AI</h2>
            <AiStatusMark status={brief.ai_status} />
          </div>
          <AiPanel brief={brief} />
          <div className="ai-footer">
            <span className="mono muted small">
              {brief.ai_model ?? 'model belum dipanggil'} · percobaan {brief.ai_attempts}
            </span>
            <button type="button" className="button-secondary" onClick={reprocess} disabled={aiBusy}>
              {aiBusy ? 'Sedang diproses…' : 'Proses ulang AI'}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

function AiPanel({ brief }: { brief: Brief }) {
  const result = brief.ai_result;

  if (brief.ai_status === 'failed') {
    return (
      <div className="ai-failed-box">
        <p><strong>Analisis gagal.</strong> Brief tetap tersimpan. Coba proses ulang.</p>
        {brief.ai_error && <p className="mono small">{brief.ai_error}</p>}
      </div>
    );
  }
  if (!result) return <p className="muted">AI sedang membaca brief ini. Halaman akan diperbarui otomatis.</p>;

  return (
    <>
      <p className="ai-summary">{result.summary}</p>
      <dl className="recap">
        <dt>Kategori</dt>
        <dd>{result.service_category}</dd>
        <dt>Prioritas</dt>
        <dd>
          <PriorityMark priority={result.priority} />
          <span className="priority-reason">{result.priority_reason}</span>
        </dd>
      </dl>

      <h3 className="sub-title">Tanyakan ke klien</h3>
      {result.missing_info.length ? (
        <ul className="ask-list">
          {result.missing_info.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="muted">Brief sudah cukup lengkap.</p>
      )}

      <ReplyDraft text={result.reply_draft} />
    </>
  );
}

function ReplyDraft({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="reply-draft">
      <div className="panel-title-row">
        <h3 className="sub-title">Draft balasan</h3>
        <button type="button" className="link-button" onClick={copy}>
          {copied ? 'Tersalin' : 'Salin teks'}
        </button>
      </div>
      <pre>{text}</pre>
    </div>
  );
}
