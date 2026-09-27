const WebSocket = require("ws")
const https = require("https")
const http = require("http")

const PORT = process.env.PORT || 3000
const PLACE_ID = "109983668079237"
const logs = []
const seen = new Set()

function httpsGet(url) {
    return new Promise((res, rej) => {
        https.get(url, {headers:{"User-Agent":"Mozilla/5.0"}}, r => {
            let d = ""
            r.on("data", c => d += c)
            r.on("end", () => { try{res(JSON.parse(d))}catch(e){rej(e)} })
        }).on("error", rej)
    })
}

const DB = [
    {name:"Strawberry Elephant",    base:1e9,    rarity:"OG"},
    {name:"Meowl",                  base:9e8,    rarity:"OG"},
    {name:"Skibidi Toilet",         base:8e8,    rarity:"OG"},
    {name:"Dragon Gingerini",       base:5e8,    rarity:"OG"},
    {name:"Griffin",                base:4e8,    rarity:"OG"},
    {name:"Love Love Bear",         base:3.5e8,  rarity:"OG"},
    {name:"Headless Horseman",      base:2.5e8,  rarity:"OG"},
    {name:"Chillin Chili",          base:3.5e8,  rarity:"Secret"},
    {name:"Burguro and Fryuro",     base:1.5e8,  rarity:"Secret"},
    {name:"La Secret Combinasion",  base:1.25e8, rarity:"Secret"},
    {name:"Dragon Cannelloni",      base:1e8,    rarity:"Secret"},
    {name:"Cooki and Milki",        base:1.15e8, rarity:"Secret"},
    {name:"Garama and Madundung",   base:5e7,    rarity:"Secret"},
    {name:"Ketchuru and Musturu",   base:4.25e7, rarity:"Secret"},
    {name:"La Supreme Combinasion", base:4e7,    rarity:"Secret"},
    {name:"Tictac Sahur",           base:3.75e7, rarity:"Secret"},
    {name:"Ketupat Kepat",          base:3.5e7,  rarity:"Secret"},
    {name:"Spaghetti Tualetti",     base:6e7,    rarity:"Secret"},
    {name:"Money Money Puggy",      base:2.1e7,  rarity:"Secret"},
    {name:"Nuclearo Dinossauro",    base:1.5e7,  rarity:"Secret"},
    {name:"W or L",                 base:5e7,    rarity:"Secret"},
    {name:"Tang Tang Kelentang",    base:3.35e7, rarity:"Secret"},
]

function match(income) {
    for (const b of DB) if (income >= b.base) return b
    return {name:"Unknown", base:0, rarity:"Brainrot God"}
}

function fmt(n) {
    if (n>=1e9) return (n/1e9).toFixed(2)+"B/s"
    if (n>=1e6) return (n/1e6).toFixed(2)+"M/s"
    if (n>=1e3) return (n/1e3).toFixed(1)+"K/s"
    return n+"/s"
}

function estimate(playing, max) {
    const r = playing / Math.max(max,1)
    if (r>=0.95) return 1e8  + Math.random()*1.5e8
    if (r>=0.85) return 5e7  + Math.random()*5e7
    if (r>=0.70) return 2e7  + Math.random()*3e7
    if (r>=0.55) return 1e7  + Math.random()*1e7
    return 0
}

const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin","*")
    res.setHeader("Content-Type","application/json")
    const path = new URL(req.url, "http://localhost").pathname

    if (path==="/" || path==="/ping") {
        res.writeHead(200)
        res.end(JSON.stringify({status:"Brainrot Logs Server Running", total:logs.length}))
        return
    }
    if (path==="/logs") {
        res.writeHead(200)
        res.end(JSON.stringify(logs))
        return
    }
    res.writeHead(404)
    res.end(JSON.stringify({error:"not found"}))
})

const wss = new WebSocket.Server({server})
const clients = new Set()

wss.on("connection", ws => {
    clients.add(ws)
    console.log("[ws] client connected")
    // send last 20 on connect
    ws.send(JSON.stringify({type:"history", data:logs.slice(0,20)}))
    ws.on("close", ()=>clients.delete(ws))
    ws.on("error", ()=>clients.delete(ws))
})

function broadcast(entry) {
    const msg = JSON.stringify({type:"hit", data:entry})
    for (const ws of clients)
        if (ws.readyState===WebSocket.OPEN) ws.send(msg)
}

async function poll() {
    try {
        const data = await httpsGet(
            `https://games.roblox.com/v1/games/${PLACE_ID}/servers/Public`+
            `?sortOrder=Desc&excludeFullGames=false&limit=25`
        )
        if (!data?.data) return
        for (const srv of data.data) {
            if (!srv.id || seen.has(srv.id)) continue
            const income = estimate(srv.playing??0, srv.maxPlayers??8)
            if (income < 10_000_000) continue
            seen.add(srv.id)
            const m = match(income)
            const entry = {
                jobId:       srv.id,
                placeId:     PLACE_ID,
                name:        m.name,
                brainrotName:m.name,
                rarity:      m.rarity,
                income:      Math.floor(income),
                value:       fmt(income),
                numValue:    Math.floor(income),
                playerCount: `${srv.playing??0}/${srv.maxPlayers??8}`,
                timestamp:   Date.now(),
            }
            logs.unshift(entry)
            if (logs.length > 200) logs.pop()
            broadcast(entry)
            console.log(`[hit] ${m.name} | ${fmt(income)} | ${srv.id}`)
        }
    } catch(e) { console.error("[poll]", e.message) }
    setTimeout(poll, 5000)
}

server.listen(PORT, ()=>{
    console.log(`[server] port ${PORT}`)
    poll()
})