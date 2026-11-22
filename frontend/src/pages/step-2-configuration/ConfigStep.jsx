import React, { useMemo, useState } from 'react';
import {
  Server, ChevronRight, ChevronLeft, AlertCircle, RefreshCw, Loader2, Info,
} from 'lucide-react';
import { api } from '../../api';
import './ConfigStep.css';

const WORKERS = 3; // fixed for this demo (no adjustable worker count)
const PRESETS = [100, 500, 1000, 2000];
const EXAMPLE = { buy: 100, sell: 150, qty: 10 };

const fmt = (n) => Number(n).toLocaleString('en-IN');

// Spread batches over the 3 workers as evenly as possible (estimate only).
function spread(batches) {
  const base = Math.floor(batches / WORKERS);
  const extra = batches % WORKERS;
  return Array.from({ length: WORKERS }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Step 2 – Configure Workload
 * Props:
 *   job          current job object (needs job_id, total_rows, batch_size, tax_rate)
 *   onSaved(job) called with the refreshed job after the configuration is saved
 *   onBack()     go back to step 1
 */
export default function ConfigStep({ job, onSaved, onBack }) {
  const jobId = job?.job_id ?? job?.id; // status responses use `id`, upload responses use `job_id`
  const initialBatch = job?.batch_size || 500;
  const [batchSize, setBatchSize] = useState(initialBatch);
  const [rate, setRate] = useState(String(Math.round((job?.tax_rate ?? 0.1) * 10000) / 100));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const options = PRESETS.includes(initialBatch) ? PRESETS : [...PRESETS, initialBatch].sort((a, b) => a - b);

  const rateNum = rate.trim() === '' ? NaN : Number(rate);
  const rateValid = Number.isFinite(rateNum) && rateNum >= 0 && rateNum <= 100;

  const rows = job?.total_rows || 0;
  const batches = rows ? Math.ceil(rows / batchSize) : 0;
  const perWorker = useMemo(() => spread(batches), [batches]);
  const maxLoad = Math.max(1, ...perWorker);
  const workersUsed = Math.min(batches, WORKERS);

  const exProfit = (EXAMPLE.sell - EXAMPLE.buy) * EXAMPLE.qty;
  const exTax = rateValid ? Math.round(Math.max(0, exProfit) * (rateNum / 100) * 100) / 100 : null;

  async function save() {
    if (!jobId || !rateValid) return;
    setSaving(true);
    setError(null);
    try {
      await api.configure(jobId, {
        worker_count: WORKERS,
        batch_size: batchSize,
        tax_rate: Number((rateNum / 100).toFixed(6)),
      });
      const updated = await api.status(jobId);
      onSaved?.({ ...updated, job_id: jobId });
    } catch (e) {
      const offline = e instanceof TypeError;
      const msg = e.message && !e.message.includes('[object') ? e.message : 'The server rejected these settings.';
      setError(
        offline
          ? { title: 'Cannot reach the server', detail: 'The TaxCloud API did not respond. Make sure the backend is running and try again.' }
          : { title: 'Could not save configuration', detail: msg }
      );
      setSaving(false);
    }
  }

  // No file uploaded yet
  if (!jobId) {
    return (
      <section className="cs">
        <h2>Configure processing workload</h2>
        <div className="cs-empty">
          <Info size={20} />
          <b>No file uploaded yet</b>
          <p>Upload a transaction statement first, then come back to configure how it is processed.</p>
          <button className="primary" onClick={onBack}><ChevronLeft size={15} /> Go to upload</button>
        </div>
      </section>
    );
  }

  return (
    <section className="cs">
      <h2>Configure processing workload</h2>
      <p>Choose how TaxCloud splits the work into batches for the workers.</p>

      <div className="stats">
        <div><small>Transactions detected</small><b>{fmt(rows)}</b></div>
        <div><small>Estimated batches</small><b>{fmt(batches)}</b></div>
        <div><small>Workers</small><b>{WORKERS} <span className="cs-fixed">fixed</span></b></div>
      </div>

      {error && (
        <div className="cs-error" role="alert">
          <div className="cs-error-head"><AlertCircle size={16} /><b>{error.title}</b></div>
          <p>{error.detail}</p>
          <button className="cs-btn-danger" onClick={save}><RefreshCw size={13} /> Retry</button>
        </div>
      )}

      {/* Batch size */}
      <div className="cs-block">
        <div className="cs-label"><b>Records per batch</b><small>Smaller batches spread the work across more workers.</small></div>
        <div className="cs-seg" role="radiogroup" aria-label="Records per batch">
          {options.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={batchSize === n}
              className={batchSize === n ? 'on' : ''}
              onClick={() => setBatchSize(n)}
            >
              {fmt(n)}
            </button>
          ))}
        </div>
      </div>

      {/* Tax rate */}
      <div className="cs-block">
        <div className="cs-label"><b>Demo tax rate (%)</b><small>Applied to positive profit only. Losses give 0 tax.</small></div>
        <div className="cs-rate">
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className={rateValid ? '' : 'bad'}
            aria-label="Demo tax rate in percent"
          />
          <span>%</span>
        </div>
        {!rateValid && <p className="cs-field-error">Enter a number between 0 and 100.</p>}
        <p className="cs-example">
          Example: buy ₹{EXAMPLE.buy}, sell ₹{EXAMPLE.sell}, quantity {EXAMPLE.qty} → profit ₹{exProfit}
          {exTax !== null && <> → demo tax <b>₹{exTax}</b></>}
        </p>
      </div>

      {/* Distribution preview */}
      <div className="cs-block">
        <div className="cs-label"><b>How the work will be shared</b><small>Estimate only — in reality, whichever worker is free takes the next batch.</small></div>
        <div className="cs-workers">
          {perWorker.map((n, i) => (
            <div key={i} className={`cs-worker${n === 0 ? ' idle' : ''}`}>
              <div className="cs-worker-head"><Server size={14} /><b>worker-{i + 1}</b><span>{n} {n === 1 ? 'batch' : 'batches'}</span></div>
              <div className="cs-bar"><span style={{ width: `${(n / maxLoad) * 100}%` }} /></div>
            </div>
          ))}
        </div>
        <p className="cs-summary">
          {fmt(rows)} rows → <b>{fmt(batches)}</b> {batches === 1 ? 'batch' : 'batches'} of up to {fmt(batchSize)} → <b>{workersUsed}</b> of {WORKERS} workers used
        </p>
        {batches === 1 && (
          <p className="cs-tip"><Info size={13} /> Only one batch means only one worker will do any work. Pick a smaller batch size to use all {WORKERS} workers.</p>
        )}
      </div>

      <p className="hint">Illustrative calculation only; not an actual tax rate.</p>

      <div className="cs-actions">
        <button className="cs-btn-ghost" onClick={onBack} disabled={saving}><ChevronLeft size={15} /> Back</button>
        <button className="primary" disabled={saving || !rateValid} onClick={save}>
          {saving
            ? <><Loader2 size={15} className="cs-spin" /> Saving…</>
            : <>Save configuration <ChevronRight size={15} /></>}
        </button>
      </div>
    </section>
  );
}