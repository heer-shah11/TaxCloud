from uuid import uuid4
from fastapi import FastAPI,UploadFile,File,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from .config import DATA_DIR
from .db import init,db
from .schemas import Configure
from .logic import read_excel,create_job,get_job,details,configure,start,complete,fail,make_report
app=FastAPI(title="TaxCloud API",version="1.0.0")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_methods=["*"],allow_headers=["*"])
@app.on_event("startup")
def startup():init()
@app.get("/api/health")
def health():return {"status":"ok","service":"TaxCloud API"}
@app.post("/api/jobs/upload")
async def upload(file:UploadFile=File(...)):
    if not file.filename.lower().endswith(".xlsx"):raise HTTPException(400,"Only .xlsx files are supported.")
    data=await file.read()
    if len(data)>15*1024*1024:raise HTTPException(413,"Maximum upload size is 15 MB.")
    DATA_DIR.mkdir(parents=True,exist_ok=True);temp=DATA_DIR/f"upload_{uuid4()}.xlsx";temp.write_bytes(data)
    try:rows=read_excel(temp)
    except Exception as e:
        temp.unlink(missing_ok=True);raise HTTPException(400,str(e))
    jid=create_job(file.filename,len(rows));temp.replace(DATA_DIR/f"{jid}_input.xlsx")
    return {"job_id":jid,"filename":file.filename,"total_rows":len(rows),"status":"uploaded","current_step":1}
@app.get("/api/jobs/{jid}")
def status(jid:str):
    x=details(jid)
    if not x:raise HTTPException(404,"Job not found.")
    return x
@app.post("/api/jobs/{jid}/configure")
def set_config(jid:str,cfg:Configure):
    if not get_job(jid):raise HTTPException(404,"Job not found.")
    configure(jid,cfg);return {"message":"Configured","current_step":2}
@app.post("/api/jobs/{jid}/start")
def begin(jid:str):
    ok,error=start(jid)
    if not ok:raise HTTPException(400,error)
    return {"message":"Processing started","current_step":3}
@app.post("/api/jobs/{jid}/retry")
def retry(jid:str):
    job=get_job(jid)
    if not job:raise HTTPException(404,"Job not found.")
    if job["status"]!="failed":raise HTTPException(400,"Only failed jobs can be retried.")
    with db() as c:c.execute("UPDATE jobs SET status='configured',current_step=2,error=NULL WHERE id=?",(jid,))
    return {"message":"Returned to step 2","current_step":2}
@app.get("/api/jobs/{jid}/results")
def results(jid:str):
    x=details(jid)
    if not x:raise HTTPException(404,"Job not found.")
    return x
@app.get("/api/jobs/{jid}/download")
def download(jid:str):
    job=get_job(jid)
    if not job:raise HTTPException(404,"Job not found.")
    if job["status"]!="completed":raise HTTPException(409,"Report available after completion.")
    path=DATA_DIR/f"{jid}_report.xlsx";make_report(jid,path)
    return FileResponse(path,filename="taxcloud_processed_report.xlsx",media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
@app.post("/internal/complete")
def internal_complete(payload:dict):complete(payload);return {"accepted":True}
@app.post("/internal/fail")
def internal_fail(payload:dict):fail(payload);return {"accepted":True}
