const fs = require('fs');

const file = 'c:\\Users\\deeva\\.gemini\\antigravity\\scratch\\now-you-know-me\\public\\admin.html';
let content = fs.readFileSync(file, 'utf8');

// 1. Update Sidebar Links
const oldSidebar = `                    <button id="navLobbyBtn" class="sidebar-link">
                        <span>🏠 Lobby</span>
                    </button>
                    <button id="navAdminBtn" class="sidebar-link active">
                        <span>🔧 Admin Panel</span>
                    </button>
                    <button id="navLeaderboardBtn" class="sidebar-link">
                        <span>📊 Leaderboard</span>
                    </button>`;
const newSidebar = `                    <button id="navIntelligenceBtn" class="sidebar-link">
                        <span>🌐 Intelligence Hub</span>
                    </button>
                    <button id="navAdminBtn" class="sidebar-link active">
                        <span>🔧 Admin Panel</span>
                    </button>`;
content = content.replace(oldSidebar, newSidebar);

// 2. Rename tabLobbyContent to tabIntelligenceContent
content = content.replace(
    '<!-- VIEW 1: LOBBY CONTENT -->\n                <div id="tabLobbyContent" class="hidden">',
    '<!-- COMBINED VIEW: INTELLIGENCE HUB -->\n                <div id="tabIntelligenceContent" class="hidden">'
);

// 3. Extract leaderboard content
const leaderboardRegex = /<!-- VIEW 3: LEADERBOARD CONTENT -->\s*<div id="tabLeaderboardContent" class="hidden">([\s\S]*?)<\/div>\s*<\/div>\s*<\/main>/;
const match = content.match(leaderboardRegex);
if (match) {
    let leaderboardInner = match[1]; // the workspace-grid and its contents
    
    // Add some spacing/title between the lobby split grid and the leaderboard
    leaderboardInner = `\n                    <h3 style="margin-top: 40px; margin-bottom: 20px; color: var(--gold-bright); text-transform: uppercase; letter-spacing: 1px;">📡 Live Tracking & Dossiers</h3>` + leaderboardInner;
    
    // Remove the original leaderboard block
    content = content.replace(match[0], '            </div>\n        </main>');
    
    // Insert the leaderboard inner content right before the end of tabIntelligenceContent
    // The tabIntelligenceContent ends right before "<!-- VIEW 2: ADMIN CONTENT"
    content = content.replace(
        '                    </div>\n                </div>\n\n                <!-- VIEW 2: ADMIN CONTENT',
        '                    </div>' + leaderboardInner + '\n                </div>\n\n                <!-- VIEW 2: ADMIN CONTENT'
    );
    
    fs.writeFileSync(file, content);
    console.log("Successfully combined tabs in admin.html.");
} else {
    console.log("Could not find Leaderboard content to extract.");
}
