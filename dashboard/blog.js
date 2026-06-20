function _fontesHtml(fontes) {
    const f = (fontes || []).slice(0, 6)
    if (!f.length) return ""
    return `<div class="blog-featured-sources">Fontes consultadas: ${
        f.map(s => s.url
            ? `<a href="${s.url}" target="_blank" rel="noopener">${s.source}</a>`
            : s.source
        ).join(" · ")
    }</div>`
}

function _oniStr(oniValor) {
    return oniValor !== null && oniValor !== undefined
        ? ` · ONI ${oniValor > 0 ? "+" : ""}${Number(oniValor).toFixed(2)}`
        : ""
}

function renderDetail(full, { backLink = true } = {}) {
    const back = backLink ? `<a href="blog.html" class="blog-back">← Todas as análises</a>` : ""
    return `
        ${back}
        <article class="blog-featured">
            <div class="blog-banner">${bannerSvg(full.fase_enso, full.oni_valor, full.slug)}
                <span class="blog-banner-label">${phaseLabel(full.fase_enso)}${_oniStr(full.oni_valor)}</span>
            </div>
            <div class="blog-featured-meta">
                <span>${fmtDate(full.publicado_em)}</span>
            </div>
            <h2>${full.titulo}</h2>
            <div class="blog-featured-body">${renderMarkdown(full.corpo)}</div>
            ${_fontesHtml(full.fontes)}
        </article>
    `
}

function renderCard(post) {
    return `
        <a class="blog-card" href="blog.html?post=${post.slug}">
            <div class="blog-card-banner">${bannerSvg(post.fase_enso, post.oni_valor, post.slug)}</div>
            <div class="blog-card-date">${fmtDate(post.publicado_em)}</div>
            <h3>${post.titulo}</h3>
            <p class="blog-card-resumo">${post.resumo || ""}</p>
        </a>
    `
}

async function loadDetail(slug) {
    const content = document.getElementById("blogContent")
    try {
        const r = await fetch(`${API}/api/blog/posts/${slug}`)
        if (!r.ok) throw new Error("post não encontrado")
        const full = await r.json()
        document.getElementById("blogPageTitle").textContent = full.titulo
        document.getElementById("blogPageSub").textContent = `Publicado em ${fmtDate(full.publicado_em)}`
        content.innerHTML = renderDetail(full)
    } catch (e) {
        console.error("blog detail:", e)
        content.innerHTML = `
            <a href="blog.html" class="blog-back">← Todas as análises</a>
            <p style="color:var(--text-3)">Post não encontrado.</p>
        `
    }
}

async function loadList() {
    const content = document.getElementById("blogContent")
    try {
        const r = await fetch(`${API}/api/blog/posts?limit=20`)
        if (!r.ok) throw new Error("fetch falhou")
        const posts = await r.json()
        if (!posts || posts.length === 0) {
            content.innerHTML = `<p style="color:var(--text-3)">Nenhum post publicado ainda.</p>`
            return
        }

        const [latest, ...rest] = posts
        const dr = await fetch(`${API}/api/blog/posts/${latest.slug}`)
        const full = dr.ok ? await dr.json() : latest

        const gridHtml = rest.length
            ? `<div class="blog-grid">${rest.map(renderCard).join("")}</div>`
            : ""

        content.innerHTML = renderDetail(full, { backLink: false }) + gridHtml
    } catch (e) {
        console.error("blog list:", e)
        content.innerHTML = `<p style="color:var(--text-3)">Erro ao carregar posts.</p>`
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const slug = new URLSearchParams(window.location.search).get("post")
    if (slug) {
        loadDetail(slug)
    } else {
        loadList()
    }
})
