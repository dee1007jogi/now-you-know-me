const fs = require('fs');
const jsFile = 'c:\\Users\\deeva\\.gemini\\antigravity\\scratch\\now-you-know-me\\public\\player.js';
let js = fs.readFileSync(jsFile, 'utf8');

// Find end of updateUI(s) function to inject updatePersonalDossier()
if (js.includes('updatePersonalDossier()')) {
    // We only need to inject it into updateUI if it's not already there
    if (!js.includes('if(typeof updatePersonalDossier === "function") updatePersonalDossier();')) {
        // updateUI ends near line 515. Let's just find the socket.on("state", s => { updateUI(s); })
        // and do it there.
        js = js.replace('socket.on("state", s => {', 'socket.on("state", s => {\n    if(typeof updatePersonalDossier === "function") updatePersonalDossier();');
        fs.writeFileSync(jsFile, js);
        console.log("Wired up updatePersonalDossier successfully.");
    } else {
        console.log("Already wired.");
    }
}
