const fs = require('fs');

const jsFile = 'c:\\Users\\deeva\\.gemini\\antigravity\\scratch\\now-you-know-me\\server.js';
let js = fs.readFileSync(jsFile, 'utf8');

const attemptEndpoint = `
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

        const isCorrect = (guessedPersonId === targetId);
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
`;

if (!js.includes('app.post("/api/attempt"')) {
    js = js.replace('app.post("/api/guess",', attemptEndpoint + '\napp.post("/api/guess",');
    fs.writeFileSync(jsFile, js);
    console.log("Injected /api/attempt into server.js");
} else {
    console.log("Already injected.");
}
