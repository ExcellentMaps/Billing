/**
 * Bonsai Clone — Backend API Server
 * Routes: /api/auth, /api/keys, /v1/messages (proxy)
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

/* ─────────────────────────────────────────────
   IN-MEMORY DATABASE (replace with real DB)
   In production: use SQLite / Postgres / MongoDB
───────────────────────────────────────────── */
const db = {
  users: {},        // { [email]: { id, name, email, password, createdAt } }
  sessions: {},     // { [token]: { userId, email, name, expiresAt } }
  apiKeys: {},      // { [keyValue]: { id, userId, name, createdAt, active, requests } }
  usage: {},        // { [userId]: { total, today, week, month, dailyBreakdown } }
};

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function genId() { return crypto.randomUUID(); }
function genToken() { return 'bns_sess_' + crypto.randomBytes(32).toString('hex'); }
function genApiKey() { return 'bns_sk_' + crypto.randomBytes(36).toString('hex'); }
function hashPass(p) { return crypto.createHash('sha256').update(p + 'bonsai_salt_2026').digest('hex'); }

const CODENAMES = [
  'cute-koala','angry-giraffe','happy-panda','lazy-fox',
  'swift-eagle','brave-wolf','wise-owl','silly-penguin',
  'grumpy-bear','jolly-dolphin','sneaky-cat','bold-tiger'
];
function randomCodename() { return CODENAMES[Math.floor(Math.random() * CODENAMES.length)]; }

// Auth middleware
function requireAuth(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token || !db.sessions[token]) return res.status(401).json({ error: 'Unauthorized' });
  const session = db.sessions[token];
  if (session.expiresAt < Date.now()) {
    delete db.sessions[token];
    return res.status(401).json({ error: 'Session expired' });
  }
  req.user = session;
  next();
}

// API Key middleware (for proxy endpoint)
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!key) return res.status(401).json({ error: 'API key required' });
  const keyData = db.apiKeys[key];
  if (!keyData) return res.status(401).json({ error: 'Invalid API key' });
  if (!keyData.active) return res.status(403).json({ error: 'API key revoked' });
  req.apiKey = keyData;
  next();
}

function trackUsage(userId) {
  if (!db.usage[userId]) {
    db.usage[userId] = { total: 0, today: 0, week: 0, month: 0, daily: {} };
  }
  const u = db.usage[userId];
  const today = new Date().toISOString().split('T')[0];
  u.total++;
  u.today++;
  u.week++;
  u.month++;
  u.daily[today] = (u.daily[today] || 0) + 1;
}

/* ─────────────────────────────────────────────
   AUTH ROUTES
───────────────────────────────────────────── */

// Register
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be 8+ chars' });
  if (db.users[email]) return res.status(409).json({ error: 'Email already registered' });

  const user = { id: genId(), name, email, password: hashPass(password), createdAt: new Date().toISOString() };
  db.users[email] = user;
  db.usage[user.id] = { total: 0, today: 0, week: 0, month: 0, daily: {} };

  const token = genToken();
  db.sessions[token] = { userId: user.id, email, name, expiresAt: Date.now() + 30 * 24 * 3600 * 1000 };
  res.json({ token, user: { id: user.id, name, email } });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.users[email];
  if (!user || user.password !== hashPass(password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = genToken();
  db.sessions[token] = { userId: user.id, email, name: user.name, expiresAt: Date.now() + 30 * 24 * 3600 * 1000 };
  res.json({ token, user: { id: user.id, name: user.name, email } });
});

// Logout
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  delete db.sessions[token];
  res.json({ ok: true });
});

// Get current user
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.users[req.user.email];
  res.json({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt });
});

// Update profile
app.patch('/api/auth/me', requireAuth, (req, res) => {
  const user = db.users[req.user.email];
  if (req.body.name) {
    user.name = req.body.name;
    db.sessions[req.headers['authorization']?.replace('Bearer ', '')].name = req.body.name;
  }
  res.json({ id: user.id, name: user.name, email: user.email });
});

/* ─────────────────────────────────────────────
   API KEY ROUTES
───────────────────────────────────────────── */

// Create API key
app.post('/api/keys', requireAuth, (req, res) => {
  const name = req.body.name || 'My API Key';
  const key = genApiKey();
  const keyData = {
    id: genId(),
    userId: req.user.userId,
    name,
    key,
    createdAt: new Date().toISOString(),
    active: true,
    requests: 0
  };
  db.apiKeys[key] = keyData;
  // Return full key only on creation
  res.json({ ...keyData });
});

// List API keys (masked)
app.get('/api/keys', requireAuth, (req, res) => {
  const keys = Object.values(db.apiKeys)
    .filter(k => k.userId === req.user.userId)
    .map(k => ({
      ...k,
      key: k.key.slice(0, 14) + '••••••••••••••••••••••••' + k.key.slice(-6)
    }));
  res.json(keys);
});

// Revoke API key
app.patch('/api/keys/:id/revoke', requireAuth, (req, res) => {
  const keyData = Object.values(db.apiKeys).find(k => k.id === req.params.id && k.userId === req.user.userId);
  if (!keyData) return res.status(404).json({ error: 'Key not found' });
  keyData.active = false;
  res.json({ ok: true });
});

// Delete API key
app.delete('/api/keys/:id', requireAuth, (req, res) => {
  const entry = Object.entries(db.apiKeys).find(([, k]) => k.id === req.params.id && k.userId === req.user.userId);
  if (!entry) return res.status(404).json({ error: 'Key not found' });
  delete db.apiKeys[entry[0]];
  res.json({ ok: true });
});

/* ─────────────────────────────────────────────
   USAGE ROUTES
───────────────────────────────────────────── */

app.get('/api/usage', requireAuth, (req, res) => {
  const u = db.usage[req.user.userId] || { total: 0, today: 0, week: 0, month: 0, daily: {} };
  // Last 7 days breakdown
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    days.push({ date: key, count: u.daily[key] || 0 });
  }
  res.json({ ...u, days });
});

/* ─────────────────────────────────────────────
   MODELS LIST
───────────────────────────────────────────── */

app.get('/api/models', (req, res) => {
  res.json([
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'Anthropic', context: '128K', tags: ['Coding', 'Fast'] },
    { id: 'claude-opus-4',     name: 'Claude Opus 4',     provider: 'Anthropic', context: '200K', tags: ['Powerful'] },
    { id: 'gpt-5',             name: 'GPT-5',             provider: 'OpenAI',    context: '128K', tags: ['Reasoning'] },
    { id: 'gemini-2.5-pro',    name: 'Gemini 2.5 Pro',    provider: 'Google',    context: '1M',   tags: ['Multimodal'] },
    { id: 'grok-3',            name: 'Grok 3',            provider: 'xAI',       context: '131K', tags: ['Fast'] },
    { id: 'deepseek-r2',       name: 'DeepSeek R2',       provider: 'DeepSeek',  context: '64K',  tags: ['Reasoning'] },
  ]);
});

/* ─────────────────────────────────────────────
   PROXY — /v1/messages  (Anthropic API format)
   
   Set ANTHROPIC_API_KEY env var to use real API.
   Without it, returns a mock response.
───────────────────────────────────────────── */

app.post('/v1/messages', requireApiKey, async (req, res) => {
  const keyData = req.apiKey;

  // Track usage
  keyData.requests++;
  trackUsage(keyData.userId);

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_KEY) {
    // Mock response (development mode)
    const codename = randomCodename();
    return res.json({
      id: 'msg_' + genId().replace(/-/g, ''),
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: `[Bonsai Mock — ${codename}] This is a development response. Set ANTHROPIC_API_KEY to proxy real requests.` }],
      model: codename,
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 30 }
    });
  }

  // Proxy to real Anthropic API
  try {
    const body = JSON.stringify({
      model: req.body.model || 'claude-sonnet-4-5-20251001',
      max_tokens: req.body.max_tokens || 4096,
      messages: req.body.messages,
      system: req.body.system,
      stream: req.body.stream,
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      }
    };

    if (req.body.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
    }

    const proxyReq = https.request(options, (proxyRes) => {
      res.status(proxyRes.statusCode);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      console.error('Proxy error:', e);
      res.status(500).json({ error: 'Upstream error' });
    });

    proxyReq.write(body);
    proxyReq.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   CLI AUTH FLOW — browser-based login
───────────────────────────────────────────── */

// CLI calls this to start the browser auth flow
app.get('/cli/auth/start', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  // Store state temporarily (5 min TTL)
  db.sessions['cli_state_' + state] = { pending: true, expiresAt: Date.now() + 5 * 60 * 1000 };
  res.json({ state, authUrl: `http://localhost:${PORT}/cli/auth/callback?state=${state}` });
});

// After user logs in on web, CLI polls this
app.get('/cli/auth/poll/:state', (req, res) => {
  const entry = db.sessions['cli_state_' + req.params.state];
  if (!entry) return res.status(404).json({ error: 'Invalid state' });
  if (entry.pending) return res.json({ status: 'pending' });
  // Token was set by callback
  res.json({ status: 'complete', token: entry.token, name: entry.name, email: entry.email });
});

// Web dashboard calls this after login to complete CLI flow
app.post('/cli/auth/complete', requireAuth, (req, res) => {
  const { state } = req.body;
  const entry = db.sessions['cli_state_' + state];
  if (!entry || !entry.pending) return res.status(400).json({ error: 'Invalid state' });

  const token = genToken();
  db.sessions[token] = {
    userId: req.user.userId,
    email: req.user.email,
    name: req.user.name,
    expiresAt: Date.now() + 30 * 24 * 3600 * 1000
  };

  entry.pending = false;
  entry.token = token;
  entry.name = req.user.name;
  entry.email = req.user.email;

  res.json({ ok: true });
});

/* ─────────────────────────────────────────────
   STATIC — serve frontend HTML
───────────────────────────────────────────── */
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════╗
  ║   🌱 Bonsai API Server running     ║
  ║   http://localhost:${PORT}             ║
  ║                                    ║
  ║   Set ANTHROPIC_API_KEY to enable  ║
  ║   real model proxying              ║
  ╚════════════════════════════════════╝
  `);
});
