from fastapi import FastAPI
from scanner import executar_scan

app = FastAPI()

@app.get("/scan")
def scan_vulnerabilities():
    return executar_scan()
