/**
 * CLI configuration and API helper
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

const CONFIG_DIR = path.join(os.homedir(), '.bonsai');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const PID_FILE = path.join(CONFIG_DIR, 'proxy.pid');

// ─── Config management ───────────────────────────────
function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch { return {}; }
}

function writeConfig(data) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

function getToken() { return readConfig().token; }
function getServerUrl() { return readConfig().serverUrl || 'http://localhost:3000'; }
function isLoggedIn() { return !!getToken(); }

// ─── HTTP helper ─────────────────────────────────────
function apiRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const baseUrl = getServerUrl();
    const url = new URL(path, baseUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── Colors ──────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  brightGreen: '\x1b[92m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m',
};

function clr(color, text) { return `${c[color]}${text}${c.reset}`; }

function printLogo() {
  console.log(clr('brightGreen', `
  ╔═══════════════════════════════╗
  ║  🌱 Bonsai CLI v${require('../package.json').version.padEnd(14)}║
  ║  Free frontier coding models  ║
  ╚═══════════════════════════════╝`));
  console.log();
}

module.exports = {
  readConfig, writeConfig, getToken, getServerUrl, isLoggedIn,
  apiRequest, clr, printLogo, PID_FILE, CONFIG_FILE, CONFIG_DIR
};
