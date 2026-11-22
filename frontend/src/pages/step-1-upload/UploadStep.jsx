import React, { useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, AlertCircle, RefreshCw,
  ChevronRight, Download, Loader2, CheckCircle2,
} from 'lucide-react';
import { api } from '../../api';
import './UploadStep.css';

const MAX_MB = 15;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const COLUMNS = ['Transaction ID', 'Share Name', 'Purchase Price', 'Selling Price', 'Quantity'];

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Checks done in the browser before anything is sent to the server.
function validateFile(file) {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return {
      title: 'Unsupported file type',
      detail: `"${file.name}" is not an Excel (.xlsx) file. Only .xlsx files can be uploaded (PDF, CSV, DOCX and others are not supported).`,
    };
  }
  if (file.size === 0) {
    return { title: 'Empty file', detail: `"${file.name}" is empty. Please choose a file that contains data.` };
  }
  if (file.size > MAX_BYTES) {
    return {
      title: 'File too large',
      detail: `"${file.name}" is ${formatSize(file.size)}. The maximum allowed size is ${MAX_MB} MB.`,
    };
  }
  return null;
}

/**
 * Step 1 – Upload Excel
 * Props:
 *   onUploaded(job)  called when the server accepts the file (job = API response)
 *   onContinue()     called when the user clicks "Continue to configuration"
 */
export default function UploadStep({ onUploaded, onContinue }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | selected | uploading | success | error
  const [error, setError] = useState(null);     // { title, detail, canRetry }
  const [result, setResult] = useState(null);
  const [dragging, setDragging] = useState(false);

  const locked = status === 'uploading' || status === 'success';

  function reset() {
    setFile(null);
    setError(null);
    setResult(null);
    setStatus('idle');
    if (inputRef.current) inputRef.current.value = ''; // lets the same file be picked again
  }

  function pickFile(f) {
    if (!f || locked) return;
    const problem = validateFile(f);
    if (problem) {
      setFile(null);
      setError({ ...problem, canRetry: false });
      setStatus('error');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setError(null);
    setFile(f);
    setStatus('selected');
  }

  async function upload() {
    if (!file) return;
    setStatus('uploading');
    setError(null);
    try {
      const job = await api.upload(file);
      setResult(job);
      setStatus('success');
      onUploaded?.(job);
    } catch (e) {
      const offline = e instanceof TypeError; // fetch could not reach the server
      setError(
        offline
          ? {
              title: 'Cannot reach the server',
              detail: 'The TaxCloud API did not respond. Make sure the backend is running (docker compose up) and try again.',
              canRetry: true,
            }
          : {
              title: 'Could not process this file',
              detail: e.message || 'The file could not be read.',
              hint: 'Check that it is a genuine Excel workbook (not a renamed PDF) with a sheet named "Transactions" and the 5 required columns.',
              canRetry: false,
            }
      );
      setStatus('error');
    }
  }

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  return (
    <section className="us">
      <h2>Upload transaction statement</h2>
      <p>Use the fixed TaxCloud Excel template (.xlsx).</p>

      <div className="us-notice">
        <FileSpreadsheet size={15} />
        <span><b>Upload Excel files only (.xlsx).</b> No other file type can be uploaded. Maximum size {MAX_MB} MB.</span>
      </div>

      {/* Error box */}
      {status === 'error' && error && (
        <div className="us-error" role="alert">
          <div className="us-error-head"><AlertCircle size={16} /><b>{error.title}</b></div>
          <p>{error.detail}</p>
          {error.hint && <p className="us-error-hint">{error.hint}</p>}
          <div className="us-error-actions">
            {error.canRetry && file && (
              <button className="us-btn-danger" onClick={upload}><RefreshCw size={13} /> Retry upload</button>
            )}
            <button className="us-btn-ghost" onClick={reset}>Choose another file</button>
          </div>
        </div>
      )}

      {/* Drop zone */}
      {status !== 'success' && (
        <div
          className={`drop us-drop${dragging ? ' dragging' : ''}${file ? ' has-file' : ''}${locked ? ' locked' : ''}`}
          role="button"
          tabIndex={locked ? -1 : 0}
          aria-label="Choose an Excel file"
          onClick={() => !locked && inputRef.current?.click()}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !locked) { e.preventDefault(); inputRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); if (!locked) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          {file ? (
            <>
              <FileSpreadsheet size={26} />
              <b>{file.name}</b>
              <small>{formatSize(file.size)} · click or drop to replace</small>
            </>
          ) : (
            <>
              <Upload size={26} />
              <b>Choose an Excel file</b>
              <small>or drag and drop an .xlsx workbook here</small>
            </>
          )}
        </div>
      )}

      {/* Success summary */}
      {status === 'success' && result && (
        <div className="us-success">
          <div className="us-success-head"><CheckCircle2 size={17} /><b>File validated successfully</b></div>
          <div className="stats">
            <div><small>File name</small><b className="us-filename" title={result.filename}>{result.filename}</b></div>
            <div><small>Transactions detected</small><b>{Number(result.total_rows).toLocaleString('en-IN')}</b></div>
          </div>
        </div>
      )}

      {/* Required format + template */}
      <div className="us-format">
        <div className="us-format-head">
          <b>Required format</b>
          <a href="/transactions_template.xlsx" download className="us-link"><Download size={13} /> Download template</a>
        </div>
        <p>Sheet name: <code>Transactions</code> · 5 fixed columns, in a single header row:</p>
        <div className="us-chips">
          {COLUMNS.map((c) => <span key={c}>{c}</span>)}
        </div>
      </div>

      {/* Actions */}
      <div className="us-actions">
        {status === 'success' ? (
          <>
            <button className="primary" onClick={onContinue}>Continue to configuration <ChevronRight size={15} /></button>
            <button className="us-btn-ghost" onClick={reset}>Upload a different file</button>
          </>
        ) : (
          <button className="primary" disabled={!file || status === 'uploading'} onClick={upload}>
            {status === 'uploading'
              ? <><Loader2 size={15} className="us-spin" /> Uploading and validating…</>
              : <>Upload and validate <ChevronRight size={15} /></>}
          </button>
        )}
      </div>
    </section>
  );
}