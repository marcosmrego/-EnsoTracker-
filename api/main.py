import os
import httpx
import markdown as md
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import FileResponse, Response

CLIMATE_API = os.getenv("CLIMATE_API_URL", "https://climate.expansao-ai.com.br")
SITE_URL = os.getenv("SITE_URL", "https://ensotracker.expansao-ai.com.br")

app = FastAPI(title="ENSO Tracker API")
templates = Jinja2Templates(directory="templates")

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


# ── SEO: páginas do blog renderizadas no servidor ───────────────────────────

_FASE_LABELS = {"EL_NINO": "El Niño", "LA_NINA": "La Niña", "NEUTRO": "Neutro"}
_MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]


def _fase_label(fase: str | None) -> str:
    return _FASE_LABELS.get((fase or "").upper(), fase or "")


def _oni_str(oni_valor) -> str:
    if oni_valor is None:
        return ""
    sign = "+" if oni_valor > 0 else ""
    return f" · ONI {sign}{oni_valor:.2f}"


def _fmt_date_ptbr(iso_str: str | None) -> str:
    if not iso_str:
        return ""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return f"{dt.day:02d} de {_MESES_PT[dt.month - 1]}. de {dt.year}"
    except Exception:
        return ""


@app.get("/blog")
async def blog_list():
    return FileResponse("dashboard/blog.html")


@app.get("/blog/{slug}")
async def blog_post_page(request: Request, slug: str):
    post = await _climate(f"/api/blog/posts/{slug}")

    return templates.TemplateResponse(
        request,
        "blog_post.html",
        {
            "slug": post["slug"],
            "titulo": post["titulo"],
            "resumo": post.get("resumo") or "",
            "corpo_html": md.markdown(post.get("corpo") or ""),
            "fase_enso": post.get("fase_enso"),
            "fase_label": _fase_label(post.get("fase_enso")),
            "oni_valor": post.get("oni_valor"),
            "oni_str": _oni_str(post.get("oni_valor")),
            "fontes": post.get("fontes") or [],
            "publicado_em": post.get("publicado_em"),
            "data_label": _fmt_date_ptbr(post.get("publicado_em")),
            "canonical_url": f"{SITE_URL}/blog/{post['slug']}",
        },
    )


@app.get("/sitemap.xml")
async def sitemap():
    posts = await _climate("/api/blog/posts?limit=200")
    urls = [
        f"<url><loc>{SITE_URL}/</loc><changefreq>daily</changefreq></url>",
        f"<url><loc>{SITE_URL}/blog</loc><changefreq>daily</changefreq></url>",
    ]
    for p in posts:
        lastmod = (p.get("publicado_em") or "")[:10]
        urls.append(
            f"<url><loc>{SITE_URL}/blog/{p['slug']}</loc>"
            f"<lastmod>{lastmod}</lastmod><changefreq>monthly</changefreq></url>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + "".join(urls) + "</urlset>"
    )
    return Response(content=xml, media_type="application/xml")


@app.get("/robots.txt")
async def robots():
    content = f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}/sitemap.xml\n"
    return Response(content=content, media_type="text/plain")


# Dashboard estático — deve ser montado por último para não interceptar rotas da API
app.mount("/", StaticFiles(directory="dashboard", html=True), name="dashboard")
