import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PRIORITIES, SERVICE_CATEGORIES, type Brief } from '../../shared/brief';
import { api } from '../api';
import { AiStatusMark, PIPELINE_LABELS, PriorityMark, formatDateTime } from '../components/labels';

const POLL_MS = 3000;

export function Dashboard() {
  const [params, setParams] = useSearchParams();
  const priority = params.get('priority') ?? '';
  const category = params.get('category') ?? '';
  const [briefs, setBriefs] = useState<Brief[] | null>(null);
  const [error, setError] = useState('');

  const waitingForAi = briefs?.some((b) => b.ai_status === 'pending' || b.ai_status === 'processing') ?? false;

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams();
    if (priority) query.set('priority', priority);
    if (category) query.set('category', category);
    const load = () =>
      api<Brief[]>(`/admin/briefs?${query}`)
        .then((data) => !cancelled && (setBriefs(data), setError('')))
        .catch((err) => !cancelled && setError(err.message));
    load();
    // Keep the list fresh while the AI is still working on something.
    const timer = waitingForAi ? setInterval(load, POLL_MS) : undefined;
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [priority, category, waitingForAi]);

  function setFilter(key: 'priority' | 'category', value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Brief masuk</h1>
        {briefs && <span className="mono muted">{briefs.length} brief</span>}
      </div>

      <div className="filters">
        <FilterGroup label="Prioritas" options={PRIORITIES} value={priority} onChange={(v) => setFilter('priority', v)} />
        <FilterGroup label="Kategori" options={SERVICE_CATEGORIES} value={category} onChange={(v) => setFilter('category', v)} />
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {!briefs && !error && <p className="muted">Memuat…</p>}
      {briefs?.length === 0 && (
        <p className="empty">
          {priority || category ? 'Tidak ada brief yang cocok dengan filter ini.' : 'Belum ada brief. Bagikan form di halaman depan ke calon klien.'}
        </p>
      )}

      {briefs && briefs.length > 0 && (
        <table className="brief-table">
          <thead>
            <tr>
              <th scope="col">Perusahaan</th>
              <th scope="col">Kategori</th>
              <th scope="col">Prioritas</th>
              <th scope="col">AI</th>
              <th scope="col">Pipeline</th>
              <th scope="col">Masuk</th>
            </tr>
          </thead>
          <tbody>
            {briefs.map((b) => (
              <tr key={b.id}>
                <td data-label="Perusahaan">
                  <Link to={`/admin/briefs/${b.id}`} className="row-link">{b.company}</Link>
                  <span className="muted small">{b.name}</span>
                </td>
                <td data-label="Kategori">{b.ai_result?.service_category ?? <span className="muted">—</span>}</td>
                <td data-label="Prioritas"><PriorityMark priority={b.ai_result?.priority} /></td>
                <td data-label="AI"><AiStatusMark status={b.ai_status} /></td>
                <td data-label="Pipeline"><span className={`pipeline pipeline-${b.pipeline_status}`}>{PIPELINE_LABELS[b.pipeline_status]}</span></td>
                <td data-label="Masuk" className="mono">{formatDateTime(b.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function FilterGroup(props: { label: string; options: readonly string[]; value: string; onChange: (value: string) => void }) {
  return (
    <fieldset className="filter-group">
      <legend>{props.label}</legend>
      {['', ...props.options].map((option) => (
        <label key={option || 'all'} className="chip chip-small">
          <input type="radio" name={props.label} checked={props.value === option} onChange={() => props.onChange(option)} />
          <span>{option || 'Semua'}</span>
        </label>
      ))}
    </fieldset>
  );
}
