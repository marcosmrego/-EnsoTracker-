// Utilitários compartilhados entre index.html e blog.html.
// Deve ser carregado ANTES de app.js / blog.js.

const API = window.location.hostname === "localhost" ? "http://localhost:8000" : ""

function phaseClass(classificacao) {
    if (!classificacao) return "neutro"
    const c = classificacao.toUpperCase()
    if (c === "EL_NINO") return "elnino"
    if (c === "LA_NINA") return "lanina"
    return "neutro"
}

function phaseLabel(classificacao) {
    const c = (classificacao || "").toUpperCase()
    if (c === "EL_NINO") return "El Niño"
    if (c === "LA_NINA") return "La Niña"
    return "Neutro"
}

function fmtDate(iso) {
    if (!iso) return ""
    const d = new Date(iso)
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

function renderMarkdown(text) {
    if (typeof marked !== "undefined") return marked.parse(text || "")
    return (text || "")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .split("\n\n")
        .map(p => `<p>${p.trim()}</p>`)
        .join("")
}

// ── banner SVG gerado a partir dos dados do post ───────────────────────────

function _hashSeed(str) {
    let h = 0
    for (let i = 0; i < (str || "").length; i++) {
        h = (h * 31 + str.charCodeAt(i)) >>> 0
    }
    return h
}

const _BANNER_COLORS = {
    elnino: ["#ef4444", "#7f1d1d"],
    lanina: ["#3b82f6", "#1e3a8a"],
    neutro: ["#64748b", "#1f2937"],
}

function bannerSvg(faseEnso, oniValor, slug) {
    const cls = phaseClass(faseEnso)
    const [c1, c2] = _BANNER_COLORS[cls] || _BANNER_COLORS.neutro
    const seed = _hashSeed(slug)
    const amp = Math.min(36, 12 + Math.abs(oniValor || 0) * 26)
    const phase1 = ((seed % 1000) / 1000) * Math.PI * 2
    const phase2 = (((seed >> 5) % 1000) / 1000) * Math.PI * 2
    const W = 800, H = 220
    const mid = H * 0.62
    const gid = `bg-${slug}`

    function wavePath(a, freq, phase, yBase) {
        let d = `M0,${H}`
        for (let x = 0; x <= W; x += 25) {
            const y = yBase + Math.sin((x / W) * Math.PI * freq + phase) * a
            d += ` L${x},${y.toFixed(1)}`
        }
        d += ` L${W},${H} Z`
        return d
    }

    const wave1 = wavePath(amp, 2, phase1, mid)
    const wave2 = wavePath(amp * 0.6, 3, phase2, mid + 16)

    return `
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
            <defs>
                <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="${c1}" stop-opacity="0.6"/>
                    <stop offset="100%" stop-color="${c2}" stop-opacity="0.95"/>
                </linearGradient>
            </defs>
            <rect width="${W}" height="${H}" fill="url(#${gid})"/>
            <path d="${wave2}" fill="${c2}" opacity="0.4"/>
            <path d="${wave1}" fill="${c1}" opacity="0.3"/>
        </svg>
    `
}
