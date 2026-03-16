const fs = require('fs');
let c = fs.readFileSync('public/index.html', 'utf8');

const newFn = `                // ──────────────────────────────────────────────────────────────
                // Speech Bubble Helper
                //   side = 'right' → bubble to the RIGHT, arrow points left ⬅
                //   side = 'above' → bubble ABOVE head, arrow points down  ↓
                // ──────────────────────────────────────────────────────────────
                function showDialogue(model, name, text, durationS, side = 'right') {
                    return new Promise(resolve => {
                        const bubble = document.getElementById("speechBubble");
                        const arrowEl = document.getElementById("sbArrow");
                        document.getElementById("sbName").textContent = name;
                        document.getElementById("sbText").textContent = text;
                        bubble.style.display = "block";

                        if (side === 'right') {
                            // Bubble sits to the RIGHT of the character, arrow points left
                            bubble.style.transform = "translate(8%, -50%)";
                            arrowEl.style.cssText = [
                                "position:absolute", "top:50%", "left:-16px", "bottom:auto", "right:auto",
                                "transform:translateY(-50%)", "width:0", "height:0",
                                "border-top:10px solid transparent", "border-bottom:10px solid transparent",
                                "border-right:16px solid #0ea5e9"
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

                            if (side === 'right') {
                                // bubble occupies [screenX + offset, screenX + offset + bubbleW]
                                screenX = Math.max(10, screenX);
                                screenX = Math.min(window.innerWidth - bubbleW - 20, screenX);
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

// Replace the function
const startMarker = 'function showDialogue(model, name, text, durationS';
const si = c.indexOf(startMarker);
const commentStart = c.lastIndexOf('// ───', si);
let depth = 0;
let ei = si;
for (; ei < c.length; ei++) {
    if (c[ei] === '{') depth++;
    if (c[ei] === '}') {
        depth--;
        if (depth === 0) break;
    }
}
c = c.substring(0, commentStart) + newFn + c.substring(ei + 1);

// Update calls from 'left' to 'right'
c = c.split(", 'left'").join(", 'right'");

fs.writeFileSync('public/index.html', c);
console.log('Dialogue moved to RIGHT side!');
