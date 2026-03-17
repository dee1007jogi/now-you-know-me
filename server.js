require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const multer = require("multer");
const { nanoid } = require("nanoid");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: "15mb" })); 
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// ---- MongoDB Connection ----
const MONGO_URI = process.env.MONGO_URI;
let dbConnected = false;

if (MONGO_URI) {
    mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
    })
        .then(() => {
            console.log("✅ Connected to MongoDB");
            dbConnected = true;
        })
        .catch(err => console.error("❌ MongoDB Connection Error:", err));
    
    mongoose.set('bufferCommands', false);
} else {
    console.warn("⚠️  MONGO_URI not found. Running with in-memory fallback.");
}

// ---- Schemas ----
const playerSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    photoUrl: String,
    answers: Object,
    score: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    wrong: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    cooldownUntil: { type: Number, default: 0 },
    openedAt: { type: Map, of: Number, default: {} },
    attemptsPerCard: { type: Map, of: Number, default: {} },
    matchedCards: { type: [String], default: [] }, // Track completed cards
    correctTimes: [Number],
    cardId: String
});

const gameSchema = new mongoose.Schema({
    status: { type: String, default: "lobby" },
    sessionCode: { type: String, default: () => Math.floor(100000 + Math.random() * 900000).toString() }
});

const Player = mongoose.model("Player", playerSchema);
const Game = mongoose.model("Game", gameSchema);

// ---- Memory Store (The Source of Truth for local speed) ----
let memoryState = { status: "lobby", sessionCode: Math.floor(100000 + Math.random() * 900000).toString() };
let playersMap = new Map(); // id -> player object

async function getGameState() {
    try {
        if (!MONGO_URI || !dbConnected) return memoryState;
        let g = await Game.findOne();
        if (!g) g = await Game.create({});
        return g;
    } catch (e) {
        return memoryState;
    }
}

async function getPlayer(id) {
    // 1. Check Memory First
    if (playersMap.has(id)) return playersMap.get(id);
    
    // 2. Check DB
    if (MONGO_URI && dbConnected) {
        try {
            const p = await Player.findOne({ id });
            if (p) {
                const pObj = p.toObject();
                playersMap.set(id, pObj);
                return pObj;
            }
        } catch (e) {}
    }
    return null;
}

async function savePlayer(pObj) {
    // 1. Update Memory (INSTANT)
    playersMap.set(pObj.id, pObj);
    
    // 2. Sync to DB in background (FIRE AND FORGET)
    if (MONGO_URI && dbConnected) {
        setImmediate(() => {
            Player.findOneAndUpdate({ id: pObj.id }, pObj, { upsert: true })
                .catch(e => console.error("❌ DB Sync Error:", e.message));
        });
    }
}

// ---- File upload setup ----
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }
});

// ---- Helpers ----
async function getLeaderboard() {
    // Merge Memory and DB
    let all = Array.from(playersMap.values());
    
    if (MONGO_URI && dbConnected) {
        try {
            const dbPlayers = await Player.find().select("-photoUrl");
            dbPlayers.forEach(p => {
                const pObj = p.toObject();
                if (!playersMap.has(pObj.id)) {
                    all.push(pObj);
                }
            });
        } catch (e) {}
    }

    const arr = all.map(p => {
        return {
            id: p.id,
            name: p.name,
            photoUrl: p.photoUrl,
            score: p.score || 0,
            correct: p.correct || 0,
            wrong: p.wrong || 0,
            accuracy: (p.correct + p.wrong)
                ? Math.round((p.correct / (p.correct + p.wrong)) * 100)
                : 0,
            avgCorrectSec: (p.correctTimes && p.correctTimes.length)
                ? Math.round(p.correctTimes.reduce((a, b) => a + b, 0) / p.correctTimes.length)
                : null
        };
    });

    arr.sort((a, b) =>
        (b.score - a.score) ||
        (b.correct - a.correct) ||
        (a.wrong - b.wrong) ||
        ((a.avgCorrectSec ?? 999999) - (b.avgCorrectSec ?? 999999))
    );
    return arr;
}

async function emitState() {
    // Run broadcast in next tick to keep API response instantaneous
    setImmediate(async () => {
        try {
            const g = await getGameState();
            const leaderboard = await getLeaderboard();
            
            const readyCount = Array.from(playersMap.values()).filter(p => p.photoUrl && p.answers).length;
            const cardsCount = Array.from(playersMap.values()).filter(p => p.answers).length;

            io.emit("state", {
                status: g.status,
                playersCount: playersMap.size,
                readyCount,
                cardsCount,
                leaderboard
            });
        } catch (err) {
            console.error("❌ emitState Error:", err);
        }
    });
}

function buildClues(answers) {
    if (!answers) return [];
    return [
        { label: "Work style", value: answers.workStyle },
        { label: "Team role", value: answers.teamRole },
        { label: "Meeting superpower", value: answers.meetingPower },
        { label: "Ideal break", value: answers.breakStyle },
        { label: "Updates via", value: answers.updatesVia },
        { label: "Recharge", value: answers.recharge },
        { label: "Surprising skill", value: answers.surprisingSkill }
    ];
}

// ---- Routes ----
app.use((req, res, next) => {
    console.log(`🌐 [${req.method}] ${req.url} - ${new Date().toLocaleTimeString()}`);
    next();
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/player", (req, res) => res.sendFile(path.join(__dirname, "public", "player.html")));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/tv", (req, res) => res.sendFile(path.join(__dirname, "public", "tv.html")));

app.post("/api/join", async (req, res) => {
    try {
        const g = await getGameState();
        if (g.status !== "lobby") return res.status(400).json({ error: "Game already started" });

        const name = String(req.body.name || "").trim();
        if (!name) return res.status(400).json({ error: "Name required" });

        const id = nanoid(8);
        const newPlayer = {
            id, name,
            score: 0, correct: 0, wrong: 0, streak: 0,
            correctTimes: [], openedAt: {}, attemptsPerCard: {}, matchedCards: []
        };
        
        await savePlayer(newPlayer);
        res.json({ playerId: id });
        emitState();
    } catch (err) {
        res.status(500).json({ error: "Join failed." });
    }
});

app.post("/api/upload-photo", upload.single("photo"), async (req, res) => {
    try {
        const playerId = String(req.body.playerId || "").trim();
        const p = await getPlayer(playerId);
        if (!p) return res.status(404).json({ error: "Player not found" });

        const g = await getGameState();
        if (g.status !== "lobby") return res.status(400).json({ error: "Cannot upload after start" });
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        p.photoUrl = b64;
        
        await savePlayer(p);
        res.json({ ok: true, photoUrl: p.photoUrl });
        emitState();
    } catch (err) {
        res.status(500).json({ error: "Upload failed." });
    }
});

app.post("/api/submit-answers", async (req, res) => {
    try {
        const { playerId, answers } = req.body;
        const p = await getPlayer(playerId);
        if (!p) return res.status(404).json({ error: "Player not found" });

        const g = await getGameState();
        if (g.status !== "lobby") return res.status(400).json({ error: "Cannot submit after start" });

        p.answers = answers;
        if (!p.cardId) p.cardId = nanoid(6);
        
        await savePlayer(p);
        res.json({ ok: true, cardId: p.cardId });
        emitState();
    } catch (err) {
        res.status(500).json({ error: "Submit failed." });
    }
});

app.get("/api/cards/:playerId", async (req, res) => {
    try {
        const p = await getPlayer(req.params.playerId);
        if (!p) return res.status(404).json({ error: "Player not found" });

        const g = await getGameState();
        if (g.status !== "live") return res.status(400).json({ error: "Game not live" });

        const all = Array.from(playersMap.values()).filter(c => 
            c.id !== p.id && 
            c.answers && 
            !(p.matchedCards || []).includes(c.cardId)
        );
        const cards = all.map(c => ({
            cardId: c.cardId,
            clues: buildClues(c.answers)
        }));
        res.json({ cards });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch cards." });
    }
});

app.get("/api/people/:playerId", async (req, res) => {
    try {
        const p = await getPlayer(req.params.playerId);
        if (!p) return res.status(404).json({ error: "Player not found" });

        const g = await getGameState();
        if (g.status !== "live") return res.status(400).json({ error: "Game not live" });

        let people = Array.from(playersMap.values())
            .filter(x => x.id !== p.id && x.photoUrl)
            .map(x => ({ id: x.id, name: x.name, photoUrl: x.photoUrl }));

        for (let i = people.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [people[i], people[j]] = [people[j], people[i]];
        }
        res.json({ people });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch grid." });
    }
});

app.post("/api/open-card", async (req, res) => {
    try {
        const { playerId, cardId } = req.body;
        const p = await getPlayer(playerId);
        if (!p) return res.status(404).json({ error: "Player not found" });

        if (!p.openedAt) p.openedAt = {};
        if (!p.openedAt[cardId]) {
            p.openedAt[cardId] = Date.now();
            await savePlayer(p);
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false });
    }
});

app.post("/api/attempt", async (req, res) => {
    try {
        const { playerId, cardId, guessedPersonId } = req.body;
        const p = await getPlayer(playerId);
        const target = Array.from(playersMap.values()).find(x => x.cardId === cardId);
        
        if (!p || !target) return res.status(404).json({ error: "Player or card not found" });

        // No cooldown check as per request ("no sleep mode")

        if (!p.attemptsPerCard) p.attemptsPerCard = {};
        const currentAttempts = p.attemptsPerCard[cardId] || 0;
        if (currentAttempts >= 2) return res.status(400).json({ error: "Card locked" });

        p.attemptsPerCard[cardId] = currentAttempts + 1;

        const isCorrect = target.id === guessedPersonId;
        let delta = 0, speedBonus = 0, streakBonus = 0;

        if (isCorrect) {
            delta += 10;
            if (!p.matchedCards) p.matchedCards = [];
            if (!p.matchedCards.includes(cardId)) p.matchedCards.push(cardId);

            const openedTs = p.openedAt ? p.openedAt[cardId] : null;
            if (openedTs) {
                const elapsedSec = Math.floor((Date.now() - openedTs) / 1000);
                p.correctTimes.push(elapsedSec);
                if (elapsedSec <= 60) speedBonus = 5;
                else if (elapsedSec <= 120) speedBonus = 3;
            }
            delta += speedBonus;
            p.correct = (p.correct || 0) + 1;
            p.streak = (p.streak || 0) + 1;
            if (p.streak === 2) streakBonus = 5;
            if (p.streak >= 3) streakBonus = 10;
            delta += streakBonus;
        } else {
            delta -= 3;
            p.wrong = (p.wrong || 0) + 1;
            p.streak = 0;
            // Removed cooldownUntil as per request ("no sleep mode")
        }

        p.score = Math.max(0, (p.score || 0) + delta);
        await savePlayer(p);
        emitState();
        res.json({ correct: isCorrect, delta, speedBonus, streakBonus, score: p.score });
    } catch (err) {
        res.status(500).json({ error: "Attempt failed." });
    }
});

app.post("/api/admin/start", async (req, res) => {
    const g = await getGameState();
    g.status = "live";
    if (MONGO_URI && dbConnected) await g.save();
    emitState();
    res.json({ ok: true });
});

app.post("/api/admin/end", async (req, res) => {
    const g = await getGameState();
    g.status = "ended";
    if (MONGO_URI && dbConnected) await g.save();
    emitState();
    res.json({ ok: true });
});

app.post("/api/admin/reset", async (req, res) => {
    playersMap.clear();
    memoryState.status = "lobby";
    memoryState.sessionCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    if (MONGO_URI && dbConnected) {
        await Player.deleteMany({});
        const g = await getGameState();
        g.status = "lobby";
        g.sessionCode = memoryState.sessionCode;
        await g.save();
    }
    emitState();
    res.json({ ok: true });
});

app.get("/api/session", async (req, res) => {
    const g = await getGameState();
    res.json({ code: g.sessionCode });
});

app.get("/api/admin/export", async (req, res) => {
    const lb = await getLeaderboard();
    let csv = "Rank,Name,Score,Matches,Accuracy%\n";
    lb.forEach((p, i) => {
        csv += `${i + 1},"${p.name}",${p.score},${p.correct},${p.accuracy}%\n`;
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=results.csv");
    res.send(csv);
});

io.on("connection", async (socket) => {
    emitState();
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n  🎮  Now You Know Me — Server running at http://localhost:${PORT}`);
});
