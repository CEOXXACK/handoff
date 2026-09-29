// Writes config.js from Netlify env vars before publish (mirrors realtor-kit pattern).
const fs = require('fs');
const backend = process.env.BACKEND_URL || '';
const out = `/* generated at deploy time from environment */\nwindow.HANDOFF_CONFIG = Object.assign(window.HANDOFF_CONFIG || {}, { BACKEND_URL: ${JSON.stringify(backend)} });\n`;
fs.writeFileSync(__dirname + '/config.js', out);
console.log('config.js written. BACKEND_URL =', backend || '(empty — app falls back to same-origin /api)');