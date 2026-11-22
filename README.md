# TaxCloud Starter
Local educational demo for Excel upload, workload configuration, Redis task queue, Docker workers and Excel report download.

**Important:** Docker containers are not Xen virtual machines. This version demonstrates containerisation and distributed task processing, not Xen-based IaaS. The 10% demo rate is illustrative, not an actual tax rate.

## Requirements
Windows 11, WSL2 Ubuntu, Docker Desktop with WSL2 backend. Node.js 20+ for frontend.
Internet is required for first-time downloads.

## Start backend and workers
From this folder run `docker compose up --build`.
API: http://localhost:8000 ; docs: http://localhost:8000/docs
Stop: `docker compose down`.

## Start frontend
`cd frontend && npm install && npm run dev`
Open http://localhost:5173.

Vercel can host the frontend; the API and Docker workers need a separate reachable host for public use.

## Excel format
Sheet name: `Transactions`
Exact columns: Transaction ID, Share Name, Purchase Price, Selling Price, Quantity.
Profit = (selling price - purchase price) * quantity.
Demo tax = max(0, profit) * configured rate.

## Workflow
1 Upload Excel; 2 Configure Workload; 3 Provision & Process; 4 Results & Reports.
Four screen folders are placeholders for teammate implementation.
This is a local educational starter, not production-ready.
