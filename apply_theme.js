const fs = require('fs');

const file = 'c:\\Users\\deeva\\.gemini\\antigravity\\scratch\\now-you-know-me\\public\\admin.html';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace Font
content = content.replace(
    /@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Cinzel.*?'\);/,
    `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">`
);

// Replace all instances of 'Cinzel', serif with 'Inter', sans-serif
content = content.replace(/'Cinzel', serif/g, "'Inter', sans-serif");
content = content.replace(/font-family:\s*'Outfit'/g, "font-family:'Inter'");
content = content.replace(/font-family:\s*'Lexend'/g, "font-family:'Inter'");

// 2. CSS Variables
content = content.replace(/--navy-deep:\s*#0c0c0e;/g, "--navy-deep: #0A0F1A;");
content = content.replace(/--navy-dark:\s*#121214;/g, "--navy-dark: #0D1322;");
content = content.replace(/--gold-bright:\s*#B95F00;/g, "--gold-bright: #00E5FF;");
content = content.replace(/--gold-muted:\s*#9a4e00;/g, "--gold-muted: #00B3CC;");
content = content.replace(/--neon-cyan:\s*#10B981;/g, "--neon-cyan: #00E5FF;");
content = content.replace(/--neon-blue:\s*#6366F1;/g, "--neon-blue: #00E5FF;");
content = content.replace(/--glass-bg:\s*rgba\(24, 24, 27, 0\.7\);/g, "--glass-bg: rgba(10, 15, 26, 0.85);");
content = content.replace(/--glass-border:\s*rgba\(255, 255, 255, 0\.08\);/g, "--glass-border: rgba(0, 229, 255, 0.15);\n            --success: #00C853;\n            --error: #FF1744;\n            --warning: #FFEA00;");

// 3. UI Elements
content = content.replace(/<span>🕵️‍♂️<\/span> GAME HUB/g, "<span style=\"color:var(--neon-cyan);\">⬢</span> HELIX CONTROL");
content = content.replace(/<h1>Now You Know Me<\/h1>/g, "<h1>HELIX CONTROL</h1>");
content = content.replace(/<span class="header-badge">Admin<\/span>/g, "<span class=\"header-badge\">Global Operator</span>");

// 4. Focus visible for accessibility
content = content.replace(/\* \{\n\s*margin: 0;/, "* {\n            margin: 0;\n        }\n\n        *:focus-visible {\n            outline: 3px solid var(--neon-cyan);\n            outline-offset: 2px;\n        }\n\n        * {");

// 5. Update Status Pills (missing -> error, ok -> success)
content = content.replace(/background:\s*rgba\(239, 68, 68, 0\.15\);\s*color:\s*#ef4444;/g, "background: rgba(255, 23, 68, 0.15);\n            color: var(--error);");
content = content.replace(/background:\s*rgba\(16, 185, 129, 0\.15\);\s*color:\s*#10b981;/g, "background: rgba(0, 200, 83, 0.15);\n            color: var(--success);");
content = content.replace(/background:\s*rgba\(251, 191, 36, 0\.15\);\s*color:\s*#fbbf24;/g, "background: rgba(255, 234, 0, 0.15);\n            color: var(--warning);");

// Danger Zone & buttons
content = content.replace(/#ef4444/g, "var(--error)");

fs.writeFileSync(file, content);
console.log('Successfully updated admin.html with Helix Control theme.');
