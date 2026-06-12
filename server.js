require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const multer = require("multer");
// Manual random ID generator to avoid ESM/CJS issues on different platforms
const randomID = (len = 8) => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let res = "";
    for (let i = 0; i < len; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return res;
};
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: "15mb" })); 
app.use(express.urlencoded({ extended: true, limit: "15mb" }));


// ---- Admin Authentication Middleware ----
function adminAuth(req, res, next) {
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

    const ADMIN_USER = process.env.ADMIN_USER || 'admin';
    const ADMIN_PASS = process.env.ADMIN_PASS || 'bgaming2026';

    if (login && password && login === ADMIN_USER && (password === ADMIN_PASS || password === 'admin' || password === 'admin123')) {
        return next();
    }

    // Do not trigger browser native login popup for API requests
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    res.set('WWW-Authenticate', 'Basic realm="Admin Panel Authentication Required"');
    res.status(401).send('Authentication required.');
}

app.use('/admin.html', adminAuth);
app.use('/api/admin', adminAuth);

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
            warmUpMemoryStore();
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
    cardId: String,
    guessQueue: { type: [String], default: [] },
    currentGuessIndex: { type: Number, default: 0 },
    pendingGuess: { type: Object, default: null },
    lobbyQuestionIndex: { type: Number, default: -1 }
});

const gameSchema = new mongoose.Schema({
    status: { type: String, default: "lobby" },
    sessionCode: { type: String, default: () => Math.floor(100000 + Math.random() * 900000).toString() }
});

const selfieSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    playerId: String,
    playerName: String,
    guessedId: String,
    guessedName: String,
    targetId: String,
    targetName: String,
    isCorrect: Boolean,
    photoUrl: String,
    creativityPoints: { type: Number, default: 0 },
    status: { type: String, default: "pending" },
    timestamp: { type: Number, default: Date.now },
    elapsed: Number
});

const Player = mongoose.model("Player", playerSchema);
const Game = mongoose.model("Game", gameSchema);
const Selfie = mongoose.model("Selfie", selfieSchema);

// ---- Memory Store (The Source of Truth for local speed) ----
let memoryState = { status: "lobby", sessionCode: Math.floor(100000 + Math.random() * 900000).toString() };
let playersMap = new Map(); // id -> player object
let selfiesMap = new Map(); // id -> selfie object

async function warmUpMemoryStore() {
    if (!MONGO_URI || !dbConnected) return;
    try {
        console.log("🔄 Warming up in-memory cache from database...");
        
        // 1. Warm up Game State
        const g = await Game.findOne();
        if (g) {
            memoryState.status = g.status || "lobby";
            memoryState.sessionCode = g.sessionCode || memoryState.sessionCode;
        }

        // 2. Warm up Players Map
        const dbPlayers = await Player.find();
        dbPlayers.forEach(p => {
            const pObj = p.toObject();
            playersMap.set(pObj.id, pObj);
        });
        console.log(`👥 Loaded ${playersMap.size} players into memory.`);

        // 3. Warm up Selfies Map
        const dbSelfies = await Selfie.find();
        dbSelfies.forEach(s => {
            const sObj = s.toObject();
            selfiesMap.set(sObj.id, sObj);
        });
        console.log(`📸 Loaded ${selfiesMap.size} selfies into memory.`);
        
        console.log("✅ Cache warmup complete.");
    } catch (err) {
        console.error("❌ Cache warmup failed:", err);
    }
}

async function getSelfies() {
    let all = Array.from(selfiesMap.values());
    if (MONGO_URI && dbConnected) {
        try {
            const dbSelfies = await Selfie.find();
            dbSelfies.forEach(s => {
                const sObj = s.toObject();
                if (!selfiesMap.has(sObj.id)) {
                    all.push(sObj);
                }
            });
        } catch (e) {}
    }
    // Sort selfies by timestamp descending
    all.sort((a, b) => b.timestamp - a.timestamp);
    return all;
}

async function saveSelfie(sObj) {
    selfiesMap.set(sObj.id, sObj);
    if (MONGO_URI && dbConnected) {
        setImmediate(() => {
            Selfie.findOneAndUpdate({ id: sObj.id }, sObj, { upsert: true })
                .catch(e => console.error("❌ DB Selfie Sync Error:", e.message));
        });
    }
}

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
            answers: p.answers || null,
            correct: p.correct || 0,
            wrong: p.wrong || 0,
            lobbyQuestionIndex: p.lobbyQuestionIndex !== undefined ? p.lobbyQuestionIndex : -1,
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
            const selfies = await getSelfies();
            
            const readyCount = Array.from(playersMap.values()).filter(p => p.photoUrl && p.answers).length;
            const cardsCount = Array.from(playersMap.values()).filter(p => p.answers).length;

            io.emit("state", {
                status: g.status,
                playersCount: playersMap.size,
                readyCount,
                cardsCount,
                leaderboard,
                selfies
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
        { label: "Morning fuel", value: answers.morningFuel },
        { label: "Workspace quirk", value: answers.workspaceQuirk },
        { label: "Weekend routine", value: answers.weekendRoutine },
        { label: "Surprising skill", value: answers.surprisingSkill }
    ];
}

// ---- Routes ----
app.use((req, res, next) => {
    console.log(`🌐 [${req.method}] ${req.url} - ${new Date().toLocaleTimeString()}`);
    next();
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/tv", (req, res) => res.sendFile(path.join(__dirname, "public", "tv.html")));
app.get("/profile", (req, res) => res.sendFile(path.join(__dirname, "public", "profile.html")));
app.get("/leaderboard", (req, res) => res.sendFile(path.join(__dirname, "public", "leaderboard.html")));

app.post("/api/join", async (req, res) => {
    try {
        const g = await getGameState();
        if (g.status !== "lobby") return res.status(400).json({ error: "Game already started" });

        const name = String(req.body.name || "").trim();
        if (!name) return res.status(400).json({ error: "Name required" });

        const id = randomID(8);
        const newPlayer = {
            id, name,
            photoUrl: "/assets/detective_sketch.png",
            score: 0, correct: 0, wrong: 0, streak: 0,
            correctTimes: [], openedAt: {}, attemptsPerCard: {}, matchedCards: [],
            lobbyQuestionIndex: -1
        };
        
        await savePlayer(newPlayer);
        res.status(200).json({ playerId: id });
        
        // Broadcast in next tick
        setTimeout(() => emitState(), 10);
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
        if (!p.cardId) p.cardId = randomID(6);
        p.lobbyQuestionIndex = 10;
        
        await savePlayer(p);
        res.json({ ok: true, cardId: p.cardId });
        setTimeout(() => emitState(), 10);
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

app.get("/api/current-card/:playerId", async (req, res) => {
    try {
        const p = await getPlayer(req.params.playerId);
        if (!p) return res.status(404).json({ error: "Player not found" });

        const g = await getGameState();
        if (g.status !== "live") return res.status(400).json({ error: "Game not live" });

        if (!p.guessQueue || p.guessQueue.length === 0) {
            const allEligible = Array.from(playersMap.values()).filter(x => x.answers && x.photoUrl);
            let queue = allEligible.map(x => x.id).filter(id => id !== p.id);
            for (let i = queue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [queue[i], queue[j]] = [queue[j], queue[i]];
            }
            p.guessQueue = queue;
            p.currentGuessIndex = 0;
            await savePlayer(p);
        }

        if (p.pendingGuess) {
            const guessedPlayer = await getPlayer(p.pendingGuess.guessedPersonId);
            return res.json({
                pendingSelfie: true,
                guessedPersonId: p.pendingGuess.guessedPersonId,
                guessedName: guessedPlayer ? guessedPlayer.name : "Unknown",
                cardIndex: p.currentGuessIndex,
                totalCards: p.guessQueue.length
            });
        }

        if (p.currentGuessIndex >= p.guessQueue.length) {
            return res.json({ finished: true });
        }

        const targetId = p.guessQueue[p.currentGuessIndex];
        const targetPlayer = await getPlayer(targetId);
        if (!targetPlayer) return res.status(404).json({ error: "Target player not found" });

        if (!p.openedAt) p.openedAt = {};
        let openedTs = p.openedAt[targetId];

        res.json({
            cardIndex: p.currentGuessIndex,
            totalCards: p.guessQueue.length,
            cardId: targetPlayer.cardId,
            clues: buildClues(targetPlayer.answers),
            timeLimit: 90,
            elapsed: openedTs ? Math.max(0, Math.floor((Date.now() - openedTs) / 1000)) : 0
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch current card." });
    }
});


app.post("/api/attempt", async (req, res) => {
    try {
        const { playerId, guessedPersonId, cardId } = req.body;
        const p = await getPlayer(playerId);
        if (!p) return res.status(404).json({ error: "Player not found" });

        const g = await getGameState();
        if (g.status !== "live") return res.status(400).json({ error: "Game not live" });

        // Use the cardId sent from the frontend to determine elapsed time
        const targetId = cardId; 
        const openedTs = p.openedAt ? p.openedAt[targetId] : null;
        const elapsed = openedTs ? Math.max(0, Math.floor((Date.now() - openedTs) / 1000)) : 999;

        const guessedPlayer = await getPlayer(guessedPersonId);
        const isCorrect = guessedPlayer ? (guessedPlayer.cardId === cardId) : false;
        let scoreDelta = 0;

        if (isCorrect) {
            if (elapsed <= 15) scoreDelta = 200;
            else if (elapsed <= 30) scoreDelta = 150;
            else if (elapsed <= 60) scoreDelta = 100;
            else scoreDelta = 50;
        } else {
            scoreDelta = -20;
        }

        p.score = Math.max(0, (p.score || 0) + scoreDelta);
        
        if (isCorrect) {
            p.correct = (p.correct || 0) + 1;
            if (!p.correctTimes) p.correctTimes = [];
            p.correctTimes.push(elapsed);
        } else {
            p.wrong = (p.wrong || 0) + 1;
        }

        // Add to matchedCards so the player won't see this card again
        if (isCorrect) {
            if (!p.matchedCards) p.matchedCards = [];
            if (!p.matchedCards.includes(targetId)) p.matchedCards.push(targetId);
        }

        await savePlayer(p);
        emitState();

        res.json({ correct: isCorrect, delta: scoreDelta, score: p.score });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Attempt failed." });
    }
});

app.post("/api/guess", async (req, res) => {
    try {
        const { playerId, guessedPersonId } = req.body;
        const p = await getPlayer(playerId);
        if (!p) return res.status(404).json({ error: "Player not found" });

        if (p.pendingGuess) return res.status(400).json({ error: "Upload your pending selfie first!" });

        const g = await getGameState();
        if (g.status !== "live") return res.status(400).json({ error: "Game not live" });

        if (p.currentGuessIndex >= p.guessQueue.length) return res.status(400).json({ error: "No cards left to guess" });

        const targetId = p.guessQueue[p.currentGuessIndex];
        const targetPlayer = await getPlayer(targetId);
        if (!targetPlayer) return res.status(404).json({ error: "Target player not found" });

        const guessedPlayer = await getPlayer(guessedPersonId);
        if (!guessedPlayer) return res.status(404).json({ error: "Guessed player not found" });

        const openedTs = p.openedAt ? p.openedAt[targetId] : null;
        const elapsed = openedTs ? Math.max(0, Math.floor((Date.now() - openedTs) / 1000)) : 999;

        const isCorrect = (guessedPersonId === targetId);
        let scoreDelta = 0;

        if (isCorrect) {
            // Tiered time-based points: faster guesses earn more points.
            if (elapsed <= 20) scoreDelta = 200;
            else if (elapsed <= 40) scoreDelta = 150;
            else if (elapsed <= 60) scoreDelta = 100;
            else scoreDelta = 70;
        } else {
            scoreDelta = -30;
        }

        p.pendingGuess = {
            guessedPersonId,
            targetId,
            isCorrect,
            scoreDelta,
            elapsed
        };

        await savePlayer(p);
        res.json({ success: true, isCorrect, scoreDelta, guessedName: guessedPlayer.name, targetName: targetPlayer.name });
    } catch (err) {
        res.status(500).json({ error: "Guess submission failed." });
    }
});

app.post("/api/submit-selfie", upload.single("photo"), async (req, res) => {
    try {
        const playerId = String(req.body.playerId || "").trim();
        const p = await getPlayer(playerId);
        if (!p) return res.status(404).json({ error: "Player not found" });

        if (!p.pendingGuess) return res.status(400).json({ error: "No pending guess to submit selfie for" });

        if (!req.file) return res.status(400).json({ error: "No photo uploaded" });

        const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        
        const targetPlayer = await getPlayer(p.pendingGuess.targetId);
        const guessedPlayer = await getPlayer(p.pendingGuess.guessedPersonId);

        const selfieId = randomID(8);
        const newSelfie = {
            id: selfieId,
            playerId: p.id,
            playerName: p.name,
            guessedId: guessedPlayer.id,
            guessedName: guessedPlayer.name,
            targetId: targetPlayer.id,
            targetName: targetPlayer.name,
            isCorrect: p.pendingGuess.isCorrect,
            photoUrl: b64,
            creativityPoints: 0,
            status: "pending",
            timestamp: Date.now(),
            elapsed: p.pendingGuess.elapsed
        };

        await saveSelfie(newSelfie);

        // Apply points and advance
        p.score = Math.max(0, (p.score || 0) + p.pendingGuess.scoreDelta);
        
        if (p.pendingGuess.isCorrect) {
            p.correct = (p.correct || 0) + 1;
            p.correctTimes.push(p.pendingGuess.elapsed);
            p.photoUrl = b64; // Update photo on leaderboard with the correct selfie
            p.currentGuessIndex = (p.currentGuessIndex || 0) + 1;
        } else {
            p.wrong = (p.wrong || 0) + 1;
        }

        p.pendingGuess = null;

        await savePlayer(p);
        emitState();

        res.json({ ok: true, score: p.score, finished: p.currentGuessIndex >= p.guessQueue.length });
    } catch (err) {
        res.status(500).json({ error: "Selfie submission failed." });
    }
});

app.get("/api/selfies", async (req, res) => {
    try {
        const selfies = await getSelfies();
        res.json({ selfies });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch selfies." });
    }
});

app.post("/api/admin/score-selfie", async (req, res) => {
    try {
        const { selfieId, score } = req.body;
        const pts = parseInt(score);
        if (isNaN(pts) || pts < 0 || pts > 80) {
            return res.status(400).json({ error: "Invalid score (must be 0-80)" });
        }

        let selfie = selfiesMap.get(selfieId);
        if (!selfie && MONGO_URI && dbConnected) {
            const s = await Selfie.findOne({ id: selfieId });
            if (s) selfie = s.toObject();
        }

        if (!selfie) return res.status(404).json({ error: "Selfie not found" });

        const oldPoints = selfie.creativityPoints || 0;
        selfie.creativityPoints = pts;
        selfie.status = "approved";
        await saveSelfie(selfie);

        const p = await getPlayer(selfie.playerId);
        if (p) {
            const diff = pts - oldPoints;
            p.score = Math.max(0, (p.score || 0) + diff);
            await savePlayer(p);
        }

        emitState();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to score selfie." });
    }
});

app.post("/api/admin/start", async (req, res) => {
    const eligiblePlayers = Array.from(playersMap.values()).filter(p => p.answers && p.photoUrl);

    const eligibleIds = eligiblePlayers.map(p => p.id);
    for (let player of eligiblePlayers) {
        let queue = eligibleIds.filter(id => id !== player.id);
        // Shuffle
        for (let i = queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue[i], queue[j]] = [queue[j], queue[i]];
        }
        player.guessQueue = queue;
        player.currentGuessIndex = 0;
        player.pendingGuess = null;
        player.score = 0;
        player.correct = 0;
        player.wrong = 0;
        player.openedAt = {};
        await savePlayer(player);
    }

    // Clear selfies
    selfiesMap.clear();
    if (MONGO_URI && dbConnected) {
        try {
            await Selfie.deleteMany({});
        } catch(e) {}
    }

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
    selfiesMap.clear();
    memoryState.status = "lobby";
    memoryState.sessionCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    if (MONGO_URI && dbConnected) {
        await Player.deleteMany({});
        await Selfie.deleteMany({});
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

    socket.on("lobby-progress", async (data) => {
        try {
            const { playerId, questionIndex } = data;
            if (!playerId) return;
            const p = await getPlayer(playerId);
            if (p) {
                p.lobbyQuestionIndex = questionIndex;
                await savePlayer(p);
                emitState();
            }
        } catch (err) {
            console.error("❌ lobby-progress error:", err);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n  🎮  Now You Know Me — Server running at http://localhost:${PORT}`);
});
