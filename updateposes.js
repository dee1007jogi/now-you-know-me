const fs = require('fs');
let c = fs.readFileSync('public/index.html', 'utf8');

// 1. Update mascotsData array
const oldMascotsData = `            const mascotsData = [
                {
                    path: '/assets/69b52873-a10a-422d-b509-a3aa87e0f391.glb', // Bunny
                    name: 'bunny',
                    pos: { x: 1.0, y: 0.6, z: 4.0 }, // Calibrated feet to Y=-2.5
                    scale: 2.0,
                    tooltipText: "Let's play!",
                    audio: '/audio/bunny-welcome.mp3'
                },
                {
                    path: '/assets/347b088b-f8fc-4296-84a6-a7db8acfa651.glb', // Owl (Center)
                    name: 'owl',
                    pos: { x: 4.0, y: 0.8, z: 3.3 }, // Calibrated feet to Y=-2.5
                    scale: 3.0,
                    tooltipText: "Hi, I'm Prof. Hoot!",
                    audio: '/audio/owl-welcome.mp3'
                },
                {
                    path: '/assets/35047d21-41d2-40fe-b199-5cb585ed6d35.glb', // Fox (Right)
                    name: 'fox',
                    pos: { x: 11.0, y: 1.0, z: -1.0 }, // Calibrated feet to Y=-2.5
                    scale: 3.0,
                    tooltipText: "Enter your name!",
                    audio: '/audio/fox-welcome.mp3'
                }
            ];`;

const newMascotsData = `            const mascotsData = [
                {
                    path: '/assets/69b52873-a10a-422d-b509-a3aa87e0f391.glb', // Bunny
                    name: 'bunny',
                    pos: { x: 0.5, y: -0.1, z: 5.5 }, 
                    scale: 2.5,
                    tooltipText: "Let's play!",
                    audio: '/audio/bunny-welcome.mp3'
                },
                {
                    path: '/assets/347b088b-f8fc-4296-84a6-a7db8acfa651.glb', // Owl (Center)
                    name: 'owl',
                    pos: { x: 5.0, y: 1.2, z: 2.5 }, 
                    scale: 4.0,
                    tooltipText: "Hi, I'm Prof. Hoot!",
                    audio: '/audio/owl-welcome.mp3'
                },
                {
                    path: '/assets/35047d21-41d2-40fe-b199-5cb585ed6d35.glb', // Fox (Right)
                    name: 'fox',
                    pos: { x: 10.5, y: 1.1, z: 5.0 }, 
                    scale: 3.5,
                    tooltipText: "Enter your name!",
                    audio: '/audio/fox-welcome.mp3'
                }
            ];`;

// Patching the mascotsData
if (c.includes(oldMascotsData)) {
    c = c.replace(oldMascotsData, newMascotsData);
} else {
    // try finding by substrings if formatting differs
    console.warn('Exact mascotsData block match failed, trying fragments...');
    c = c.replace(/pos: \{ x: 1\.0, y: 0\.6, z: 4\.0 \},/, 'pos: { x: 0.5, y: -0.1, z: 5.5 },');
    c = c.replace(/scale: 2\.0, \/\/ Bunny/, 'scale: 2.5,');
    c = c.replace(/pos: \{ x: 4\.0, y: 0\.8, z: 3\.3 \},/, 'pos: { x: 5.0, y: 1.2, z: 2.5 },');
    c = c.replace(/scale: 3\.0, \/\/ Owl/, 'scale: 4.0,');
    c = c.replace(/pos: \{ x: 11\.0, y: 1\.0, z: -1\.0 \},/, 'pos: { x: 10.5, y: 1.1, z: 5.0 },');
    c = c.replace(/scale: 3\.0, \/\/ Fox/, 'scale: 3.5,');
}

// 2. Update the final rotations in the cinematic sequence
// Bunny (turned left toward name field - negative Y turns towards screen left)
c = c.replace(/bunny\.model\.rotation\.set\(0, 0\.2, 0\); \/\/ face slightly right\/forward/, "bunny.model.rotation.set(0, -0.6, 0); // turned left toward Name Field");
c = c.replace(/gsap\.to\(bunny\.model\.rotation, \{ y: 0\.2,/g, "gsap.to(bunny.model.rotation, { y: -0.6,");

// Fox (turned right - positive Y turns towards screen right)
c = c.replace(/gsap\.to\(fox\.model\.rotation, \{ y: -0\.2,/g, "gsap.to(fox.model.rotation, { y: 0.5,");

// Owl center stand tall
c = c.replace(/gsap\.to\(owl\.model\.rotation, \{ y: 0, duration: 0\.5 \}\); \/\/ face camera with knowing smile/, "gsap.to(owl.model.rotation, { y: 0, duration: 0.5 }); // stand tall centered");
c = c.replace(/gsap\.to\(owl\.model\.rotation, \{ y: 0, duration: 0\.2 \}\);/g, "gsap.to(owl.model.rotation, { y: 0, duration: 0.2 });");

fs.writeFileSync('public/index.html', c);
console.log('Final poses updated!');
