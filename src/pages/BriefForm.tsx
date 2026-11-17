import { cloneElement, useState, type FormEvent, type InputHTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { z } from 'zod';
import { BUDGET_RANGES, briefInputSchema, todayInJakarta, type BriefInput } from '../../shared/brief';
import { api, ApiError } from '../api';
import { formatDate } from '../components/labels';

type FieldErrors = Partial<Record<keyof BriefInput, string[]>>;

const EMPTY: Record<keyof BriefInput, string> = { name: '', email: '', company: '', needs: '', budget: '', timeline: '' };

export function BriefForm() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<BriefInput | null>(null);

  const set = (field: keyof BriefInput) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    const parsed = briefInputSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(z.flattenError(parsed.error).fieldErrors);
      // Move focus to the first invalid field once React has rendered the errors.
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setSubmitting(true);
    try {
      await api('/briefs', { method: 'POST', body: parsed.data });
      setSent(parsed.data);
      window.scrollTo(0, 0);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      else setFormError(err instanceof Error ? err.message : 'Brief gagal dikirim. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) return <Sent brief={sent} onAnother={() => { setValues(EMPTY); setSent(null); }} />;

  return (
    <div className="sheet-page">
      <article className="sheet">
        <SheetHeader />
        <h1 className="sheet-title">Ceritakan proyek Anda.</h1>
        <p className="sheet-lede">
          Isi lembar ini sekali, tim kami membaca semuanya. Kami akan membalas lewat email untuk membahas langkah berikutnya.
        </p>

        <form onSubmit={submit} noValidate>
          <Section number="01" title="Tentang Anda">
            <Field id="name" label="Nama" error={errors.name}>
              <input id="name" autoComplete="name" value={values.name} onChange={(e) => set('name')(e.target.value)} />
            </Field>
            <Field id="email" label="Email" error={errors.email}>
              <input id="email" type="email" autoComplete="email" value={values.email} onChange={(e) => set('email')(e.target.value)} />
            </Field>
            <Field id="company" label="Nama perusahaan" error={errors.company}>
              <input id="company" autoComplete="organization" value={values.company} onChange={(e) => set('company')(e.target.value)} />
            </Field>
          </Section>

          <Section number="02" title="Kebutuhan">
            <Field id="needs" label="Apa yang ingin Anda buat?" hint="Tujuan, ruang lingkup, contoh referensi. Semakin jelas, semakin cepat kami bisa memberi penawaran." error={errors.needs}>
              <textarea id="needs" rows={6} value={values.needs} onChange={(e) => set('needs')(e.target.value)} />
            </Field>
          </Section>

          <Section number="03" title="Budget & waktu">
            <fieldset className="field" aria-describedby={errors.budget ? 'budget-error' : undefined}>
              <legend className="field-label">Perkiraan budget</legend>
              <div className="chips">
                {BUDGET_RANGES.map((range) => (
                  <label key={range} className="chip">
                    <input type="radio" name="budget" value={range} checked={values.budget === range} onChange={() => set('budget')(range)} />
                    <span>{range}</span>
                  </label>
                ))}
              </div>
              {errors.budget && <p id="budget-error" className="field-error">{errors.budget[0]}</p>}
            </fieldset>
            <Field id="timeline" label="Target selesai" error={errors.timeline}>
              <input id="timeline" type="date" min={todayInJakarta()} value={values.timeline} onChange={(e) => set('timeline')(e.target.value)} />
            </Field>
          </Section>

          {formError && <p className="form-error" role="alert">{formError}</p>}

          <div className="sheet-actions">
            <button type="submit" className="button-primary" disabled={submitting}>
              {submitting ? 'Mengirim…' : 'Kirim brief'}
            </button>
          </div>
        </form>
      </article>
    </div>
  );
}

function SheetHeader() {
  return (
    <header className="sheet-header">
      <span className="wordmark">Fugo Creative</span>
      <span className="mono muted">Brief Proyek</span>
    </header>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <section className="sheet-section">
      <div className="sheet-section-head">
        <span className="sheet-number" aria-hidden="true">{number}</span>
        <h2>{title}</h2>
      </div>
      <div className="sheet-section-body">{children}</div>
    </section>
  );
}

function Field(props: { id: string; label: string; hint?: string; error?: string[]; children: ReactElement<InputHTMLAttributes<HTMLElement>> }) {
  const describedBy = [props.hint && `${props.id}-hint`, props.error && `${props.id}-error`].filter(Boolean).join(' ');
  return (
    <div className="field">
      <label className="field-label" htmlFor={props.id}>{props.label}</label>
      {props.hint && <p id={`${props.id}-hint`} className="field-hint">{props.hint}</p>}
      {cloneElement(props.children, {
        'aria-invalid': props.error ? true : undefined,
        'aria-describedby': describedBy || undefined,
      })}
      {props.error && <p id={`${props.id}-error`} className="field-error">{props.error[0]}</p>}
    </div>
  );
}

function Sent({ brief, onAnother }: { brief: BriefInput; onAnother: () => void }) {
  return (
    <div className="sheet-page">
      <article className="sheet" aria-live="polite">
        <SheetHeader />
        <p className="stamp">Diterima</p>
        <h1 className="sheet-title">Terima kasih, {brief.name}.</h1>
        <p className="sheet-lede">
          Brief untuk <strong>{brief.company}</strong> sudah masuk ke tim sales kami. Balasan akan dikirim ke <strong>{brief.email}</strong>.
        </p>
        <dl className="recap">
          <dt>Budget</dt>
          <dd>{brief.budget}</dd>
          <dt>Target selesai</dt>
          <dd>{formatDate(brief.timeline)}</dd>
          <dt>Kebutuhan</dt>
          <dd className="prewrap">{brief.needs}</dd>
        </dl>
        <button type="button" className="link-button" onClick={onAnother}>
          Kirim brief lain
        </button>
      </article>
    </div>
  );
}
