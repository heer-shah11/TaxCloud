from pydantic import BaseModel,Field
class Configure(BaseModel):
    worker_count:int=Field(2,ge=1,le=3)
    batch_size:int=Field(500,ge=1,le=5000)
    tax_rate:float=Field(0.1,ge=0,le=1)
