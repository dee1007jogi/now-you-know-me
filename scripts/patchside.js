const fs = require('fs');
let c = fs.readFileSync('public/index.html', 'utf8');

const oldFn = `                // ──────────────────────────────────────────────────────────────
                // Speech Bubble Helper – positions bubble above the model head
                // ──────────────────────────────────────────────────────────────
                function showDialogue(model, name, text, durationS) {`;

if (!c.includes(oldFn.trim().split('\n')[0])) {
    // find the marker a different way
    console.log('Using alternate search...');
}

const newFn = `                // ──────────────────────────────────────────────────────────────
                // Speech Bubble Helper
                //   side = 'left'  → bubble to the LEFT, arrow points right ➡
                //   side = 'above' → bubble ABOVE head, arrow points down  ↓
                // ──────────────────────────────────────────────────────────────
                function showDialogue(model, name, text, durationS, side = 'left') {
                    return new Promise(resolve => {
                        const bubble = document.getElementById("speechBubble");
                        const arrowEl = document.getElementById("sbArrow");
                        document.getElementById("sbName").textContent = name;
                        document.getElementById("sbText").textContent = text;
                        bubble.style.display = "block";

                        if (side === 'left') {
                            // Bubble sits to the LEFT of the character, arrow points right
                            bubble.style.transform = "translate(-108%, -50%)";
                            arrowEl.style.cssText = [
                                "position:absolute", "top:50%", "right:-16px", "bottom:auto", "left:auto",
                                "transform:translateY(-50%)", "width:0", "height:0",
                                "border-top:10px solid transparent", "border-bottom:10px solid transparent",
                                "border-left:16px solid #0ea5e9"
                            ].join(";") + ";";
                        } else {
                            // Bubble sits ABOVE the head, arrow points down
                            bubble.style.transform = "translate(-50%, -100%)";
                            arrowEl.style.cssText = [
                                "position:absolute", "bottom:-16px", "left:50%", "top:auto", "right:auto",
                                "transform:translateX(-50%)", "width:0", "height:0",
                                "border-left:12px solid transparent", "border-right:12px solid transparent",
                                "border-top:16px solid #0ea5e9"
                            ].join(";") + ";";
                        }

                        // Y offset in world units above the model root (feet)
                        const headOffsetY = side === 'above' ? 2.5 : 0.6;

                        let rafId = null;
                        let done = false;

                        function trackHead() {
                            if (done) return;
                            const worldPos = new THREE.Vector3();
                            model.getWorldPosition(worldPos);
                            worldPos.y += headOffsetY;

                            const ndc = worldPos.clone().project(engine.camera);
                            let screenX = (ndc.x * 0.5 + 0.5) * window.innerWidth;
                            let screenY = (1 - (ndc.y * 0.5 + 0.5)) * window.innerHeight;

                            const bubbleW = bubble.offsetWidth  || 280;
                            const bubbleH = bubble.offsetHeight || 120;

                            if (side === 'left') {
                                screenX = Math.max(bubbleW + 20, screenX);
                                screenX = Math.min(window.innerWidth - 20, screenX);
                                screenY = Math.max(bubbleH / 2 + 10, Math.min(window.innerHeight - bubbleH / 2 - 10, screenY));
                            } else {
                                screenX = Math.max(bubbleW / 2 + 10, Math.min(window.innerWidth - bubbleW / 2 - 10, screenX));
                                screenY = Math.max(bubbleH + 30, Math.min(window.innerHeight - 20, screenY));
                            }

                            bubble.style.left = screenX + "px";
                            bubble.style.top  = screenY + "px";

                            rafId = requestAnimationFrame(trackHead);
                        }

                        trackHead();
                        gsap.to(bubble, { opacity: 1, duration: 0.35, ease: "back.out(1.7)" });

                        setTimeout(() => {
                            gsap.to(bubble, {
                                opacity: 0, duration: 0.3, ease: "power2.in",
                                onComplete: () => {
                                    done = true;
                                    cancelAnimationFrame(rafId);
                                    bubble.style.display = "none";
                                    resolve();
                                }
                            });
                        }, durationS * 1000);
                    });
                }`;

// Find the function start to end
const startMarker = 'function showDialogue(model, name, text, durationS) {';
const si = c.indexOf(startMarker);
if (si === -1) { console.error('showDialogue start not found'); process.exit(1); }

// find the closing brace of the function
// walk forward, counting braces
let depth = 0;
let ei = si;
for (; ei < c.length; ei++) {
    if (c[ei] === '{') depth++;
    if (c[ei] === '}') {
        depth--;
        if (depth === 0) break;
    }
}

// also include the surrounding comment block
const commentStart = c.lastIndexOf('// ───', si);

c = c.substring(0, commentStart) + newFn + c.substring(ei + 1);

// Now patch all showDialogue calls – add side parameter
// Steps 1-5 (before fox enters): side = 'left'  (Owl talking while alone)
// Steps 6+ (after fox enters):   side = 'above'

// Steps 1-5 owl speech (Welcome, Professor Hoot-1, thoughtful analyst, And now, Hey crazy)
const leftLines = [
    'Wise Owl", "Welcome,',
    'Professor Hoot", "I\'',
    'Professor Hoot", "Meet',
    'Professor Hoot", "And now',
    'Professor Hoot", "Hey crazy',
];
for (const frag of leftLines) {
    const idx = c.indexOf('await showDialogue(owl.model, "' + frag.split('"')[0]);
    // Just find by fragment
    const search = frag;
    let pos = c.indexOf(search);
    if (pos === -1) { console.warn('NOT FOUND:', search); continue; }
    // find the closing ); of the showDialogue call after pos
    const callEnd = c.indexOf(');', pos);
    // insert , 'left' before );
    c = c.substring(0, callEnd) + ", 'left'" + c.substring(callEnd);
}

// Steps 6+ owl chuckle, fox speech, owl final, all three: side = 'above'
const aboveFrags = [
    'Professor Hoot", "Yaa',
    'Professor Hoot", "Now that',
    'Playful Fox", "Hey everyone',
    'ALL THREE", "Join',
];
for (const frag of aboveFrags) {
    const pos = c.indexOf(frag);
    if (pos === -1) { console.warn('NOT FOUND:', frag); continue; }
    const callEnd = c.indexOf(');', pos);
    c = c.substring(0, callEnd) + ", 'above'" + c.substring(callEnd);
}

fs.writeFileSync('public/index.html', c);
console.log('showDialogue rewritten and all calls patched!');
