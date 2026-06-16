import os
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

CLIMATE_API = os.getenv("CLIMATE_API_URL", "https://climate.expansao-ai.com.br")

app = FastAPI(title="ENSO Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


async def _climate(path: str):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{CLIMATE_API}{path}")
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail="Erro na Climate API")
    return r.json()


@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/api/status")
async def status():
    return await _climate("/climate/status")

@app.get("/api/history")
async def history():
    return await _climate("/climate/history")

@app.get("/api/soi")
async def soi():
    return await _climate("/climate/soi")

@app.get("/api/weekly")
async def weekly():
    return await _climate("/climate/nino34/weekly")

@app.get("/api/prediction")
async def prediction():
    return await _climate("/climate/prediction")


@app.get("/api/blog/posts")
async def blog_posts(limit: int = 10, offset: int = 0):
    return await _climate(f"/api/blog/posts?limit={limit}&offset={offset}")


@app.get("/api/blog/posts/{slug}")
async def blog_post_detail(slug: str):
    return await _climate(f"/api/blog/posts/{slug}")


# Em produção o reverse proxy serve o dashboard.
# Em dev: rode o dashboard via "python -m http.server 8742" na pasta dashboard/
