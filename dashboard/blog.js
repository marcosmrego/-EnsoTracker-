function renderCard(post, { featured = false } = {}) {
    const cls = featured ? "blog-card blog-card-featured" : "blog-card"
    return `
        <a class="${cls}" href="/blog/${post.slug}">
            <div class="blog-card-banner">${bannerSvg(post.fase_enso, post.oni_valor, post.slug)}</div>
            <div class="blog-card-date">${fmtDate(post.publicado_em)}</div>
            <h3>${post.titulo}</h3>
            <p class="blog-card-resumo">${post.resumo || ""}</p>
        </a>
    `
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
        const gridHtml = rest.length
            ? `<div class="blog-grid">${rest.map(p => renderCard(p)).join("")}</div>`
            : ""

        content.innerHTML = renderCard(latest, { featured: true }) + gridHtml
    } catch (e) {
        console.error("blog list:", e)
        content.innerHTML = `<p style="color:var(--text-3)">Erro ao carregar posts.</p>`
    }
}

document.addEventListener("DOMContentLoaded", loadList)
