import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'db.json');

const port = Number(process.env.PORT || 4173);
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'bewise2026';
const sessionSecret = process.env.SESSION_SECRET || 'bewise-local-session-secret';
const cookieName = 'bewise_session';
const loginAttempts = new Map();
const maxLoginAttempts = 5;
const loginWindowMs = 15 * 60 * 1000;
const leadNotifyEmail = process.env.LEAD_NOTIFY_EMAIL || 'hadja@ml-handc.com';
const emailFrom = process.env.EMAIL_FROM || 'Bewise <onboarding@resend.dev>';
const resendApiKey = process.env.RESEND_API_KEY || '';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(value) {
  return createHmac('sha256', sessionSecret).update(value).digest('base64url');
}

function createSession(user) {
  const payload = Buffer.from(
    JSON.stringify({
      user,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7
    })
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readCookies(request) {
  return Object.fromEntries(
    (request.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const splitIndex = part.indexOf('=');
        return [part.slice(0, splitIndex), decodeURIComponent(part.slice(splitIndex + 1))];
      })
  );
}

function getSessionUser(request) {
  const token = readCookies(request)[cookieName];
  if (!token || !token.includes('.')) return null;

  const [payload, signature] = token.split('.');
  if (!safeEqual(signature, sign(payload))) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session.user || session.exp < Date.now()) return null;
    return session.user;
  } catch {
    return null;
  }
}

function setSessionCookie(response, token) {
  response.setHeader(
    'Set-Cookie',
    `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
  );
}

function clearSessionCookie(response) {
  response.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

async function readJsonBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1024 * 1024) {
      const error = new Error('Payload too large');
      error.status = 413;
      throw error;
    }
  }

  if (!body.trim()) return {};

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error('Invalid JSON');
    error.status = 400;
    throw error;
  }
}

async function readDb() {
  await mkdir(dataDir, { recursive: true });
  const raw = await readFile(dbPath, 'utf8');
  return JSON.parse(raw);
}

async function writeDb(db) {
  await writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(data));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

function requireAdmin(request, response) {
  const user = getSessionUser(request);
  if (!user) {
    sendError(response, 401, 'Authentification requise');
    return null;
  }
  return user;
}

function loginAttemptKey(request) {
  return request.socket.remoteAddress || request.headers['x-forwarded-for'] || 'local';
}

function canAttemptLogin(request) {
  const key = loginAttemptKey(request);
  const now = Date.now();
  const attempt = loginAttempts.get(key);

  if (!attempt || attempt.resetAt < now) {
    loginAttempts.set(key, { count: 0, resetAt: now + loginWindowMs });
    return true;
  }

  return attempt.count < maxLoginAttempts;
}

function recordFailedLogin(request) {
  const key = loginAttemptKey(request);
  const now = Date.now();
  const attempt = loginAttempts.get(key) || { count: 0, resetAt: now + loginWindowMs };
  attempt.count += 1;
  attempt.resetAt = attempt.resetAt < now ? now + loginWindowMs : attempt.resetAt;
  loginAttempts.set(key, attempt);
}

function clearFailedLogins(request) {
  loginAttempts.delete(loginAttemptKey(request));
}

function cleanText(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function leadEmailHtml(lead) {
  const rows = [
    ['Nom', lead.name],
    ['Entreprise', lead.company],
    ['Email', lead.email],
    ['Téléphone', lead.phone || 'Non renseigné'],
    ['Message', lead.message || 'Non renseigné']
  ];

  return `
    <div style="font-family:Inter,Arial,sans-serif;color:#080d2f;line-height:1.6">
      <h1 style="margin:0 0 16px;font-size:24px">Nouvelle demande d’audit Bewise</h1>
      <p style="margin:0 0 22px;color:#5b6388">Une nouvelle demande vient d’être envoyée depuis le site.</p>
      <table style="width:100%;border-collapse:collapse">
        ${rows
          .map(
            ([label, value]) => `
              <tr>
                <td style="padding:10px 12px;border:1px solid #e5e8f5;background:#f7f8ff;font-weight:700;width:150px">${escapeHtml(label)}</td>
                <td style="padding:10px 12px;border:1px solid #e5e8f5">${escapeHtml(value)}</td>
              </tr>
            `
          )
          .join('')}
      </table>
    </div>
  `;
}

function leadEmailText(lead) {
  return [
    'Nouvelle demande d’audit Bewise',
    '',
    `Nom: ${lead.name}`,
    `Entreprise: ${lead.company}`,
    `Email: ${lead.email}`,
    `Téléphone: ${lead.phone || 'Non renseigné'}`,
    '',
    `Message: ${lead.message || 'Non renseigné'}`
  ].join('\n');
}

async function sendLeadNotification(lead) {
  if (!resendApiKey) {
    console.info('Email notification skipped: RESEND_API_KEY is not configured.');
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [leadNotifyEmail],
        reply_to: lead.email,
        subject: `Nouvelle demande d’audit - ${lead.company}`,
        text: leadEmailText(lead),
        html: leadEmailHtml(lead)
      })
    });

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(payload || `HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn(`Email notification failed: ${error.message}`);
  }
}

function normalizeLead(payload) {
  const name = cleanText(payload.name, 120);
  const email = cleanText(payload.email, 160).toLowerCase();
  const company = cleanText(payload.company, 140);
  const phone = cleanText(payload.phone, 60);
  const message = cleanText(payload.message, 1200);

  if (!name || !email || !company) {
    const error = new Error('Nom, email et entreprise sont requis');
    error.status = 400;
    throw error;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error('Email invalide');
    error.status = 400;
    throw error;
  }

  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'new',
    name,
    email,
    company,
    phone,
    message
  };
}

function validateContent(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    const error = new Error('Contenu invalide');
    error.status = 400;
    throw error;
  }

  if (!content.hero?.title || !content.hero?.intro) {
    const error = new Error('Le titre et le texte du hero sont requis');
    error.status = 400;
    throw error;
  }

  if (!Array.isArray(content.benefits) || !Array.isArray(content.sectors?.items)) {
    const error = new Error('Les bénéfices et secteurs doivent être des listes');
    error.status = 400;
    throw error;
  }

  return content;
}

async function handleApi(request, response, pathname) {
  if (request.method === 'GET' && pathname === '/api/content') {
    const db = await readDb();
    return sendJson(response, 200, db.content);
  }

  if (request.method === 'POST' && pathname === '/api/leads') {
    const db = await readDb();
    const lead = normalizeLead(await readJsonBody(request));
    db.leads.unshift(lead);
    await writeDb(db);
    await sendLeadNotification(lead);
    return sendJson(response, 201, { ok: true, lead });
  }

  if (request.method === 'POST' && pathname === '/api/admin/login') {
    if (!canAttemptLogin(request)) {
      return sendError(response, 429, 'Trop de tentatives. Réessayez dans quelques minutes.');
    }

    const payload = await readJsonBody(request);
    if (!safeEqual(payload.user || '', adminUser) || !safeEqual(payload.password || '', adminPassword)) {
      recordFailedLogin(request);
      return sendError(response, 401, 'Identifiants incorrects');
    }

    clearFailedLogins(request);
    setSessionCookie(response, createSession(adminUser));
    return sendJson(response, 200, { ok: true, user: adminUser });
  }

  if (request.method === 'POST' && pathname === '/api/admin/logout') {
    clearSessionCookie(response);
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === 'GET' && pathname === '/api/admin/me') {
    const user = requireAdmin(request, response);
    if (!user) return;
    return sendJson(response, 200, { user });
  }

  if (request.method === 'GET' && pathname === '/api/admin/leads') {
    const user = requireAdmin(request, response);
    if (!user) return;
    const db = await readDb();
    return sendJson(response, 200, db.leads || []);
  }

  if (request.method === 'PATCH' && pathname.startsWith('/api/admin/leads/')) {
    const user = requireAdmin(request, response);
    if (!user) return;
    const id = decodeURIComponent(pathname.replace('/api/admin/leads/', ''));
    const payload = await readJsonBody(request);
    const db = await readDb();
    const lead = (db.leads || []).find((item) => item.id === id);
    if (!lead) return sendError(response, 404, 'Demande introuvable');

    if (payload.status) lead.status = cleanText(payload.status, 40);
    if ('note' in payload) lead.note = cleanText(payload.note, 800);
    lead.updatedAt = new Date().toISOString();
    await writeDb(db);
    return sendJson(response, 200, lead);
  }

  if (request.method === 'PUT' && pathname === '/api/admin/content') {
    const user = requireAdmin(request, response);
    if (!user) return;
    const payload = await readJsonBody(request);
    const db = await readDb();
    db.content = validateContent(payload.content);
    await writeDb(db);
    return sendJson(response, 200, db.content);
  }

  return sendError(response, 404, 'Route API introuvable');
}

async function sendStatic(response, pathname) {
  const routes = {
    '/': 'index.html',
    '/admin': 'admin.html',
    '/admin/': 'admin.html'
  };

  const requested = routes[pathname] || pathname.replace(/^\/+/, '');
  const filePath = path.normalize(path.join(publicDir, requested));

  if (!filePath.startsWith(publicDir)) {
    return sendError(response, 403, 'Accès refusé');
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('Not a file');
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    createReadStream(filePath).pipe(response);
  } catch {
    sendError(response, 404, 'Page introuvable');
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url.pathname);
      return;
    }

    await sendStatic(response, decodeURIComponent(url.pathname));
  } catch (error) {
    sendError(response, error.status || 500, error.message || 'Erreur serveur');
  }
});

server.listen(port, () => {
  console.log(`Bewise site running on http://localhost:${port}`);
  console.log(`Admin available on http://localhost:${port}/admin`);
});
