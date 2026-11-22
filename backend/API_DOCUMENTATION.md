# API contract
Base URL: http://localhost:8000
- GET `/api/health`
- POST `/api/jobs/upload` – multipart field `file`, .xlsx only
- GET `/api/jobs/{job_id}` – status, batch list, progress and totals
- POST `/api/jobs/{job_id}/configure` – JSON `{"worker_count":2,"batch_size":500,"tax_rate":0.10}`
- POST `/api/jobs/{job_id}/start`
- POST `/api/jobs/{job_id}/retry` – returns failed job to step 2
- GET `/api/jobs/{job_id}/results`
- GET `/api/jobs/{job_id}/download`
Poll status every 1–2 seconds during processing. Job states: uploaded, configured, processing, completed, failed. `current_step` drives the sidebar.
