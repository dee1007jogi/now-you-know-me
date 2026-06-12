const fs = require('fs');
const path = require('path');

// 1. Append to .env
const envFile = path.join('c:', 'Users', 'deeva', '.gemini', 'antigravity', 'scratch', 'now-you-know-me', '.env');
let env = '';
if (fs.existsSync(envFile)) {
    env = fs.readFileSync(envFile, 'utf8');
}
if (!env.includes('ADMIN_USER')) {
    env += '\nADMIN_USER=admin\nADMIN_PASS=bgaming2026\n';
    fs.writeFileSync(envFile, env);
    console.log("Updated .env with admin credentials");
}

// 2. Modify server.js
const jsFile = path.join('c:', 'Users', 'deeva', '.gemini', 'antigravity', 'scratch', 'now-you-know-me', 'server.js');
let js = fs.readFileSync(jsFile, 'utf8');

const authLogic = `
// ---- Admin Authentication Middleware ----
function adminAuth(req, res, next) {
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

    const ADMIN_USER = process.env.ADMIN_USER || 'admin';
    const ADMIN_PASS = process.env.ADMIN_PASS || 'bgaming2026';

    if (login && password && login === ADMIN_USER && password === ADMIN_PASS) {
        return next();
    }

    res.set('WWW-Authenticate', 'Basic realm="Admin Panel Authentication Required"');
    res.status(401).send('Authentication required.');
}

app.use('/admin.html', adminAuth);
app.use('/api/admin', adminAuth);
`;

if (!js.includes('function adminAuth(')) {
    // Inject right before app.use(express.static
    js = js.replace('// Static files', authLogic + '\n// Static files');
    fs.writeFileSync(jsFile, js);
    console.log("Injected adminAuth middleware into server.js");
} else {
    console.log("Already injected.");
}
