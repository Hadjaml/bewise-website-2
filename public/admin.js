const loginPanel = document.querySelector('#login-panel');
const dashboard = document.querySelector('#dashboard');
const loginForm = document.querySelector('#login-form');
const loginStatus = document.querySelector('#login-status');
const logoutButton = document.querySelector('#logout-button');
const refreshDashboardButton = document.querySelector('#refresh-dashboard');
const refreshLeadsButton = document.querySelector('#refresh-leads');
const adminResetForm = document.querySelector('#admin-reset-form');
const adminResetPassword = document.querySelector('#admin-reset-password');
const adminMaintenanceStatus = document.querySelector('#admin-maintenance-status');
const adminPageTitle = document.querySelector('#admin-page-title');
const adminPageSubtitle = document.querySelector('#admin-page-subtitle');
const adminDateRange = document.querySelector('#admin-date-range');
const updatedAt = document.querySelector('#admin-updated-at');
const overviewGrid = document.querySelector('#overview-grid');
const overviewFunnel = document.querySelector('#overview-funnel');
const trafficSources = document.querySelector('#traffic-sources');
const overviewAudits = document.querySelector('#overview-audits');
const overviewSeo = document.querySelector('#overview-seo');
const overviewPerformance = document.querySelector('#overview-performance');
const journeyFlow = document.querySelector('#journey-flow');
const sectionsReach = document.querySelector('#sections-reach');
const deviceTable = document.querySelector('#device-table');
const acquisitionTable = document.querySelector('#acquisition-table');
const conversionTable = document.querySelector('#conversion-table');
const seoGrid = document.querySelector('#seo-grid');
const performanceGrid = document.querySelector('#performance-grid');
const performanceAlerts = document.querySelector('#performance-alerts');
const insightList = document.querySelector('#insight-list');
const contentForm = document.querySelector('#content-form');
const contentEditor = document.querySelector('#content-editor');
const contentStatus = document.querySelector('#content-status');
const toggleEditButton = document.querySelector('#toggle-edit');
const editLockPanel = document.querySelector('#edit-lock-panel');

const statuses = {
  new: 'Nouveau',
  contacted: 'Contacté',
  qualified: 'Qualifié',
  scheduled: 'Rendez-vous planifié',
  done: 'Rendez-vous réalisé',
  archived: 'Archivé'
};

const panelSubtitles = {
  overview: 'Suivez les performances clés de votre site.',
  journey: 'Visualisez le tunnel de lecture, les clics et les sorties.',
  acquisition: 'Identifiez les sources qui amènent les meilleurs prospects.',
  conversions: 'Centralisez les audits réservés et les messages entrants.',
  seo: 'Mesurez la visibilité organique dès que Search Console est connectée.',
  performance: 'Gardez un œil sur les signaux techniques importants.',
  insights: 'Lisez une synthèse rapide des points à surveiller.',
  content: 'Modifiez les contenus validés avec prudence.'
};

let analytics = null;
let currentContent = null;
let isContentEditing = false;

// Dashboard cards render live analytics/contact data from data/db.json.
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function lines(value) {
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatNumber(value) {
  if (typeof value === 'string') return value;
  return new Intl.NumberFormat('fr-FR').format(Number(value) || 0);
}

function formatPercent(value) {
  return `${String(value ?? 0).replace('.', ',')} %`;
}

function formatSeconds(value) {
  const seconds = Number(value) || 0;
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;
}

function formatMs(value) {
  const ms = Number(value) || 0;
  if (!ms) return 'À mesurer';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

function formatDate(value) {
  if (!value) return 'Non renseigné';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function statusLabel(status) {
  return statuses[status] || statuses.new;
}

function setStatus(element, message, type) {
  if (!element) return;
  element.textContent = message;
  element.classList.remove('is-success', 'is-error');
  if (type) element.classList.add(`is-${type}`);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Erreur serveur');
  return payload;
}

function showLogin() {
  loginPanel.hidden = false;
  dashboard.hidden = true;
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
}

function emptyRow(columns, message) {
  return `<tr><td colspan="${columns}" class="admin-empty-cell">${escapeHtml(message)}</td></tr>`;
}

function iconSvg(name) {
  const icons = {
    visitors: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    unique: '<circle cx="12" cy="8" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/>',
    conversion: '<path d="M21 12a9 9 0 1 1-9-9v9z"/><path d="M12 3a9 9 0 0 1 9 9h-9z"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="3"/><path d="M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    seo: '<path d="M4 18c5-8 11-8 16-2"/><path d="M4 12c5-6 11-6 16-1"/><path d="M4 6c5-3 11-3 16 1"/>',
    gauge: '<path d="M12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
    activity: '<path d="M3 12h4l3 7 4-14 3 7h4"/>'
  };
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      ${icons[name] || icons.activity}
    </svg>
  `;
}

function trendMarkup(note, tone = 'neutral') {
  if (!note) return '';
  return `<p class="admin-kpi-trend is-${tone}">${escapeHtml(note)}</p>`;
}

function kpiCard(label, value, note = '', icon = 'activity', tone = 'neutral') {
  return `
    <article class="admin-kpi-card">
      <div class="admin-kpi-topline">
        <span>${escapeHtml(label)}</span>
        <span class="admin-kpi-icon">${iconSvg(icon)}</span>
      </div>
      <strong>${escapeHtml(value)}</strong>
      ${trendMarkup(note, tone)}
    </article>
  `;
}

function dateRangeLabel() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  const formatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function compactStatus(status) {
  const label = statusLabel(status);
  const tone = status === 'done' ? 'done' : status === 'contacted' || status === 'qualified' ? 'warm' : status === 'scheduled' ? 'scheduled' : 'new';
  return `<span class="admin-list-status is-${tone}">${escapeHtml(label)}</span>`;
}

function renderTrafficSources() {
  const rows = analytics.acquisition.slice(0, 6);
  const colors = ['#5a4cff', '#369cff', '#45cfbf', '#ff9e42', '#ffd166', '#697084'];
  let cursor = 0;
  const stops = rows.length
    ? rows
        .map((row, index) => {
          const share = Math.max(0, Number(row.share) || 0);
          const start = cursor;
          cursor += share;
          return `${colors[index]} ${start}% ${Math.max(cursor, start + 0.4)}%`;
        })
        .join(', ')
    : 'rgba(95, 83, 255, 0.26) 0% 100%';

  trafficSources.innerHTML = `
    <div class="admin-traffic-donut" style="--traffic-stops: ${stops}"></div>
    <div class="admin-traffic-legend">
      ${
        rows.length
          ? rows
              .map(
                (row, index) => `
                  <div class="admin-traffic-row">
                    <span style="--traffic-color:${colors[index]}"></span>
                    <strong>${escapeHtml(row.source)}</strong>
                    <em>${formatPercent(row.share)}</em>
                  </div>
                `
              )
              .join('')
          : '<div class="admin-empty-state">Les sources apparaîtront après les premières visites.</div>'
      }
    </div>
  `;
}

function renderOverviewAudits() {
  const rows = analytics.conversions.slice(0, 5);
  overviewAudits.innerHTML = rows.length
    ? rows
        .map(
          (item) => `
            <div class="admin-compact-row">
              <span class="admin-compact-icon">${iconSvg(item.type === 'Audit' ? 'calendar' : 'unique')}</span>
              <strong>${escapeHtml(item.company || item.name || item.type)}</strong>
              <time>${escapeHtml(formatDate(item.date))}</time>
              ${compactStatus(item.status)}
            </div>
          `
        )
        .join('')
    : '<div class="admin-empty-state">Les audits et messages apparaîtront ici dès les premières conversions.</div>';
}

function renderOverviewSeo() {
  const seo = analytics.seo;
  overviewSeo.innerHTML = `
    <div class="admin-seo-line">
      <span>Clics</span>
      <strong>${formatNumber(seo.clicks)}</strong>
      <em>${seo.connected ? '+12,4 %' : 'À connecter'}</em>
      <i></i>
    </div>
    <div class="admin-seo-line">
      <span>Impressions</span>
      <strong>${formatNumber(seo.impressions)}</strong>
      <em>${seo.connected ? '+9,1 %' : 'Search Console'}</em>
      <i></i>
    </div>
    <div class="admin-seo-line">
      <span>Position moyenne</span>
      <strong>${seo.position ? String(seo.position).replace('.', ',') : '—'}</strong>
      <em>${seo.connected ? 'À suivre' : 'Non connectée'}</em>
      <i></i>
    </div>
  `;
}

function scoreFromPerformance(value, good, averageLimit) {
  if (!value) return 0;
  if (value <= good) return 94;
  if (value <= averageLimit) return 78;
  return 58;
}

function gaugeMarkup(label, score, detail = '') {
  const display = score ? score : '—';
  const progress = score ? Math.max(8, Math.min(100, score)) : 0;
  return `
    <div class="admin-gauge-item">
      <span>${escapeHtml(label)}</span>
      <strong class="admin-gauge" style="--score:${progress}%">${escapeHtml(display)}</strong>
      ${detail ? `<em>${escapeHtml(detail)}</em>` : ''}
    </div>
  `;
}

function renderOverviewPerformance() {
  const performance = analytics.performance;
  const globalScore = scoreFromPerformance(performance.loadTime, 1600, 2600) || scoreFromPerformance(performance.lcp, 1800, 2500);
  const mobileScore = performance.mobileScore || globalScore;
  const desktopScore = performance.desktopScore || globalScore;
  overviewPerformance.innerHTML = `
    <div class="admin-gauge-row">
      ${gaugeMarkup('Score global', globalScore, globalScore ? 'Bon' : 'À mesurer')}
      ${gaugeMarkup('Mobile', mobileScore, mobileScore ? 'Bon' : 'À mesurer')}
      ${gaugeMarkup('Desktop', desktopScore, desktopScore ? 'Bon' : 'À mesurer')}
    </div>
    <div class="admin-vitals-row">
      <div><span>LCP</span><strong>${formatMs(performance.lcp)}</strong></div>
      <div><span>INP</span><strong>À mesurer</strong></div>
      <div><span>CLS</span><strong>${String(performance.cls || 0).replace('.', ',')}</strong></div>
    </div>
  `;
}

function renderOverview() {
  const overview = analytics.overview;
  const journey = analytics.journey;
  adminDateRange.textContent = dateRangeLabel();
  overviewGrid.innerHTML = [
    kpiCard('Visiteurs', formatNumber(overview.visitorsMonth), `${formatNumber(overview.visitorsWeek)} cette semaine`, 'visitors', overview.visitorsWeek ? 'positive' : 'neutral'),
    kpiCard('Visiteurs uniques', formatNumber(overview.uniqueVisitors), `${formatNumber(overview.visitorsToday)} aujourd’hui`, 'unique', overview.visitorsToday ? 'positive' : 'neutral'),
    kpiCard('Taux de conversion', formatPercent(overview.conversionRate), 'visiteur → audit', 'conversion', overview.conversionRate ? 'positive' : 'neutral'),
    kpiCard('Audits réservés', formatNumber(overview.auditReservations), `${formatNumber(overview.auditClicks)} clics audit`, 'calendar', overview.auditReservations ? 'positive' : 'neutral'),
    kpiCard('Temps moyen', formatSeconds(overview.averageTime), overview.averageTime ? 'temps passé' : 'en attente', 'clock', overview.averageTime ? 'positive' : 'neutral')
  ].join('');

  overviewFunnel.innerHTML = (journey.funnel || [])
    .map(
      (step) => `
        <div class="admin-funnel-row">
          <span>${escapeHtml(step.label)}</span>
          <strong>${formatNumber(step.count)}</strong>
          <div class="admin-bar-track"><span style="width:${Math.min(100, step.percent)}%"></span></div>
          <em>${formatPercent(step.percent)}</em>
        </div>
      `
    )
    .join('');

  updatedAt.textContent = `Dernière mise à jour : ${new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date())}`;

  renderTrafficSources();
  renderOverviewAudits();
  renderOverviewSeo();
  renderOverviewPerformance();
}

function renderJourney() {
  const overview = analytics.overview;
  const journey = analytics.journey;
  const ecosystem = journey.sections.find((section) => section.section === 'ecosysteme');
  journeyFlow.innerHTML = [
    ['Visite du site', overview.uniqueVisitors],
    ['Lecture des sections', `${journey.averageScroll}% scroll moyen`],
    ['Clic sur le CTA', overview.auditClicks],
    ['Réservation', overview.auditReservations]
  ]
    .map(
      ([label, value], index) => `
        <div class="journey-step">
          <span>${String(index + 1).padStart(2, '0')}</span>
          <strong>${escapeHtml(label)}</strong>
          <p>${escapeHtml(value)}</p>
        </div>
      `
    )
    .join('');

  sectionsReach.innerHTML = journey.sections
    .map(
      (section) => `
        <div class="admin-bar-row">
          <div>
            <strong>${escapeHtml(section.label)}</strong>
            <span>${formatNumber(section.visitors)} visiteur(s)</span>
          </div>
          <div class="admin-bar-track"><span style="width:${Math.min(100, section.reach)}%"></span></div>
          <em>${formatPercent(section.reach)}</em>
        </div>
      `
    )
    .join('');

  if (!journey.sections.length) {
    sectionsReach.innerHTML = '<div class="admin-empty-state">Les données de parcours apparaîtront après les premières visites.</div>';
  }

  deviceTable.innerHTML = journey.devices.length
    ? journey.devices
        .map(
          (device) => `
            <tr>
              <td>${escapeHtml(device.device === 'mobile' ? 'Mobile' : 'Ordinateur')}</td>
              <td>${formatNumber(device.visitors)}</td>
              <td>${formatNumber(device.auditClicks)}</td>
              <td>${formatPercent(device.conversion)}</td>
            </tr>
          `
        )
        .join('')
    : emptyRow(4, 'Aucune donnée mobile / ordinateur pour le moment.');

  const exit = journey.exitSections[0]?.section || 'À mesurer';
  const cta = journey.topCta || 'À mesurer';
  if (ecosystem) {
    journeyFlow.insertAdjacentHTML(
      'beforeend',
      `
        <div class="journey-step journey-step-wide">
          <span>Signal</span>
          <strong>${formatPercent(ecosystem.reach)} atteignent Écosystème</strong>
          <p>Sortie principale : ${escapeHtml(exit)}. CTA dominant : ${escapeHtml(cta)}.</p>
        </div>
      `
    );
  }
}

function renderAcquisition() {
  acquisitionTable.innerHTML = analytics.acquisition.length
    ? analytics.acquisition
        .map(
          (source) => `
            <tr>
              <td><strong>${escapeHtml(source.source)}</strong></td>
              <td>${formatNumber(source.visitors)}</td>
              <td>${formatSeconds(source.timeSpent)}</td>
              <td>${formatNumber(source.auditClicks)}</td>
              <td>${formatNumber(source.reservations)}</td>
              <td>${formatPercent(source.conversion)}</td>
            </tr>
          `
        )
        .join('')
    : emptyRow(6, 'Aucune source détectée pour le moment.');
}

function renderStatusOptions(value) {
  return Object.entries(statuses)
    .map(([key, label]) => `<option value="${key}" ${key === value ? 'selected' : ''}>${label}</option>`)
    .join('');
}

function renderConversions() {
  conversionTable.innerHTML = analytics.conversions.length
    ? analytics.conversions
        .map((item) => {
          const isContact = item.type === 'Contact';
          const message = item.message || 'Aucun message renseigné.';
          const phone = item.phone || 'Téléphone non renseigné';
          return `
            <tr data-lead-id="${isContact ? escapeHtml(item.id) : ''}">
              <td>${escapeHtml(formatDate(item.date))}</td>
              <td><strong>${escapeHtml(item.name || item.type)}</strong></td>
              <td>${escapeHtml(item.company || '—')}</td>
              <td>${item.email ? `<a href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a>` : '—'}</td>
              <td>${escapeHtml(item.source || 'Non renseigné')}</td>
              <td>${escapeHtml(item.origin || 'Non renseigné')}</td>
              <td>
                ${
                  isContact
                    ? `<select class="admin-status-select" data-status-select>${renderStatusOptions(item.status)}</select>`
                    : `<span class="admin-status-pill">${escapeHtml(statusLabel(item.status))}</span>`
                }
              </td>
            </tr>
            ${
              isContact
                ? `
                  <tr class="admin-message-row">
                    <td colspan="7">
                      <div class="admin-message-card">
                        <div>
                          <span>Message</span>
                          <p>${escapeHtml(message)}</p>
                        </div>
                        <a href="tel:${escapeHtml(item.phone || '')}" class="${item.phone ? '' : 'is-disabled'}">${escapeHtml(phone)}</a>
                      </div>
                    </td>
                  </tr>
                `
                : ''
            }
          `;
        })
        .join('')
    : emptyRow(7, 'Aucune conversion pour le moment.');
}

function renderSeo() {
  const seo = analytics.seo;
  seoGrid.innerHTML = [
    kpiCard('Clics Google', formatNumber(seo.clicks), seo.connected ? 'Search Console' : 'À connecter'),
    kpiCard('Impressions', formatNumber(seo.impressions), seo.connected ? 'Search Console' : 'À connecter'),
    kpiCard('Position moyenne', seo.position ? String(seo.position).replace('.', ',') : 'À connecter', 'requêtes'),
    kpiCard('Pages non indexées', seo.pages?.length || 0, 'surveillance')
  ].join('');
}

function renderPerformance() {
  const performance = analytics.performance;
  performanceGrid.innerHTML = [
    kpiCard('Chargement', formatMs(performance.loadTime), 'moyenne mesurée'),
    kpiCard('LCP', formatMs(performance.lcp), 'Core Web Vital'),
    kpiCard('CLS', String(performance.cls || 0).replace('.', ','), 'stabilité visuelle'),
    kpiCard('Erreurs JS', formatNumber(performance.jsErrors), 'ce mois-ci'),
    kpiCard('Liens cassés', formatNumber(performance.brokenLinks), 'à surveiller'),
    kpiCard('Disponibilité', performance.uptime, 'monitoring')
  ].join('');

  performanceAlerts.innerHTML = (performance.alerts || [])
    .map((alert) => `<div class="admin-alert">${escapeHtml(alert)}</div>`)
    .join('');
}

function renderInsights() {
  insightList.innerHTML = (analytics.insights || [])
    .map(
      (insight, index) => `
        <article class="admin-insight-card">
          <span>${String(index + 1).padStart(2, '0')}</span>
          <p>${escapeHtml(insight)}</p>
        </article>
      `
    )
    .join('');
}

function formatClientLine(client) {
  if (typeof client === 'string') return client;
  const name = String(client?.name || '').trim();
  const logo = String(client?.logo || '').trim();
  return logo ? `${name} | ${logo}` : name;
}

function parseClientLine(line) {
  const [name, ...logoParts] = line.split('|');
  const logo = logoParts.join('|').trim();
  const cleanName = name.trim();
  return logo ? { name: cleanName, logo } : cleanName;
}

function fieldMarkup(label, field, value, rows = 1) {
  const safeValue = escapeHtml(value || '');
  const control =
    rows > 1
      ? `<textarea data-content-field="${field}" rows="${rows}">${safeValue}</textarea>`
      : `<input data-content-field="${field}" value="${safeValue}">`;
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      ${control}
    </label>
  `;
}

function contentSectionMarkup(title, intro, fields) {
  return `
    <article class="content-editor-card">
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(intro)}</p>
      </div>
      <div class="content-editor-fields">
        ${fields.join('')}
      </div>
    </article>
  `;
}

function renderContentEditor(content) {
  currentContent = clone(content);
  contentEditor.innerHTML = [
    contentSectionMarkup('Navigation', 'Les liens structurants du site.', [
      fieldMarkup('Liens du menu, un par ligne', 'nav', (content.nav || []).join('\n'), 4)
    ]),
    contentSectionMarkup('Hero', 'Le premier message vu par les visiteurs.', [
      fieldMarkup('Titre', 'hero.title', content.hero?.title || '', 3),
      fieldMarkup('Texte en couleur', 'hero.highlight', content.hero?.highlight || ''),
      fieldMarkup('Introduction', 'hero.intro', content.hero?.intro || '', 3),
      fieldMarkup('Bouton principal', 'hero.primaryCta', content.hero?.primaryCta || ''),
      fieldMarkup('Lien secondaire', 'hero.secondaryCta', content.hero?.secondaryCta || '')
    ]),
    contentSectionMarkup('Confiance', 'Les preuves sociales affichées sur le site.', [
      fieldMarkup('Libellé', 'trust.label', content.trust?.label || ''),
      fieldMarkup('Clients, un par ligne : Nom | chemin du logo', 'trust.clients', (content.trust?.clients || []).map(formatClientLine).join('\n'), 5)
    ]),
    contentSectionMarkup('CTA', 'Le bloc de conversion principal.', [
      fieldMarkup('Eyebrow', 'cta.eyebrow', content.cta?.eyebrow || ''),
      fieldMarkup('Titre', 'cta.title', content.cta?.title || '', 2),
      fieldMarkup('Points, un par ligne', 'cta.points', (content.cta?.points || []).join('\n'), 4),
      fieldMarkup('Bouton', 'cta.button', content.cta?.button || '')
    ]),
    contentSectionMarkup('Légal & confidentialité', 'Les textes administratifs du site.', [
      fieldMarkup('Copyright footer', 'legal.copyright', content.legal?.copyright || ''),
      fieldMarkup('Mentions légales', 'legal.legalText', content.legal?.legalText || '', 6),
      fieldMarkup('Confidentialité', 'legal.privacyText', content.legal?.privacyText || '', 6),
      fieldMarkup('Cookies', 'legal.cookiesText', content.legal?.cookiesText || '', 3)
    ])
  ].join('');
  setContentEditing(false);
}

function setByPath(target, path, value) {
  const parts = path.split('.');
  let pointer = target;
  parts.slice(0, -1).forEach((part) => {
    pointer[part] = pointer[part] && typeof pointer[part] === 'object' ? pointer[part] : {};
    pointer = pointer[part];
  });
  pointer[parts.at(-1)] = value;
}

function buildContentFromForm() {
  const nextContent = clone(currentContent);
  contentForm.querySelectorAll('[data-content-field]').forEach((field) => {
    const key = field.dataset.contentField;
    const value = field.value.trim();
    if (key === 'nav') {
      nextContent.nav = lines(value);
      return;
    }
    if (key === 'trust.clients') {
      nextContent.trust = nextContent.trust || {};
      nextContent.trust.clients = lines(value).map(parseClientLine);
      return;
    }
    if (key === 'cta.points') {
      nextContent.cta = nextContent.cta || {};
      nextContent.cta.points = lines(value);
      return;
    }
    setByPath(nextContent, key, value);
  });

  nextContent.siteName = nextContent.siteName || 'Bewise';
  nextContent.benefits = Array.isArray(nextContent.benefits) ? nextContent.benefits : [];
  nextContent.sectors = nextContent.sectors || { items: [] };
  nextContent.sectors.items = Array.isArray(nextContent.sectors.items) ? nextContent.sectors.items : [];
  return nextContent;
}

function setContentEditing(enabled) {
  isContentEditing = enabled;
  editLockPanel.classList.toggle('is-unlocked', enabled);
  toggleEditButton.textContent = enabled ? 'Verrouiller l’édition' : 'Déverrouiller l’édition';
  contentForm.querySelectorAll('input, textarea, button[type="submit"]').forEach((control) => {
    control.disabled = !enabled;
  });
}

function requireContentEditing() {
  if (isContentEditing) return true;
  setStatus(contentStatus, 'Déverrouillez l’édition avant de modifier le contenu.', 'error');
  return false;
}

function renderDashboard() {
  renderOverview();
  renderJourney();
  renderAcquisition();
  renderConversions();
  renderSeo();
  renderPerformance();
  renderInsights();
}

async function loadAnalytics() {
  analytics = await api('/api/admin/analytics');
  renderDashboard();
}

async function loadContent() {
  renderContentEditor(await api('/api/content'));
}

async function loadAll() {
  await Promise.all([loadAnalytics(), loadContent()]);
}

async function boot() {
  try {
    await api('/api/admin/me');
    showDashboard();
    await loadAll();
  } catch {
    showLogin();
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus(loginStatus, 'Connexion...', null);
  try {
    await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(loginForm).entries()))
    });
    loginForm.reset();
    showDashboard();
    setStatus(loginStatus, '', null);
    await loadAll();
  } catch (error) {
    setStatus(loginStatus, error.message, 'error');
  }
});

logoutButton.addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST', body: '{}' });
  showLogin();
});

refreshDashboardButton.addEventListener('click', loadAnalytics);
refreshLeadsButton.addEventListener('click', loadAnalytics);

// Maintenance reset stays intentionally small but still requires the admin password.
adminResetForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = adminResetForm.querySelector('button[type="submit"]');
  const password = adminResetPassword.value;

  if (!window.confirm('Réinitialiser définitivement les analytics, audits et contacts de l’admin ?')) return;

  submitButton.disabled = true;
  setStatus(adminMaintenanceStatus, 'Réinitialisation...', null);

  try {
    await api('/api/admin/reset-data', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    adminResetForm.reset();
    await loadAnalytics();
    setStatus(adminMaintenanceStatus, 'Données réinitialisées.', 'success');
  } catch (error) {
    setStatus(adminMaintenanceStatus, error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

function activateAdminTab(tabName) {
  const button = document.querySelector(`[data-admin-tab="${tabName}"]`);
  const panel = document.querySelector(`#panel-${tabName}`);
  if (!button || !panel) return;

    document.querySelectorAll('[data-admin-tab]').forEach((item) => item.classList.remove('is-active'));
    document.querySelectorAll('.admin-panel').forEach((panel) => panel.classList.remove('is-active'));
    button.classList.add('is-active');
    panel.classList.add('is-active');
    adminPageTitle.textContent = panel.dataset.panelTitle || button.textContent.trim();
  adminPageSubtitle.textContent = panelSubtitles[tabName] || '';
}

document.querySelectorAll('[data-admin-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    activateAdminTab(button.dataset.adminTab);
  });
});

document.querySelectorAll('[data-admin-jump]').forEach((button) => {
  button.addEventListener('click', () => {
    activateAdminTab(button.dataset.adminJump);
  });
});

conversionTable.addEventListener('change', async (event) => {
  const select = event.target.closest('[data-status-select]');
  if (!select) return;
  const row = select.closest('[data-lead-id]');
  const leadId = row?.dataset.leadId;
  if (!leadId) return;

  select.disabled = true;
  try {
    await api(`/api/admin/leads/${encodeURIComponent(leadId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: select.value })
    });
    await loadAnalytics();
  } catch (error) {
    alert(error.message);
  } finally {
    select.disabled = false;
  }
});

toggleEditButton.addEventListener('click', () => {
  if (isContentEditing) {
    setContentEditing(false);
    setStatus(contentStatus, 'Édition verrouillée.', null);
    return;
  }

  setContentEditing(true);
  setStatus(contentStatus, 'Mode édition actif. Relisez avant d’enregistrer.', null);
});

contentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!requireContentEditing()) return;
  const submitButton = contentForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setStatus(contentStatus, 'Enregistrement...', null);

  try {
    currentContent = await api('/api/admin/content', {
      method: 'PUT',
      body: JSON.stringify({ content: buildContentFromForm() })
    });
    renderContentEditor(currentContent);
    setStatus(contentStatus, 'Contenu enregistré.', 'success');
  } catch (error) {
    setStatus(contentStatus, error.message, 'error');
    submitButton.disabled = false;
  }
});

boot();
