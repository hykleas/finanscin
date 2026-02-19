const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'db.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ users: [], transactions: [], sessions: [] }, null, 2));
}

function readDb() {
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt] = stored.split(':');
  return hashPassword(password, salt) === stored;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(raw.split(';').filter(Boolean).map((x) => x.trim().split('=')));
}

function getSession(req, db) {
  const sid = parseCookies(req).sid;
  if (!sid) return null;
  const session = db.sessions.find((s) => s.sid === sid && s.expiresAt > Date.now());
  return session || null;
}

function setSession(res, db, userId) {
  const sid = crypto.randomBytes(24).toString('hex');
  db.sessions = db.sessions.filter((s) => s.userId !== userId);
  db.sessions.push({ sid, userId, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7 });
  res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`);
}

function clearSession(req, res, db) {
  const sid = parseCookies(req).sid;
  db.sessions = db.sessions.filter((s) => s.sid !== sid);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}

function authUser(req, db) {
  const session = getSession(req, db);
  if (!session) return null;
  return db.users.find((u) => u.id === session.userId) || null;
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const typeMap = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
  };
  const contentType = typeMap[ext] || 'text/plain; charset=utf-8';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function analytics(db, userId, range) {
  const now = new Date();
  const start = new Date(now);
  if (range === 'month') start.setDate(1);
  if (range === '3months') start.setMonth(start.getMonth() - 3);
  if (range === 'year') {
    start.setMonth(0);
    start.setDate(1);
  }

  const tx = db.transactions.filter((t) => t.userId === userId);
  const inRange = tx.filter((t) => new Date(t.transactionDate) >= start);
  const income = inRange.filter((t) => t.type === 'income').reduce((a, b) => a + b.amount, 0);
  const expense = inRange.filter((t) => t.type === 'expense').reduce((a, b) => a + b.amount, 0);

  const monthMap = {};
  tx.forEach((t) => {
    const m = t.transactionDate.slice(0, 7);
    monthMap[m] = monthMap[m] || { month: m, income: 0, expense: 0 };
    monthMap[m][t.type] += t.amount;
  });

  const catMap = {};
  inRange.filter((t) => t.type === 'expense').forEach((t) => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  });

  return {
    range,
    income,
    expense,
    balance: income - expense,
    savingsRate: income ? ((income - expense) / income) * 100 : 0,
    trend: Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)),
    expensesByCategory: Object.entries(catMap).map(([category, total]) => ({ category, total }))
  };
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const db = readDb();

  if (parsed.pathname === '/api/auth/register' && req.method === 'POST') {
    const { fullName, email, password } = await parseBody(req);
    if (!fullName || !email || !password || password.length < 6) return sendJson(res, 400, { error: 'Geçersiz bilgiler.' });
    if (db.users.some((u) => u.email === email.toLowerCase())) return sendJson(res, 409, { error: 'E-posta kayıtlı.' });
    const id = (db.users.at(-1)?.id || 0) + 1;
    db.users.push({ id, fullName, email: email.toLowerCase(), passwordHash: hashPassword(password), theme: 'theme-aurora', monthlyIncomeGoal: 0, monthlySavingGoal: 0 });
    setSession(res, db, id);
    writeDb(db);
    return sendJson(res, 200, { success: true });
  }

  if (parsed.pathname === '/api/auth/login' && req.method === 'POST') {
    const { email, password } = await parseBody(req);
    const user = db.users.find((u) => u.email === (email || '').toLowerCase());
    if (!user || !verifyPassword(password || '', user.passwordHash)) return sendJson(res, 401, { error: 'Hatalı giriş.' });
    setSession(res, db, user.id);
    writeDb(db);
    return sendJson(res, 200, { success: true });
  }

  if (parsed.pathname === '/api/auth/logout' && req.method === 'POST') {
    clearSession(req, res, db);
    writeDb(db);
    return sendJson(res, 200, { success: true });
  }

  if (parsed.pathname === '/api/auth/me' && req.method === 'GET') {
    const user = authUser(req, db);
    if (!user) return sendJson(res, 200, { loggedIn: false });
    return sendJson(res, 200, {
      loggedIn: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        theme: user.theme,
        monthlyIncomeGoal: user.monthlyIncomeGoal,
        monthlySavingGoal: user.monthlySavingGoal
      }
    });
  }

  const user = authUser(req, db);

  if (parsed.pathname === '/api/user/preferences' && req.method === 'PUT') {
    if (!user) return sendJson(res, 401, { error: 'Yetkisiz.' });
    const { theme, monthlyIncomeGoal, monthlySavingGoal } = await parseBody(req);
    if (theme) user.theme = theme;
    if (monthlyIncomeGoal !== undefined) user.monthlyIncomeGoal = Number(monthlyIncomeGoal) || 0;
    if (monthlySavingGoal !== undefined) user.monthlySavingGoal = Number(monthlySavingGoal) || 0;
    writeDb(db);
    return sendJson(res, 200, { success: true });
  }

  if (parsed.pathname === '/api/transactions' && req.method === 'GET') {
    if (!user) return sendJson(res, 401, { error: 'Yetkisiz.' });
    const items = db.transactions.filter((t) => t.userId === user.id).sort((a, b) => b.transactionDate.localeCompare(a.transactionDate) || b.id - a.id);
    return sendJson(res, 200, { items, categories: { income: ['Maaş', 'Ek Gelir', 'Yatırım', 'Freelance', 'Diğer'], expense: ['Kira', 'Faturalar', 'Ulaşım', 'Yemek', 'Eğlence', 'Sağlık', 'Diğer'] } });
  }

  if (parsed.pathname === '/api/transactions' && req.method === 'POST') {
    if (!user) return sendJson(res, 401, { error: 'Yetkisiz.' });
    const body = await parseBody(req);
    const id = (db.transactions.at(-1)?.id || 0) + 1;
    db.transactions.push({ id, userId: user.id, type: body.type, category: body.category, amount: Number(body.amount), note: body.note || '', transactionDate: body.transactionDate });
    writeDb(db);
    return sendJson(res, 200, { success: true });
  }

  if (parsed.pathname.startsWith('/api/transactions/') && req.method === 'DELETE') {
    if (!user) return sendJson(res, 401, { error: 'Yetkisiz.' });
    const id = Number(parsed.pathname.split('/').pop());
    db.transactions = db.transactions.filter((t) => !(t.id === id && t.userId === user.id));
    writeDb(db);
    return sendJson(res, 200, { success: true });
  }

  if (parsed.pathname === '/api/analytics/summary' && req.method === 'GET') {
    if (!user) return sendJson(res, 401, { error: 'Yetkisiz.' });
    return sendJson(res, 200, analytics(db, user.id, parsed.query.range || 'month'));
  }

  if (parsed.pathname === '/' || !path.extname(parsed.pathname)) {
    return serveFile(res, path.join(publicDir, 'index.html'));
  }

  return serveFile(res, path.join(publicDir, parsed.pathname));
});

server.listen(PORT, () => {
  console.log(`Finora running on http://localhost:${PORT}`);
});
