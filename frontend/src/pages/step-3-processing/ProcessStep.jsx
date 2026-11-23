import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, AlertCircle, RefreshCw, Loader2, Cpu, Clock } from 'lucide-react';
import { api } from '../../api';
import './ProcessStep.css';

const POLL_MS = 1500;          // poll interval while processing
const STUCK_MS = 30000;        // no progress for 30s => warn (queue has no acknowledgements)
const WORKER_NAMES = ['worker-1', 'worker-2', 'worker-3'];

/**
 * Step 3 – Provision & Process
 * Props:
 *   job         current job (from api.status, always contains job_id)
 *   onJob(job)  store the refreshed job in App state
 *   onGoStep(i) jump to a step (0-based)
 *   onRetry()   call /retry and return to Step 2
 */
export default function ProcessStep({ job, onJob, onGoStep, onRetry }) {
  const jobId = job?.job_id ?? job?.id;
  const status = job?.status;
  const [workers, setWorkers] = useState(null);   // null = worker-status API unavailable
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stuck, setStuck] = useState(false);
  const last = useRef({ done: -1, at: Date.now() });

  // Poll status (+ worker status) every 1.5s while processing; stop on completed/failed.
  useEffect(() => {
    if (!jobId) return undefined;
    let stop = false;
    const tick = async () => {
      try {
        const [j, w] = await Promise.all([api.status(jobId), api.workers().catch(() => null)]);
        if (stop) return;
        onJob(j);
        setWorkers(w ? w.workers : null);
        setError('');
        if (j.completed_batches !== last.current.done) {
          last.current = { done: j.completed_batches, at: Date.now() };
          setStuck(false);
        } else if (j.status === 'processing' && Date.now() - last.current.at > STUCK_MS) {
          setStuck(true);
        }
      } catch (e) {
        if (!stop) setError(e.message);
      }
    };
    tick();                                   // one fetch on open / on status change
    if (status !== 'processing') return () => { stop = true; };
    const t = setInterval(tick, POLL_MS);
    return () => { stop = true; clearInterval(t); };
  }, [jobId, status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setBusy(true); setError('');
    try {
      await api.start(jobId);
      last.current = { done: -1, at: Date.now() };
      setStuck(false);
      onJob(await api.status(jobId));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  const total = job?.total_batches ?? 0;
  const done = job?.completed_batches ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const batches = job?.batches ?? [];
  const handled = (name) => batches.filter((b) => b.worker_name === name).length;
  const isProcessing = status === 'processing';
  const isDone = status === 'completed';
  const workerState = (name) => workers?.find((w) => w.name === name)?.status ?? 'unknown';

  return (
    <section>
      <h2>Processing overview</h2>
      <p>Monitor batches handled by Docker workers.</p>

      <button className="primary" disabled={!job || busy || isProcessing || isDone} onClick={start}>
        {isProcessing || busy ? <><Loader2 size={14} className="spin" /> Processing…</> : isDone ? 'Completed' : <>Start processing <ChevronRight /></>}
      </button>
      {isDone && <button className="primary ghost" onClick={() => onGoStep(3)}>View results <ChevronRight /></button>}

      {error && <div className="error step3-error">Connection problem: {error} (still trying)</div>}

      {status === 'failed' && (
        <div className="failbox">
          <b><AlertCircle size={15} /> Processing failed</b>
          <p>{job.error || 'A worker reported an error.'}</p>
          <button className="primary" onClick={onRetry}><RefreshCw size={14} /> Return to Step 2</button>
        </div>
      )}

      {stuck && isProcessing && (
        <div className="warnbox">
          <Clock size={14} /> No progress for 30+ seconds. A worker may have crashed while holding a batch
          (the queue has no acknowledgements), so it can stay “queued” forever. Check the worker containers
          and, if needed, go back to Step 2 and run the job again.
        </div>
      )}

      <div className="stats">
        <div><small>Completed batches</small><b>{done}/{total}</b></div>
        <div><small>Records processed</small><b>{job?.processed_rows ?? 0}{job?.total_rows ? ` / ${job.total_rows}` : ''}</b></div>
        <div><small>Failed batches</small><b>{job?.failed_batches ?? 0}</b></div>
      </div>

      <div className="progress"><b>Overall progress</b><b>{pct}%</b><div><span style={{ width: pct + '%' }} /></div></div>

      <h3 className="sub">Workers</h3>
      <div className="workers">
        {WORKER_NAMES.map((n) => {
          const s = workerState(n);
          return (
            <div key={n} className={`worker ${s}`}>
              <Cpu size={16} />
              <b>{n}</b>
              <span className="wstate">{s === 'unknown' ? 'status unavailable' : s}</span>
              <small>{handled(n)} batch{handled(n) === 1 ? '' : 'es'} handled</small>
            </div>
          );
        })}
      </div>

      <h3 className="sub">Batches</h3>
      <div className="batches batchlist">
        {batches.length === 0 && <div>No batches yet — press Start processing.</div>}
        {batches.map((b) => (
          <div key={b.batch_number}>
            Batch {b.batch_number}
            <span>{b.worker_name || 'Waiting for a worker'}</span>
            <b className={`bstatus ${b.status}`}>{b.status}</b>
          </div>
        ))}
      </div>
    </section>
  );
}
