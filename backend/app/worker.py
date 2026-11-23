import json,os,requests
from redis import Redis
from .config import REDIS_URL
r=Redis.from_url(REDIS_URL,decode_responses=True);NAME=os.getenv("WORKER_NAME","worker")
def mark(state):
    try:r.set(f"taxcloud:worker:{NAME}",state,ex=20)  # expires => shows offline if the worker dies
    except Exception:pass
def main():
    print(NAME,"waiting for batches");mark("idle")
    while True:
        item=r.blpop("taxcloud:queue",timeout=5)
        if not item:
            mark("idle");continue
        mark("busy")
        t=json.loads(item[1])
        try:
            output=[]
            for row in t["rows"]:
                profit=round((row["selling_price"]-row["purchase_price"])*row["quantity"],2)
                output.append({**row,"profit":profit,"demo_tax":round(max(0,profit)*t["tax_rate"],2)})
            p={k:t[k] for k in ("batch_id","job_id","batch_number")};p.update(worker_name=NAME,rows=output)
            requests.post("http://api:8000/internal/complete",json=p,timeout=60).raise_for_status()
            print(NAME,"completed batch",t["batch_number"])
        except Exception as e:
            try:requests.post("http://api:8000/internal/fail",json={"batch_id":t["batch_id"],"job_id":t["job_id"],"worker_name":NAME,"error":str(e)},timeout=20)
            except Exception:print("Could not report error",e)
        finally:mark("idle")
if __name__=="__main__":main()
