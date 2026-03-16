const express = require("express");
const http = require("http");
const path = require("path");
const multer = require("multer");
const { nanoid } = require("nanoid");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---- File upload setup (local disk) ----
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, "uploads")),
    filename: (req, file, cb) =>
        cb(null, `${Date.now()}-${nanoid(6)}${path.extname(file.originalname || ".jpg")}`)
});
const upload = multer({
    storage,
    limits: { fileSize: 1 * 1024 * 1024 } // 1 MB
});

// ---- In-memory state (MVP) ----
const state = {
    status: "lobby", // lobby | live | ended
    players: new Map(),
    cards: [],
    attempts: [],
    sessionCode: Math.floor(100000 + Math.random() * 900000).toString() // 6-digit random code
};

function now() { return Date.now(); }
function clampScore(x) { return Math.max(0, x); }

function getLeaderboard() {
    const arr = Array.from(state.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        photoUrl: p.photoUrl,
        score: p.score,
        correct: p.correct,
        wrong: p.wrong,
        accuracy: (p.correct + p.wrong)
            ? Math.round((p.correct / (p.correct + p.wrong)) * 100)
            : 0,
        avgCorrectSec: p.correctTimes.length
            ? Math.round(p.correctTimes.reduce((a, b) => a + b, 0) / p.correctTimes.length)
            : null
    }));

    arr.sort((a, b) =>
        (b.score - a.score) ||
        (b.correct - a.correct) ||
        (a.wrong - b.wrong) ||
        ((a.avgCorrectSec ?? 999999) - (b.avgCorrectSec ?? 999999))
    );
    return arr;
}

function emitState() {
    io.emit("state", {
        status: state.status,
        playersCount: state.players.size,
        readyCount: Array.from(state.players.values()).filter(p => p.photoUrl && p.answers).length,
        cardsCount: state.cards.length,
        leaderboard: getLeaderboard()
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
app.post("/api/join", (req, res) => {
    if (state.status !== "lobby")
        return res.status(400).json({ error: "Game already started" });

    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Name required" });

    const id = nanoid(8);
    state.players.set(id, {
        id,
        name,
        photoUrl: null,
        answers: null,
        score: 0,
        correct: 0,
        wrong: 0,
        streak: 0,
        cooldownUntil: 0,
        openedAt: {},
        attemptsPerCard: {},
        correctTimes: []
    });

    emitState();
    res.json({ playerId: id });
});

// ---- API: Upload photo ----
app.post("/api/upload-photo", upload.single("photo"), (req, res) => {
    const playerId = String(req.body.playerId || "").trim();
    const p = state.players.get(playerId);
    if (!p) return res.status(404).json({ error: "Player not found" });
    if (state.status !== "lobby")
        return res.status(400).json({ error: "Cannot upload after start" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    p.photoUrl = `/uploads/${req.file.filename}`;
    emitState();
    res.json({ ok: true, photoUrl: p.photoUrl });
});

// ---- API: Submit answers ----
app.post("/api/submit-answers", (req, res) => {
    const { playerId, answers } = req.body;
    const p = state.players.get(playerId);
    if (!p) return res.status(404).json({ error: "Player not found" });
    if (state.status !== "lobby")
        return res.status(400).json({ error: "Cannot submit after start" });

    const required = [
        "workStyle", "teamRole", "meetingPower",
        "breakStyle", "updatesVia", "recharge", "surprisingSkill"
    ];
    for (const k of required) {
        if (!answers || !String(answers[k] || "").trim())
            return res.status(400).json({ error: `Missing: ${k}` });
    }

    // Profanity filter (basic MVP)
    const bad = ["fuck", "shit", "bitch", "asshole"];
    const skillLower = String(answers.surprisingSkill).toLowerCase();
    if (bad.some(w => skillLower.includes(w)))
        return res.status(400).json({ error: "Please keep it professional." });

    p.answers = answers;

    // Create / replace card
    const existing = state.cards.find(c => c.ownerId === p.id);
    const cardObj = {
        cardId: existing ? existing.cardId : nanoid(6),
        ownerId: p.id,
        clues: buildClues(answers)
    };
    if (existing) {
        state.cards = state.cards.map(c => (c.ownerId === p.id ? cardObj : c));
    } else {
        state.cards.push(cardObj);
    }

    emitState();
    res.json({ ok: true, cardId: cardObj.cardId });
});

// ---- API: Get mystery cards for player ----
app.get("/api/cards/:playerId", (req, res) => {
    const p = state.players.get(req.params.playerId);
    if (!p) return res.status(404).json({ error: "Player not found" });
    if (state.status !== "live")
        return res.status(400).json({ error: "Game not live" });

    const cards = state.cards
        .filter(c => c.ownerId !== p.id)
        .map(c => ({ cardId: c.cardId, clues: c.clues }));
    res.json({ cards });
});

// ---- API: Get photo grid (participants) ----
app.get("/api/people/:playerId", (req, res) => {
    const p = state.players.get(req.params.playerId);
    if (!p) return res.status(404).json({ error: "Player not found" });
    if (state.status !== "live")
        return res.status(400).json({ error: "Game not live" });

    const people = Array.from(state.players.values())
        .filter(x => x.id !== p.id && x.photoUrl)
        .map(x => ({ id: x.id, name: x.name, photoUrl: x.photoUrl }));

    // Shuffle to prevent copying
    for (let i = people.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [people[i], people[j]] = [people[j], people[i]];
    }
    res.json({ people });
});

// ---- API: Open card (start speed-bonus timer) ----
app.post("/api/open-card", (req, res) => {
    const { playerId, cardId } = req.body;
    const p = state.players.get(playerId);
    if (!p) return res.status(404).json({ error: "Player not found" });
    if (state.status !== "live")
        return res.status(400).json({ error: "Game not live" });

    if (!p.openedAt[cardId]) p.openedAt[cardId] = now();
    res.json({ ok: true });
});

// ---- API: Attempt match ----
app.post("/api/attempt", (req, res) => {
    const { playerId, cardId, guessedPersonId } = req.body;
    const p = state.players.get(playerId);
    if (!p) return res.status(404).json({ error: "Player not found" });
    if (state.status !== "live")
        return res.status(400).json({ error: "Game not live" });

    if (now() < p.cooldownUntil)
        return res.status(400).json({ error: "Cooldown active. Wait a moment." });

    const card = state.cards.find(c => c.cardId === cardId);
    if (!card) return res.status(404).json({ error: "Card not found" });
    if (card.ownerId === p.id)
        return res.status(400).json({ error: "You cannot match your own card." });

    // Max 2 attempts per card
    p.attemptsPerCard[cardId] = (p.attemptsPerCard[cardId] || 0) + 1;
    if (p.attemptsPerCard[cardId] > 2)
        return res.status(400).json({ error: "Card locked (max attempts reached)." });

    const isCorrect = card.ownerId === guessedPersonId;
    let delta = 0, speedBonus = 0, streakBonus = 0;

    if (isCorrect) {
        delta += 10;
        const openedTs = p.openedAt[cardId];
        if (openedTs) {
            const elapsedSec = Math.floor((now() - openedTs) / 1000);
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
        p.cooldownUntil = now() + 30_000;
    }

    p.score = clampScore(p.score + delta);

    state.attempts.push({
        ts: now(), playerId, cardId, guessedPersonId,
        correct: isCorrect, delta, speedBonus, streakBonus
    });

    emitState();
    res.json({ correct: isCorrect, delta, speedBonus, streakBonus, score: p.score });
});

// ---- Admin endpoints ----
app.post("/api/admin/start", (req, res) => {
    const ready = Array.from(state.players.values()).filter(p => p.photoUrl && p.answers).length;
    if (ready < 2)
        return res.status(400).json({ error: "Need at least 2 ready players (photo + answers)." });
    state.status = "live";
    emitState();
    res.json({ ok: true });
});

app.post("/api/admin/end", (req, res) => {
    state.status = "ended";
    emitState();
    res.json({ ok: true });
});

app.post("/api/admin/reset", (req, res) => {
    state.status = "lobby";
    state.players = new Map();
    state.cards = [];
    state.attempts = [];
    state.sessionCode = Math.floor(100000 + Math.random() * 900000).toString();
    emitState();
    res.json({ ok: true });
});

app.get("/api/session", (req, res) => {
    res.json({ code: state.sessionCode });
});

app.get("/api/admin/export", (req, res) => {
    const lb = getLeaderboard();
    let csv = "Rank,Name,Score,Matches,Accuracy%\n";
    lb.forEach((p, i) => {
        csv += `${i + 1},"${p.name}",${p.score},${p.correct},${p.accuracy}%\n`;
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=results.csv");
    res.send(csv);
});

// ---- Socket.IO ----
io.on("connection", (socket) => {
    socket.emit("state", {
        status: state.status,
        playersCount: state.players.size,
        readyCount: Array.from(state.players.values()).filter(p => p.photoUrl && p.answers).length,
        cardsCount: state.cards.length,
        leaderboard: getLeaderboard()
    });
});

// ---- Start ----
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n  🎮  Now You Know Me — Server running at http://localhost:${PORT}`);
    console.log(`  👤  Player join:  http://localhost:${PORT}`);
    console.log(`  🛠️   Admin:       http://localhost:${PORT}/admin`);
    console.log(`  📺  TV Mode:      http://localhost:${PORT}/tv\n`);
});
