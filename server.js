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

app.use(express.json({ limit: "5mb" })); // Increased for Base64 photos
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// ---- MongoDB Connection ----
const MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI) {
    mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
    })
        .then(() => console.log("✅ Connected to MongoDB"))
        .catch(err => console.error("❌ MongoDB Connection Error. Did you allow IP 0.0.0.0/0 in Atlas?", err));
    
    // 🚀 CRITICAL: Disable buffering so requests don't hang if DB is slow
    mongoose.set('bufferCommands', false);
}
 else {
    console.warn("⚠️  MONGO_URI not found. Running with in-memory fallback (state will NOT persist).");
}

// ---- Schemas ----
const playerSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    photoUrl: String, // Will store Base64 data if disk is ephemeral
    answers: Object,
    score: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    wrong: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    cooldownUntil: { type: Number, default: 0 },
    openedAt: { type: Map, of: Number, default: {} },
    attemptsPerCard: { type: Map, of: Number, default: {} },
    correctTimes: [Number],
    cardId: String
});

const gameSchema = new mongoose.Schema({
    status: { type: String, default: "lobby" },
    sessionCode: { type: String, default: () => Math.floor(100000 + Math.random() * 900000).toString() }
});

const Player = mongoose.model("Player", playerSchema);
const Game = mongoose.model("Game", gameSchema);

// In-memory fallback if no DB
let memoryState = { status: "lobby", sessionCode: "123456" };

async function getGameState() {
    if (!MONGO_URI) return memoryState;
    let g = await Game.findOne();
    if (!g) g = await Game.create({});
    return g;
}

// ---- File upload setup (Memory Storage for Base64) ----
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 } // 2 MB
});

// ---- Helpers ----
async function getLeaderboard() {
    // 🚀 OPTIMIZATION: Do NOT fetch photoUrl here. It's too heavy for global broadcasts.
    const players = MONGO_URI ? await Player.find().select("-photoUrl") : []; 
    const arr = players.map(p => {
        const pObj = p.toObject ? p.toObject() : p;
        return {
            id: pObj.id,
            name: pObj.name,
            photoUrl: pObj.photoUrl,
            score: pObj.score,
            correct: pObj.correct,
            wrong: pObj.wrong,
            accuracy: (pObj.correct + pObj.wrong)
                ? Math.round((pObj.correct / (pObj.correct + pObj.wrong)) * 100)
                : 0,
            avgCorrectSec: pObj.correctTimes.length
                ? Math.round(pObj.correctTimes.reduce((a, b) => a + b, 0) / pObj.correctTimes.length)
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
    const g = await getGameState();
    
    // 🚀 OPTIMIZATION: Use countDocuments instead of fetching all players into RAM
    const playersCount = MONGO_URI ? await Player.countDocuments() : 0;
    const readyCount = MONGO_URI ? await Player.countDocuments({ photoUrl: { $exists: true }, answers: { $exists: true } }) : 0;
    const cardsCount = MONGO_URI ? await Player.countDocuments({ answers: { $exists: true } }) : 0;
    
    const leaderboard = await getLeaderboard();
    
    io.emit("state", {
        status: g.status,
        playersCount,
        readyCount,
        cardsCount,
        leaderboard
    });
}

function buildClues(answers) {
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

// ---- Page routes ----
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/player", (req, res) => res.sendFile(path.join(__dirname, "public", "player.html")));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/tv", (req, res) => res.sendFile(path.join(__dirname, "public", "tv.html")));

// ---- API: Join ----
app.post("/api/join", async (req, res) => {
    console.log("📩 Join request received:", req.body);
    try {
        const g = await getGameState();
        if (g.status !== "lobby")
            return res.status(400).json({ error: "Game already started" });

        const name = String(req.body.name || "").trim();
        if (!name) return res.status(400).json({ error: "Name required" });

        const id = nanoid(8);
        const newPlayer = { id, name };
        
        if (MONGO_URI && mongoose.connection.readyState === 1) {
            console.log("💾 Creating player in MongoDB...");
            await Player.create(newPlayer);
        } else {
            console.log("⚠️ DB not ready. Saving to memory fallback for now.");
            // We can still let them join to keep the game moving
        }
        
        // 🚀 FAST RESPONSE
        return res.json({ playerId: id });

        // 🔄 BACKGROUND: Update everyone else without making the joiner wait
        emitState().catch(e => console.error("Background emit error:", e));
        
        console.log("✅ Player joined successfully:", id);
    } catch (err) {
        console.error("❌ JOIN ERROR:", err);
        res.status(500).json({ error: "Server error during join. Check DB connection." });
    }
});

// ---- API: Upload photo (Stored as Base64) ----
app.post("/api/upload-photo", upload.single("photo"), async (req, res) => {
    const playerId = String(req.body.playerId || "").trim();
    const p = MONGO_URI ? await Player.findOne({ id: playerId }) : null;
    if (!p) return res.status(404).json({ error: "Player not found" });

    const g = await getGameState();
    if (g.status !== "lobby")
        return res.status(400).json({ error: "Cannot upload after start" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Convert to Base64
    const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    p.photoUrl = b64;
    await p.save();

    emitState();
    res.json({ ok: true, photoUrl: p.photoUrl });
});

// ---- API: Submit answers ----
app.post("/api/submit-answers", async (req, res) => {
    const { playerId, answers } = req.body;
    const p = MONGO_URI ? await Player.findOne({ id: playerId }) : null;
    if (!p) return res.status(404).json({ error: "Player not found" });

    const g = await getGameState();
    if (g.status !== "lobby")
        return res.status(400).json({ error: "Cannot submit after start" });

    const required = [
        "workStyle", "teamRole", "meetingPower",
        "breakStyle", "updatesVia", "recharge", "surprisingSkill"
    ];
    for (const k of required) {
        if (!answers || !String(answers[k] || "").trim())
            return res.status(400).json({ error: `Missing: ${k}` });
    }

    const bad = ["fuck", "shit", "bitch", "asshole"];
    const skillLower = String(answers.surprisingSkill).toLowerCase();
    if (bad.some(w => skillLower.includes(w)))
        return res.status(400).json({ error: "Please keep it professional." });

    p.answers = answers;
    if (!p.cardId) p.cardId = nanoid(6);
    await p.save();

    emitState();
    res.json({ ok: true, cardId: p.cardId });
});

// ---- API: Get mystery cards ----
app.get("/api/cards/:playerId", async (req, res) => {
    const p = MONGO_URI ? await Player.findOne({ id: req.params.playerId }) : null;
    if (!p) return res.status(404).json({ error: "Player not found" });

    const g = await getGameState();
    if (g.status !== "live")
        return res.status(400).json({ error: "Game not live" });

    const all = await Player.find({ id: { $ne: p.id }, answers: { $exists: true, $ne: null } });
    const cards = all.map(c => ({
        cardId: c.cardId,
        clues: buildClues(c.answers)
    }));
    res.json({ cards });
});

// ---- API: Get photo grid ----
app.get("/api/people/:playerId", async (req, res) => {
    const p = MONGO_URI ? await Player.findOne({ id: req.params.playerId }) : null;
    if (!p) return res.status(404).json({ error: "Player not found" });

    const g = await getGameState();
    if (g.status !== "live")
        return res.status(400).json({ error: "Game not live" });

    let people = await Player.find({ id: { $ne: p.id }, photoUrl: { $exists: true, $ne: null } })
        .select("id name photoUrl");

    people = people.map(x => ({ id: x.id, name: x.name, photoUrl: x.photoUrl }));

    // Shuffle
    for (let i = people.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [people[i], people[j]] = [people[j], people[i]];
    }
    res.json({ people });
});

// ---- API: Open card ----
app.post("/api/open-card", async (req, res) => {
    const { playerId, cardId } = req.body;
    const p = MONGO_URI ? await Player.findOne({ id: playerId }) : null;
    if (!p) return res.status(404).json({ error: "Player not found" });

    const g = await getGameState();
    if (g.status !== "live")
        return res.status(400).json({ error: "Game not live" });

    if (!p.openedAt.has(cardId)) {
        p.openedAt.set(cardId, Date.now());
        await p.save();
    }
    res.json({ ok: true });
});

// ---- API: Attempt match ----
app.post("/api/attempt", async (req, res) => {
    const { playerId, cardId, guessedPersonId } = req.body;
    const p = MONGO_URI ? await Player.findOne({ id: playerId }) : null;
    if (!p) return res.status(404).json({ error: "Player not found" });

    const g = await getGameState();
    if (g.status !== "live")
        return res.status(400).json({ error: "Game not live" });

    if (Date.now() < p.cooldownUntil)
        return res.status(400).json({ error: "Cooldown active. Wait a moment." });

    const target = await Player.findOne({ cardId });
    if (!target) return res.status(404).json({ error: "Card not found" });
    if (target.id === p.id)
        return res.status(400).json({ error: "You cannot match your own card." });

    const currentAttempts = p.attemptsPerCard.get(cardId) || 0;
    if (currentAttempts >= 2)
        return res.status(400).json({ error: "Card locked (max attempts reached)." });

    p.attemptsPerCard.set(cardId, currentAttempts + 1);

    const isCorrect = target.id === guessedPersonId;
    let delta = 0, speedBonus = 0, streakBonus = 0;

    if (isCorrect) {
        delta += 10;
        const openedTs = p.openedAt.get(cardId);
        if (openedTs) {
            const elapsedSec = Math.floor((Date.now() - openedTs) / 1000);
            p.correctTimes.push(elapsedSec);
            if (elapsedSec <= 60) speedBonus = 5;
            else if (elapsedSec <= 120) speedBonus = 3;
        }
        delta += speedBonus;
        p.correct += 1;
        p.streak += 1;
        if (p.streak === 2) streakBonus = 5;
        if (p.streak >= 3) streakBonus = 10;
        delta += streakBonus;
    } else {
        delta -= 3;
        p.wrong += 1;
        p.streak = 0;
        p.cooldownUntil = Date.now() + 30_000;
    }

    p.score = Math.max(0, p.score + delta);
    await p.save();

    emitState();
    res.json({ correct: isCorrect, delta, speedBonus, streakBonus, score: p.score });
});

// ---- Admin endpoints ----
app.post("/api/admin/start", async (req, res) => {
    const readyCount = await Player.countDocuments({ photoUrl: { $exists: true }, answers: { $exists: true } });
    if (readyCount < 2)
        return res.status(400).json({ error: "Need at least 2 ready players." });
    
    const g = await getGameState();
    g.status = "live";
    await g.save();
    
    emitState();
    res.json({ ok: true });
});

app.post("/api/admin/end", async (req, res) => {
    const g = await getGameState();
    g.status = "ended";
    await g.save();
    emitState();
    res.json({ ok: true });
});

app.post("/api/admin/reset", async (req, res) => {
    if (MONGO_URI) {
        await Player.deleteMany({});
        const g = await getGameState();
        g.status = "lobby";
        g.sessionCode = Math.floor(100000 + Math.random() * 900000).toString();
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

// ---- Socket.IO ----
io.on("connection", async (socket) => {
    const g = await getGameState();
    const leaderboard = await getLeaderboard();
    const playersCount = await Player.countDocuments();
    const readyCount = await Player.countDocuments({ photoUrl: { $exists: true }, answers: { $exists: true } });

    socket.emit("state", {
        status: g.status,
        playersCount,
        readyCount,
        cardsCount: readyCount,
        leaderboard
    });
});

// ---- Start ----
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n  🎮  Now You Know Me — Server running at http://localhost:${PORT}`);
});
