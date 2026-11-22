import json,uuid
from datetime import datetime,timezone
from openpyxl import load_workbook,Workbook
from redis import Redis
from .config import REDIS_URL,DATA_DIR,REQUIRED
from .db import db
queue=Redis.from_url(REDIS_URL,decode_responses=True)

def read_excel(path):
    wb=load_workbook(path,read_only=True,data_only=True)
    if "Transactions" not in wb.sheetnames: raise ValueError("Workbook must contain a Transactions sheet.")
    ws=wb["Transactions"]
    headers=[x.value for x in next(ws.iter_rows(min_row=1,max_row=1))]
    missing=[x for x in REQUIRED if x not in headers]
    if missing: raise ValueError("Missing columns: "+", ".join(missing))
    idx={k:headers.index(k) for k in REQUIRED}; rows=[]
    for n,cells in enumerate(ws.iter_rows(min_row=2,values_only=True),2):
        vals=[cells[idx[k]] if idx[k]<len(cells) else None for k in REQUIRED]
        if all(v is None for v in vals): continue
        txn,share,buy,sell,qty=vals
        if not txn or not share: raise ValueError(f"Row {n}: transaction ID and share name are required.")
        try: buy,sell,qty=float(buy),float(sell),float(qty)
        except (TypeError,ValueError): raise ValueError(f"Row {n}: prices and quantity must be numeric.")
        if min(buy,sell,qty)<0: raise ValueError(f"Row {n}: negative values are not allowed.")
        rows.append(dict(transaction_id=str(txn),share_name=str(share),purchase_price=buy,selling_price=sell,quantity=qty))
    if not rows: raise ValueError("No transaction rows found.")
    return rows

def get_job(jid):
    with db() as c:
        r=c.execute("SELECT * FROM jobs WHERE id=?",(jid,)).fetchone()
        return dict(r) if r else None

def create_job(filename,count):
    jid=str(uuid.uuid4())
    with db() as c: c.execute("INSERT INTO jobs(id,filename,status,current_step,total_rows,created_at) VALUES(?,?,?,?,?,?)",(jid,filename,"uploaded",1,count,datetime.now(timezone.utc).isoformat()))
    return jid

def details(jid):
    job=get_job(jid)
    if not job:return None
    with db() as c:
        batches=[dict(x) for x in c.execute("SELECT batch_number,status,worker_name,error FROM batches WHERE job_id=? ORDER BY batch_number",(jid,))]
        totals=c.execute("SELECT COUNT(*) n,COALESCE(SUM(profit),0) profit,COALESCE(SUM(demo_tax),0) tax FROM results WHERE job_id=?",(jid,)).fetchone()
    job.update(batches=batches,processed_rows=totals["n"],total_profit=round(totals["profit"],2),total_demo_tax=round(totals["tax"],2))
    return job

def configure(jid,cfg):
    with db() as c:
        return c.execute("UPDATE jobs SET worker_count=?,batch_size=?,tax_rate=?,status='configured',current_step=2,error=NULL WHERE id=?",(cfg.worker_count,cfg.batch_size,cfg.tax_rate,jid)).rowcount>0

def start(jid):
    job=get_job(jid)
    if not job:return False,"Job not found."
    if job["status"]!="configured":return False,"Configure the workload before starting."
    rows=read_excel(DATA_DIR/f"{jid}_input.xlsx")
    chunks=[rows[i:i+job["batch_size"]] for i in range(0,len(rows),job["batch_size"])]
    with db() as c:
        c.execute("DELETE FROM batches WHERE job_id=?",(jid,));c.execute("DELETE FROM results WHERE job_id=?",(jid,))
        c.execute("UPDATE jobs SET status='processing',current_step=3,total_batches=?,completed_batches=0,failed_batches=0,error=NULL WHERE id=?",(len(chunks),jid))
        for number,chunk in enumerate(chunks,1):
            bid=str(uuid.uuid4());c.execute("INSERT INTO batches(id,job_id,batch_number,status) VALUES(?,?,?,'queued')",(bid,jid,number))
            queue.rpush("taxcloud:queue",json.dumps(dict(batch_id=bid,job_id=jid,batch_number=number,tax_rate=job["tax_rate"],rows=chunk)))
    return True,None

def complete(p):
    with db() as c:
        b=c.execute("SELECT status FROM batches WHERE id=?",(p["batch_id"],)).fetchone()
        if not b or b["status"]=="completed":return
        for r in p["rows"]:
            c.execute("INSERT INTO results(job_id,transaction_id,share_name,purchase_price,selling_price,quantity,profit,demo_tax,batch_number) VALUES(?,?,?,?,?,?,?,?,?)",(p["job_id"],r["transaction_id"],r["share_name"],r["purchase_price"],r["selling_price"],r["quantity"],r["profit"],r["demo_tax"],p["batch_number"]))
        c.execute("UPDATE batches SET status='completed',worker_name=? WHERE id=?",(p["worker_name"],p["batch_id"]))
        c.execute("UPDATE jobs SET completed_batches=completed_batches+1 WHERE id=?",(p["job_id"],))
        count=c.execute("SELECT COUNT(*) total,SUM(status='completed') done FROM batches WHERE job_id=?",(p["job_id"],)).fetchone()
        if count["total"]==count["done"]:c.execute("UPDATE jobs SET status='completed',current_step=4 WHERE id=?",(p["job_id"],))

def fail(p):
    with db() as c:
        c.execute("UPDATE batches SET status='failed',worker_name=?,error=? WHERE id=?",(p.get("worker_name"),p.get("error","Worker error")[:500],p["batch_id"]))
        c.execute("UPDATE jobs SET status='failed',failed_batches=failed_batches+1,error=? WHERE id=?",(p.get("error","Worker error")[:500],p["job_id"]))

def make_report(jid,path):
    with db() as c: rows=c.execute("SELECT transaction_id,share_name,purchase_price,selling_price,quantity,profit,demo_tax,batch_number FROM results WHERE job_id=? ORDER BY batch_number,id",(jid,)).fetchall()
    wb=Workbook();ws=wb.active;ws.title="Processed Transactions"
    ws.append(["Transaction ID","Share Name","Purchase Price","Selling Price","Quantity","Profit / Loss","Demo Tax","Batch"])
    for row in rows:ws.append(list(row))
    ws.freeze_panes="A2";wb.save(path)
