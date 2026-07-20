import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrotliCompress, createGzip } from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'db.json');
let dbWriteQueue = Promise.resolve();

const port = Number(process.env.PORT || 4173);
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'bewise2026';
const sessionSecret = process.env.SESSION_SECRET || 'bewise-local-session-secret';
const cookieName = 'bewise_session';
const loginAttempts = new Map();
const maxLoginAttempts = 5;
const loginWindowMs = 15 * 60 * 1000;
const leadNotifyEmail = process.env.LEAD_NOTIFY_EMAIL || 'contact@gobewise.com';
const emailFrom = process.env.EMAIL_FROM || 'Bewise <onboarding@resend.dev>';
const resendApiKey = process.env.RESEND_API_KEY || '';

// Dependency-free server: static delivery, JSON APIs, admin sessions,
// compression and cache policy intentionally live together here.
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2'
};

const longCacheExtensions = new Set(['.css', '.js', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.woff2']);
const compressibleExtensions = new Set(['.html', '.css', '.js', '.json', '.txt', '.xml', '.svg']);

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

function recoverFirstJsonObject(raw) {
  let depth = 0;
  let started = false;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"' && !escaped) inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      started = true;
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (started && depth === 0) {
        try {
          return JSON.parse(raw.slice(0, index + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

async function readDb() {
  await mkdir(dataDir, { recursive: true });
  const raw = await readFile(dbPath, 'utf8');

  try {
    return JSON.parse(raw);
  } catch (error) {
    const recovered = recoverFirstJsonObject(raw);
    if (recovered && typeof recovered === 'object' && !Array.isArray(recovered)) {
      await writeDb(recovered);
      return recovered;
    }
    throw error;
  }
}

async function writeDbFile(db) {
  const tempPath = path.join(dataDir, `db.${process.pid}.${Date.now()}.${randomUUID()}.tmp`);
  await writeFile(tempPath, `${JSON.stringify(db, null, 2)}\n`);
  await rename(tempPath, dbPath);
}

async function writeDb(db) {
  dbWriteQueue = dbWriteQueue.then(() => writeDbFile(db), () => writeDbFile(db));
  return dbWriteQueue;
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

function getCacheControl(extension, pathname) {
  if (pathname === '/favicon.ico' || pathname === '/favicon.svg') return 'no-cache';
  if (extension === '.html' || pathname === '/') return 'no-cache';
  if (extension === '.xml' || extension === '.txt') return 'public, max-age=3600';
  if (pathname.startsWith('/assets/') || longCacheExtensions.has(extension)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=86400';
}

function getContentEncoding(request, extension) {
  if (!compressibleExtensions.has(extension)) return null;
  const acceptedEncodings = request.headers['accept-encoding'] || '';
  if (/\bbr\b/.test(acceptedEncodings)) return 'br';
  if (/\bgzip\b/.test(acceptedEncodings)) return 'gzip';
  return null;
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

function cleanAnalyticsValue(value, maxLength = 180) {
  return cleanText(value, maxLength) || null;
}

function ensureAnalytics(db) {
  db.analytics = db.analytics && typeof db.analytics === 'object' ? db.analytics : {};
  db.analytics.events = Array.isArray(db.analytics.events) ? db.analytics.events : [];
  return db.analytics;
}

function normalizeSource(payload, request) {
  const explicitSource = cleanAnalyticsValue(payload.source || payload.utmSource || payload.utm_source, 80);
  if (explicitSource) return explicitSource;

  const referrer = cleanAnalyticsValue(payload.referrer || request.headers.referer, 300);
  if (!referrer) return 'Accès direct';

  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('google.')) return 'Google';
    if (host.includes('linkedin.')) return 'LinkedIn';
    if (host.includes('instagram.')) return 'Instagram';
    if (host.includes('tiktok.')) return 'TikTok';
    if (host.includes('facebook.') || host.includes('meta.')) return 'Réseaux sociaux';
    if (host.includes('gobewise.com')) return 'Interne';
    return 'Sites partenaires';
  } catch {
    return 'Accès direct';
  }
}

function normalizeTrackingEvent(payload, request) {
  const type = cleanAnalyticsValue(payload.type, 60) || 'event';
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    type,
    path: cleanAnalyticsValue(payload.path || url.pathname, 140) || '/',
    title: cleanAnalyticsValue(payload.title, 220),
    section: cleanAnalyticsValue(payload.section, 80),
    cta: cleanAnalyticsValue(payload.cta || payload.label, 120),
    source: normalizeSource(payload, request),
    referrer: cleanAnalyticsValue(payload.referrer || request.headers.referer, 300),
    device: cleanAnalyticsValue(payload.device, 40) || 'desktop',
    visitorId: cleanAnalyticsValue(payload.visitorId, 100) || randomUUID(),
    sessionId: cleanAnalyticsValue(payload.sessionId, 100) || randomUUID(),
    value: Number.isFinite(Number(payload.value)) ? Number(payload.value) : null,
    loadMs: Number.isFinite(Number(payload.loadMs)) ? Number(payload.loadMs) : null,
    lcp: Number.isFinite(Number(payload.lcp)) ? Number(payload.lcp) : null,
    cls: Number.isFinite(Number(payload.cls)) ? Number(payload.cls) : null,
    message: cleanAnalyticsValue(payload.message, 260)
  };
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysAgo(days) {
  const date = startOfToday();
  date.setDate(date.getDate() - days);
  return date;
}

function monthStart() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function eventTime(event) {
  return new Date(event.createdAt || 0);
}

function inRange(event, start) {
  return eventTime(event) >= start;
}

function uniqueVisitors(events) {
  return new Set(events.map((event) => event.visitorId).filter(Boolean)).size;
}

function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function groupBy(events, getter) {
  return events.reduce((acc, event) => {
    const key = getter(event) || 'Non renseigné';
    acc[key] = acc[key] || [];
    acc[key].push(event);
    return acc;
  }, {});
}

function topEntry(entries, fallback = 'Non renseigné') {
  const sorted = Object.entries(entries).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || fallback;
}

function average(numbers) {
  const valid = numbers.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count > 1 ? plural : singular}`;
}

function computeAnalytics(db) {
  // The dashboard is derived from append-only first-party events so it remains
  // useful even before external analytics tools are connected.
  const events = ensureAnalytics(db).events;
  const leads = Array.isArray(db.leads) ? db.leads : [];
  const todayStart = startOfToday();
  const weekStart = daysAgo(6);
  const currentMonthStart = monthStart();
  const pageViews = events.filter((event) => event.type === 'page_view');
  const monthViews = pageViews.filter((event) => inRange(event, currentMonthStart));
  const monthEvents = events.filter((event) => inRange(event, currentMonthStart));
  const todayViews = pageViews.filter((event) => inRange(event, todayStart));
  const weekViews = pageViews.filter((event) => inRange(event, weekStart));
  const ctaClicks = monthEvents.filter((event) => event.type === 'audit_click');
  const auditReservations = monthEvents.filter((event) => event.type === 'audit_reserved');
  const contactSubmits = monthEvents.filter((event) => event.type === 'contact_submit');
  const sourceGroups = groupBy(monthViews.length ? monthViews : pageViews, (event) => event.source);
  const sourceCounts = Object.fromEntries(Object.entries(sourceGroups).map(([source, items]) => [source, uniqueVisitors(items)]));
  const sourceTotal = Object.values(sourceCounts).reduce((sum, count) => sum + count, 0);
  const totalVisitors = uniqueVisitors(monthViews.length ? monthViews : pageViews);
  const sectionViews = monthEvents.filter((event) => event.type === 'section_view');
  const sectionLabels = {
    expertise: 'Hero',
    impact: 'Impact mesurable',
    approche: 'Notre approche',
    ecosysteme: 'Écosystème',
    apropos: 'À propos',
    realisations: 'Réalisations',
    contact: 'Contact'
  };
  const sectionRows = Object.entries(sectionLabels).map(([section, label]) => {
    const visitors = uniqueVisitors(sectionViews.filter((event) => event.section === section));
    return {
      section,
      label,
      visitors,
      reach: percent(visitors, totalVisitors)
    };
  });
  const scrollBySession = groupBy(monthEvents.filter((event) => event.type === 'scroll_depth'), (event) => event.sessionId);
  const averageScroll = average(
    Object.values(scrollBySession).map((items) => Math.max(...items.map((event) => Number(event.value) || 0)))
  );
  const maxTimesBySession = Object.values(groupBy(monthEvents.filter((event) => event.type === 'time_on_page'), (event) => event.sessionId)).map((items) =>
    Math.max(...items.map((event) => Number(event.value) || 0))
  );
  const scrollEvents = monthEvents.filter((event) => event.type === 'scroll_depth');
  const scrollReach = (threshold) => uniqueVisitors(scrollEvents.filter((event) => Number(event.value) >= threshold));
  const funnelRows = [
    { label: 'Visite du site', count: totalVisitors, percent: totalVisitors ? 100 : 0 },
    { label: 'Scroll 25 %', count: scrollReach(25), percent: percent(scrollReach(25), totalVisitors) },
    { label: 'Scroll 50 %', count: scrollReach(50), percent: percent(scrollReach(50), totalVisitors) },
    { label: 'Scroll 75 %', count: scrollReach(75), percent: percent(scrollReach(75), totalVisitors) },
    { label: 'Clic sur “Réserver un audit”', count: ctaClicks.length, percent: percent(ctaClicks.length, totalVisitors) },
    { label: 'Audit réservé', count: auditReservations.length, percent: percent(auditReservations.length, totalVisitors) }
  ];
  const lastSectionBySession = Object.values(groupBy(sectionViews, (event) => event.sessionId)).map((items) =>
    items.sort((a, b) => eventTime(b) - eventTime(a))[0]
  );
  const exitCounts = {};
  lastSectionBySession.forEach((event) => {
    const label = sectionLabels[event.section] || event.section || 'Non renseigné';
    exitCounts[label] = (exitCounts[label] || 0) + 1;
  });
  const ctaCounts = {};
  ctaClicks.forEach((event) => {
    const label = event.cta || 'CTA audit';
    ctaCounts[label] = (ctaCounts[label] || 0) + 1;
  });
  const deviceGroups = groupBy(monthViews, (event) => event.device);
  const deviceRows = Object.entries(deviceGroups).map(([device, items]) => {
    const visitorIds = new Set(items.map((event) => event.visitorId).filter(Boolean));
    const clicks = ctaClicks.filter((event) => visitorIds.has(event.visitorId)).length;
    const reservations = auditReservations.filter((event) => visitorIds.has(event.visitorId)).length;
    return {
      device,
      visitors: visitorIds.size,
      auditClicks: clicks,
      reservations,
      conversion: percent(reservations, visitorIds.size)
    };
  });
  const sourceRows = Object.entries(sourceGroups).map(([source, items]) => {
    const visitorIds = new Set(items.map((event) => event.visitorId).filter(Boolean));
    const sourceEvents = monthEvents.filter((event) => visitorIds.has(event.visitorId));
    const maxTimes = Object.values(groupBy(sourceEvents.filter((event) => event.type === 'time_on_page'), (event) => event.sessionId)).map((session) =>
      Math.max(...session.map((event) => Number(event.value) || 0))
    );
    const clicks = sourceEvents.filter((event) => event.type === 'audit_click').length;
    const reservations = sourceEvents.filter((event) => event.type === 'audit_reserved').length;
    return {
      source,
      visitors: visitorIds.size,
      share: percent(visitorIds.size, sourceTotal),
      timeSpent: average(maxTimes),
      auditClicks: clicks,
      reservations,
      conversion: percent(reservations, visitorIds.size)
    };
  });
  const conversionRows = [
    ...leads.map((lead) => ({
      id: lead.id,
      type: 'Contact',
      date: lead.createdAt,
      name: lead.name,
      company: lead.company,
      email: lead.email,
      phone: lead.phone || '',
      message: lead.message || '',
      source: lead.source || 'Non renseigné',
      origin: lead.origin || 'Formulaire contact',
      status: lead.status || 'new'
    })),
    ...auditReservations.map((event) => ({
      id: event.id,
      type: 'Audit',
      date: event.createdAt,
      name: 'Réservation Calendly',
      company: '',
      email: '',
      source: event.source || 'Non renseigné',
      origin: event.cta || 'Calendly',
      status: 'scheduled'
    }))
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const performanceEvents = monthEvents.filter((event) => event.type === 'performance');
  const loadTimes = performanceEvents.map((event) => event.loadMs).filter((value) => Number.isFinite(value));
  const lcpTimes = performanceEvents.map((event) => event.lcp).filter((value) => Number.isFinite(value));
  const clsValues = performanceEvents.map((event) => event.cls).filter((value) => Number.isFinite(value));
  const jsErrors = monthEvents.filter((event) => event.type === 'js_error');
  const insights = [];
  if (weekViews.length) {
    const visitors = uniqueVisitors(weekViews);
    insights.push(`Le site a reçu ${pluralize(visitors, 'visiteur unique', 'visiteurs uniques')} sur les 7 derniers jours.`);
  }
  if (sourceRows.length) {
    const bestSource = [...sourceRows].sort((a, b) => b.conversion - a.conversion || b.visitors - a.visitors)[0];
    insights.push(`${bestSource.source} est la source la plus intéressante à surveiller pour la conversion.`);
  }
  const ecosystemRow = sectionRows.find((row) => row.section === 'ecosysteme');
  if (ecosystemRow && totalVisitors) insights.push(`${String(100 - ecosystemRow.reach).replace('.', ',')} % des visiteurs quittent ou n’atteignent pas encore la section Écosystème.`);
  if (Object.keys(ctaCounts).length) insights.push(`Le CTA le plus cliqué est “${topEntry(ctaCounts)}”.`);
  if (!insights.length) insights.push('Les premiers insights apparaîtront après quelques visites et clics sur le site.');

  return {
    overview: {
      visitorsToday: uniqueVisitors(todayViews),
      visitorsWeek: uniqueVisitors(weekViews),
      visitorsMonth: uniqueVisitors(monthViews),
      uniqueVisitors: totalVisitors,
      auditClicks: ctaClicks.length,
      auditReservations: auditReservations.length,
      contactSubmits: contactSubmits.length,
      averageTime: average(maxTimesBySession),
      conversionRate: percent(auditReservations.length, totalVisitors),
      topSource: topEntry(sourceCounts, 'Accès direct')
    },
    journey: {
      funnel: funnelRows,
      sections: sectionRows,
      averageScroll,
      exitSections: Object.entries(exitCounts)
        .map(([section, exits]) => ({ section, exits }))
        .sort((a, b) => b.exits - a.exits)
        .slice(0, 5),
      topCta: topEntry(ctaCounts, 'Aucun clic pour le moment'),
      devices: deviceRows
    },
    acquisition: sourceRows.sort((a, b) => b.visitors - a.visitors),
    conversions: conversionRows,
    seo: {
      connected: false,
      clicks: 0,
      impressions: 0,
      position: null,
      queries: [],
      pages: [],
      notes: ['Connexion Google Search Console à configurer pour mesurer le vrai SEO.']
    },
    performance: {
      loadTime: average(loadTimes),
      lcp: average(lcpTimes),
      cls: clsValues.length ? Math.round((clsValues.reduce((sum, value) => sum + value, 0) / clsValues.length) * 1000) / 1000 : 0,
      mobileScore: 0,
      desktopScore: 0,
      heavyAssets: [],
      jsErrors: jsErrors.length,
      brokenLinks: 0,
      uptime: 'À connecter',
      alerts: jsErrors.length ? [`${jsErrors.length} erreur(s) JavaScript détectée(s).`] : ['Aucune alerte critique détectée.']
    },
    insights
  };
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
    message,
    source: cleanAnalyticsValue(payload.source, 80) || 'Non renseigné',
    origin: cleanAnalyticsValue(payload.origin || payload.cta || payload.path, 140) || 'Formulaire contact',
    page: cleanAnalyticsValue(payload.path, 140),
    visitorId: cleanAnalyticsValue(payload.visitorId, 100),
    sessionId: cleanAnalyticsValue(payload.sessionId, 100)
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

  if (request.method === 'POST' && pathname === '/api/track') {
    const db = await readDb();
    const analytics = ensureAnalytics(db);
    analytics.events.push(normalizeTrackingEvent(await readJsonBody(request), request));
    analytics.events = analytics.events.slice(-5000);
    await writeDb(db);
    return sendJson(response, 201, { ok: true });
  }

  if (request.method === 'POST' && pathname === '/api/leads') {
    const db = await readDb();
    const lead = normalizeLead(await readJsonBody(request));
    db.leads.unshift(lead);
    const analytics = ensureAnalytics(db);
    analytics.events.push({
      id: randomUUID(),
      createdAt: lead.createdAt,
      type: 'contact_submit',
      path: lead.page || '/nouscontacter',
      title: null,
      section: 'contact',
      cta: lead.origin,
      source: lead.source,
      referrer: null,
      device: 'unknown',
      visitorId: lead.visitorId || randomUUID(),
      sessionId: lead.sessionId || randomUUID(),
      value: null,
      loadMs: null,
      lcp: null,
      cls: null,
      message: null
    });
    analytics.events = analytics.events.slice(-5000);
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

  if (request.method === 'GET' && pathname === '/api/admin/analytics') {
    const user = requireAdmin(request, response);
    if (!user) return;
    const db = await readDb();
    return sendJson(response, 200, computeAnalytics(db));
  }

  if (request.method === 'POST' && pathname === '/api/admin/reset-data') {
    const user = requireAdmin(request, response);
    if (!user) return;
    const payload = await readJsonBody(request);
    if (!safeEqual(payload.password || '', adminPassword)) {
      return sendError(response, 403, 'Mot de passe invalide');
    }

    const db = await readDb();
    db.leads = [];
    db.analytics = {
      events: [],
      resetAt: new Date().toISOString()
    };
    await writeDb(db);
    return sendJson(response, 200, { ok: true, resetAt: db.analytics.resetAt });
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

async function sendStatic(request, response, pathname) {
  // Public section URLs stay clean; the client script scrolls to the matching
  // section without exposing hash URLs.
  const routes = {
    '/': 'index.html',
    '/notreapproche': 'index.html',
    '/notreapproche/': 'index.html',
    '/ecosysteme': 'index.html',
    '/ecosysteme/': 'index.html',
    '/apropos': 'index.html',
    '/apropos/': 'index.html',
    '/nouscontacter': 'index.html',
    '/nouscontacter/': 'index.html',
    '/realisations': 'index.html',
    '/realisations/': 'index.html',
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
    const contentEncoding = getContentEncoding(request, extension);
    const headers = {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
      'Cache-Control': getCacheControl(extension, pathname),
      'X-Content-Type-Options': 'nosniff'
    };

    if (contentEncoding) {
      headers['Content-Encoding'] = contentEncoding;
      headers.Vary = 'Accept-Encoding';
    } else {
      headers['Content-Length'] = fileStat.size;
    }

    response.writeHead(200, {
      ...headers
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    const stream = createReadStream(filePath);
    if (contentEncoding === 'br') {
      stream.pipe(createBrotliCompress()).pipe(response);
      return;
    }

    if (contentEncoding === 'gzip') {
      stream.pipe(createGzip()).pipe(response);
      return;
    }

    stream.pipe(response);
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

    await sendStatic(request, response, decodeURIComponent(url.pathname));
  } catch (error) {
    sendError(response, error.status || 500, error.message || 'Erreur serveur');
  }
});

server.listen(port, () => {
  console.log(`Bewise site running on http://localhost:${port}`);
  console.log(`Admin available on http://localhost:${port}/admin`);
});
