const API = "https://climate.expansao-ai.com.br"

// ── utils ──────────────────────────────────────────────────────────────────

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

function fmtAnom(v) {
    if (v == null) return "—"
    return (v >= 0 ? "+" : "") + v.toFixed(2) + "°C"
}

// ── status atual ───────────────────────────────────────────────────────────

async function carregarStatus() {
    try {
        const [statusR, soiR] = await Promise.all([
            fetch(`${API}/climate/status`),
            fetch(`${API}/climate/soi`),
        ])
        const status = await statusR.json()
        const soi    = await soiR.json()

        const cls = phaseClass(status.classificacao)

        // phase badge
        const badge = document.getElementById("phaseBadge")
        badge.textContent = phaseLabel(status.classificacao)
        badge.className = `phase-badge ${cls}`

        // ONI e Niño 3.4 mensal
        document.getElementById("oniValue").textContent  = fmtAnom(status.oni)
        document.getElementById("oniValue").className    = `oni-value ${cls}`
        document.getElementById("nino34Value").textContent = fmtAnom(status.nino34)

        // nota de fase
        const notes = {
            elnino: "SOI negativo e TSM elevada no Pacífico equatorial central indicam padrão El Niño.",
            lanina: "SOI positivo e TSM abaixo da média no Pacífico equatorial central indicam padrão La Niña.",
            neutro: "Condições próximas da média — ENSO em fase neutra sem anomalia relevante.",
        }
        document.getElementById("phaseNote").textContent = notes[cls]

        // SOI
        document.getElementById("soiValue").textContent = fmtAnom(soi.soi)
        document.getElementById("soiValue").className   = `stat-card-value ${phaseClass(soi.classificacao)}`
        document.getElementById("soiDesc").textContent  = phaseLabel(soi.classificacao)
        document.getElementById("soiCard").className    = `stat-card ${phaseClass(soi.classificacao)}`

    } catch (e) {
        console.error("status:", e)
    }
}

// ── tendência semanal ──────────────────────────────────────────────────────

async function carregarSemanal() {
    try {
        const r    = await fetch(`${API}/climate/nino34/weekly`)
        const data = await r.json()
        if (!data.length) return

        const sorted = [...data].sort((a, b) => a.date < b.date ? -1 : 1)
        const latest = sorted[sorted.length - 1]
        const prev4w = sorted.length >= 5 ? sorted[sorted.length - 5] : null

        const anom = latest.nino34_anom
        const cls  = anom >= 0.5 ? "elnino" : anom <= -0.5 ? "lanina" : "neutro"

        document.getElementById("weeklyValue").textContent = fmtAnom(anom)
        document.getElementById("weeklyValue").className   = `stat-card-value ${cls}`
        document.getElementById("weeklyCard").className    = `stat-card ${cls}`

        if (prev4w) {
            const delta = anom - prev4w.nino34_anom
            const dir   = delta > 0.05 ? "↑ subindo" : delta < -0.05 ? "↓ caindo" : "→ estável"
            document.getElementById("weeklyTrend").textContent =
                `4 sem atrás: ${fmtAnom(prev4w.nino34_anom)} · ${dir}`
        }

        // cards das 4 regiões
        const regions = [
            { key: "nino12_anom", label: "Niño 1+2" },
            { key: "nino3_anom",  label: "Niño 3"   },
            { key: "nino34_anom", label: "Niño 3.4"  },
            { key: "nino4_anom",  label: "Niño 4"    },
        ]
        const cont = document.getElementById("weeklyRegions")
        cont.innerHTML = regions.map(({ key, label }) => {
            const v   = latest[key]
            const cls = v >= 0.5 ? "pos" : v <= -0.5 ? "neg" : ""
            return `
                <div class="region-card">
                    <span class="region-name">${label}</span>
                    <span class="region-val ${cls}">${fmtAnom(v)}</span>
                </div>`
        }).join("")

        // desenhar sparkline semanal
        desenharSemanal(sorted)

    } catch (e) {
        console.error("semanal:", e)
    }
}

// ── ONI chart ──────────────────────────────────────────────────────────────

async function carregarOni() {
    try {
        const r    = await fetch(`${API}/climate/history`)
        const raw  = await r.json()
        const data = [...raw].reverse()   // cronológico

        desenharOni(data)
    } catch (e) {
        console.error("oni history:", e)
    }
}

function desenharOni(data) {
    const svg = d3.select("#oniChart")
    const el  = document.getElementById("oniChart")
    const W   = el.clientWidth  || 800
    const H   = el.clientHeight || 240
    const mt = 16, mb = 36, ml = 44, mr = 20
    const iW = W - ml - mr
    const iH = H - mt - mb

    svg.attr("viewBox", `0 0 ${W} ${H}`)

    const parseP = d3.timeParse("%Y-%m")
    const dates  = data.map(d => parseP(d.periodo))
    const values = data.map(d => d.oni)

    const x = d3.scaleTime()
        .domain(d3.extent(dates))
        .range([0, iW])

    const y = d3.scaleLinear()
        .domain([-2.5, 2.5])
        .range([iH, 0])
        .nice()

    const g = svg.append("g").attr("transform", `translate(${ml},${mt})`)

    // bandas de fase
    g.append("rect")
        .attr("x", 0).attr("width", iW)
        .attr("y", y(2.5)).attr("height", y(0.5) - y(2.5))
        .attr("fill", "rgba(239,68,68,.07)")

    g.append("rect")
        .attr("x", 0).attr("width", iW)
        .attr("y", y(-0.5)).attr("height", y(-2.5) - y(-0.5))
        .attr("fill", "rgba(59,130,246,.07)")

    // linhas de limiar
    const threshLines = [0.5, -0.5, 1.5, -1.5]
    threshLines.forEach(v => {
        g.append("line")
            .attr("x1", 0).attr("x2", iW)
            .attr("y1", y(v)).attr("y2", y(v))
            .attr("stroke", v > 0 ? "rgba(239,68,68,.25)" : "rgba(59,130,246,.25)")
            .attr("stroke-dasharray", "3 3")
            .attr("stroke-width", 1)
    })

    // linha zero
    g.append("line")
        .attr("x1", 0).attr("x2", iW)
        .attr("y1", y(0)).attr("y2", y(0))
        .attr("stroke", "rgba(255,255,255,.1)")
        .attr("stroke-width", 1)

    // grid horizontal
    const yTicks = [-2, -1, 0, 1, 2]
    yTicks.forEach(v => {
        g.append("text")
            .attr("x", -8).attr("y", y(v))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#3d6080")
            .attr("font-size", 10)
            .text((v >= 0 ? "+" : "") + v)
    })

    // eixo X
    const xAxis = d3.axisBottom(x)
        .ticks(d3.timeMonth.every(4))
        .tickFormat(d3.timeFormat("%b/%y"))
        .tickSize(0)
        .tickPadding(8)

    g.append("g")
        .attr("transform", `translate(0,${iH})`)
        .call(xAxis)
        .select(".domain").remove()

    g.selectAll(".tick text")
        .attr("fill", "#3d6080")
        .attr("font-size", 10)

    // linha ONI com cor por fase
    const lineData = data.map((d, i) => ({ x: dates[i], y: d.oni, cls: d.classificacao }))

    // área preenchida suave
    const area = d3.area()
        .x(d => x(d.x))
        .y0(y(0))
        .y1(d => y(d.y))
        .curve(d3.curveMonotoneX)

    const posData = lineData.map(d => ({ ...d, y: Math.max(0, d.y) }))
    const negData = lineData.map(d => ({ ...d, y: Math.min(0, d.y) }))

    g.append("path").datum(posData).attr("d", area).attr("fill", "rgba(239,68,68,.15)")
    g.append("path").datum(negData).attr("d", area).attr("fill", "rgba(59,130,246,.15)")

    // linha principal
    const line = d3.line()
        .x(d => x(d.x))
        .y(d => y(d.y))
        .curve(d3.curveMonotoneX)

    g.append("path")
        .datum(lineData)
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", "rgba(255,255,255,.5)")
        .attr("stroke-width", 1.5)

    // pontos coloridos
    g.selectAll(".oni-dot")
        .data(lineData)
        .join("circle")
        .attr("class", "oni-dot")
        .attr("cx", d => x(d.x))
        .attr("cy", d => y(d.y))
        .attr("r", 3.5)
        .attr("fill", d => {
            const c = (d.cls || "").toUpperCase()
            return c === "EL_NINO" ? "#ef4444" : c === "LA_NINA" ? "#3b82f6" : "#64748b"
        })
        .attr("stroke", "var(--bg2)")
        .attr("stroke-width", 1.5)

    // rótulo último valor
    const last = lineData[lineData.length - 1]
    if (last) {
        g.append("text")
            .attr("x", x(last.x) + 6)
            .attr("y", y(last.y))
            .attr("dominant-baseline", "middle")
            .attr("fill", "#e2eaf4")
            .attr("font-size", 10)
            .attr("font-weight", 700)
            .text(fmtAnom(last.y))
    }
}

// ── sparkline semanal ──────────────────────────────────────────────────────

function desenharSemanal(data) {
    const svg = d3.select("#weeklyChart")
    const el  = document.getElementById("weeklyChart")
    const W   = el.clientWidth  || 600
    const H   = el.clientHeight || 180
    const mt = 14, mb = 30, ml = 40, mr = 16
    const iW = W - ml - mr
    const iH = H - mt - mb

    svg.attr("viewBox", `0 0 ${W} ${H}`)

    // converter dates tipo "10JUN2026"
    const months = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 }
    const parsed = data.map(d => {
        const s   = d.date
        const day = parseInt(s.slice(0, 2))
        const mon = months[s.slice(2, 5).toUpperCase()] ?? 0
        const yr  = parseInt(s.slice(5))
        return { date: new Date(yr, mon, day), anom: d.nino34_anom }
    }).filter(d => !isNaN(d.date))

    const recent = parsed.slice(-12)

    const x = d3.scaleTime().domain(d3.extent(recent, d => d.date)).range([0, iW])
    const yExt = d3.extent(recent, d => d.anom)
    const yPad = 0.3
    const y = d3.scaleLinear()
        .domain([Math.min(yExt[0] - yPad, -0.5), Math.max(yExt[1] + yPad, 0.5)])
        .range([iH, 0])

    const g = svg.append("g").attr("transform", `translate(${ml},${mt})`)

    // banda El Niño
    const ninoY = y(0.5)
    if (ninoY > 0) {
        g.append("rect")
            .attr("x", 0).attr("width", iW)
            .attr("y", 0).attr("height", ninoY)
            .attr("fill", "rgba(239,68,68,.06)")
    }

    // linha zero
    g.append("line")
        .attr("x1", 0).attr("x2", iW)
        .attr("y1", y(0)).attr("y2", y(0))
        .attr("stroke", "rgba(255,255,255,.1)")

    // limiar +0.5
    g.append("line")
        .attr("x1", 0).attr("x2", iW)
        .attr("y1", y(0.5)).attr("y2", y(0.5))
        .attr("stroke", "rgba(239,68,68,.3)")
        .attr("stroke-dasharray", "3 3")

    // eixo Y
    g.selectAll(".y-label")
        .data(d3.ticks(Math.floor(yExt[0]), Math.ceil(yExt[1]), 4))
        .join("text")
        .attr("x", -8).attr("y", d => y(d))
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("fill", "#3d6080")
        .attr("font-size", 10)
        .text(d => (d >= 0 ? "+" : "") + d.toFixed(1))

    // eixo X
    g.append("g")
        .attr("transform", `translate(0,${iH})`)
        .call(
            d3.axisBottom(x)
                .ticks(4)
                .tickFormat(d3.timeFormat("%d/%m"))
                .tickSize(0).tickPadding(8)
        )
        .select(".domain").remove()
    g.selectAll(".tick text").attr("fill", "#3d6080").attr("font-size", 10)

    // área
    const area = d3.area()
        .x(d => x(d.date))
        .y0(y(0))
        .y1(d => y(d.anom))
        .curve(d3.curveMonotoneX)

    g.append("path").datum(recent.map(d => ({ ...d, anom: Math.max(0, d.anom) }))).attr("d", area).attr("fill", "rgba(239,68,68,.15)")
    g.append("path").datum(recent.map(d => ({ ...d, anom: Math.min(0, d.anom) }))).attr("d", area).attr("fill", "rgba(59,130,246,.15)")

    // linha
    g.append("path")
        .datum(recent)
        .attr("d", d3.line().x(d => x(d.date)).y(d => y(d.anom)).curve(d3.curveMonotoneX))
        .attr("fill", "none")
        .attr("stroke", "#f59e0b")
        .attr("stroke-width", 2)

    // pontos
    g.selectAll(".wdot")
        .data(recent)
        .join("circle")
        .attr("cx", d => x(d.date))
        .attr("cy", d => y(d.anom))
        .attr("r", 3.5)
        .attr("fill", "#f59e0b")
        .attr("stroke", "var(--bg2)")
        .attr("stroke-width", 1.5)

    // rótulo último
    const last = recent[recent.length - 1]
    if (last) {
        g.append("text")
            .attr("x", x(last.date) + 6).attr("y", y(last.anom))
            .attr("dominant-baseline", "middle")
            .attr("fill", "#f59e0b")
            .attr("font-size", 10).attr("font-weight", 700)
            .text(fmtAnom(last.anom))
    }
}

// ── predição ───────────────────────────────────────────────────────────────

async function carregarPredicao() {
    try {
        const r = await fetch(`${API}/climate/prediction`)
        const d = await r.json()
        const block = document.getElementById("predictionBlock")
        block.innerHTML = d.prediction
            ? `<p>${d.prediction}</p>`
            : `<p style="color:var(--text-3)">Análise indisponível.</p>`
    } catch (e) {
        console.error("predicao:", e)
    }
}

// ── init ───────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    carregarStatus()
    carregarOni()
    carregarSemanal()
    carregarPredicao()
})
