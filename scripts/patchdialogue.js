const fs = require('fs');
let c = fs.readFileSync('public/index.html', 'utf8');

// Replace each showDialogue call to pass the correct model as first arg
const replacements = [
    ['await showDialogue("\u{1F575}\u{FE0F}\u{200D}\u{2642}\u{FE0F} Wise Owl",', 'await showDialogue(owl.model, "\u{1F575}\u{FE0F}\u{200D}\u{2642}\u{FE0F} Wise Owl",'],
    ['await showDialogue("\u{1F989} Professor Hoot", "I', 'await showDialogue(owl.model, "\u{1F989} Professor Hoot", "I'],
    ['await showDialogue("\u{1F989} Professor Hoot", "Meet', 'await showDialogue(owl.model, "\u{1F989} Professor Hoot", "Meet'],
    ['await showDialogue("\u{1F989} Professor Hoot", "And now', 'await showDialogue(owl.model, "\u{1F989} Professor Hoot", "And now'],
    ['await showDialogue("\u{1F989} Professor Hoot", "Hey crazy', 'await showDialogue(owl.model, "\u{1F989} Professor Hoot", "Hey crazy'],
    ['await showDialogue("\u{1F989} Professor Hoot", "Yaa', 'await showDialogue(owl.model, "\u{1F989} Professor Hoot", "Yaa'],
    ['await showDialogue("\u{1F989} Professor Hoot", "Now that', 'await showDialogue(owl.model, "\u{1F989} Professor Hoot", "Now that'],
    ['await showDialogue("\u{1F98A} Playful Fox"', 'await showDialogue(fox.model, "\u{1F98A} Playful Fox"'],
    ['await showDialogue("\u{1F989}\u{1F430}\u{1F98A} ALL THREE"', 'await showDialogue(owl.model, "\u{1F989}\u{1F430}\u{1F98A} ALL THREE"'],
];

let count = 0;
for (const [from, to] of replacements) {
    if (c.includes(from)) {
        c = c.replace(from, to);
        count++;
    } else {
        console.warn('NOT FOUND:', from.substring(0, 60));
    }
}

fs.writeFileSync('public/index.html', c);
console.log('Done! Replaced', count, 'of', replacements.length);
