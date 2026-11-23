import React from 'react';
import { Download, RotateCcw, Activity } from 'lucide-react';
import { api } from '../../api';
import './ResultsStep.css';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

/**
 * Step 4 – Results & Reports
 * Props:
 *   job         current job (needs job_id, status, processed_rows, total_profit, total_demo_tax)
 *   onGoStep(i) jump to a step (0-based)
 *   onReset()   clear the job and go back to Step 1
 */
export default function ResultsStep({ job, onGoStep, onReset }) {
  if (!job || job.status !== 'completed') {
    return (
      <section>
        <h2>Consolidated results</h2>
        <div className="notready">
          <Activity />
          <h3>Results are not ready yet</h3>
          <p>
            {job
              ? 'This job has not completed. Finish processing in Step 3 to see the summary and download the report.'
              : 'No job found. Upload a file in Step 1 to get started.'}
          </p>
          <button className="primary" onClick={() => onGoStep(job ? 2 : 0)}>
            {job ? 'Go to Step 3' : 'Go to Step 1'}
          </button>
        </div>
      </section>
    );
  }

  const profit = Number(job.total_profit || 0);
  const perWorker = {};
  (job.batches || []).forEach((b) => { if (b.worker_name) perWorker[b.worker_name] = (perWorker[b.worker_name] || 0) + 1; });

  return (
    <section>
      <h2>Consolidated results</h2>
      <p>Review the completed financial workload.</p>

      <div className="stats">
        <div><small>Transactions</small><b>{Number(job.processed_rows || 0).toLocaleString('en-IN')}</b></div>
        <div><small>Total profit / loss</small><b className={profit < 0 ? 'loss' : 'gain'}>{inr(profit)}</b></div>
        <div><small>Total demo tax</small><b>{inr(job.total_demo_tax)}</b></div>
      </div>

      {Object.keys(perWorker).length > 0 && (
        <p className="hint">
          Work was shared across workers:{' '}
          {Object.entries(perWorker).sort().map(([w, n]) => `${w}: ${n} batch${n === 1 ? '' : 'es'}`).join(' · ')}
        </p>
      )}

      <a className="primary" href={api.download(job.job_id)} download>
        <Download size={14} /> Download processed Excel
      </a>
      <button className="primary ghost" onClick={onReset}><RotateCcw size={14} /> Process another file</button>
    </section>
  );
}
