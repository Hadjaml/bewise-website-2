const navTargets = {
  expertise: '#expertise',
  méthode: '#solutions',
  methode: '#solutions',
  approche: '#solutions',
  secteurs: '#secteurs',
  solutions: '#solutions',
  'à propos': '#apropos',
  ressources: '#ressources'
};

const defaultContent = {
  nav: ['Méthode', 'Secteurs'],
  hero: {
    title: 'Nous concevons des entreprises\nplus performantes\ngrâce à l’IA.',
    highlight: 'plus performantes',
    intro:
      'Bewise aide les PME à éliminer les tâches à faible valeur ajoutée pour libérer du temps, sécuriser les processus et accélérer la croissance.',
    primaryCta: 'Audit offert',
    secondaryCta: 'Découvrir notre approche'
  },
  trust: {
    label: 'Des entreprises qui nous font confiance',
    clients: [
      { name: 'TotalEnergies', logo: '/assets/clients/totalenergies.png' },
      { name: 'LogicSystem', logo: '/assets/clients/logicsystem.png' },
      { name: 'Sopra Steria', logo: '/assets/clients/sopra-steria.png' },
      { name: 'BNP Paribas', logo: '/assets/clients/bnp-paribas.png' },
      { name: 'MeaL', logo: '/assets/clients/meal.png' },
      { name: 'SN Barat', logo: '/assets/clients/sn-barat.png' }
    ]
  },
  benefits: [],
  sectors: {
    eyebrow: 'Experts des PME',
    title: 'Deux univers. Une expertise commune.',
    intro: 'Nous comprenons vos métiers. Nous concevons des solutions qui créent de la valeur.',
    items: [
      {
        label: 'Cabinets comptables',
        title: 'Automatisez. Sécurisez.\nConcentrez-vous sur le conseil.',
        text: 'Nous aidons les cabinets à automatiser la production, sécuriser les données et améliorer l’expérience client.',
        image: '/assets/sectors/comptable.jpg'
      },
      {
        label: 'BTP',
        title: 'Des chantiers mieux pilotés.\nDes entreprises plus rentables.',
        text: 'Nous optimisons vos processus de gestion, de suivi et de reporting pour des opérations plus efficaces.',
        image: '/assets/sectors/btp.jpg'
      }
    ]
  },
  cta: {
    eyebrow: 'Un premier pas simple et rapide',
    title: 'Et si on trouvait ensemble vos gains de performance ?',
    points: [
      'Analyse de vos processus clés',
      'Identification des opportunités',
      'Estimation des gains post intégrations',
      'Recommandations concrètes'
    ],
    button: 'Demander mon audit offert'
  },
  legal: {
    copyright: '© 2024 Bewise. Tous droits réservés.',
    legalLabel: 'Mentions légales',
    privacyLabel: 'Confidentialité',
    legalTitle: 'Mentions légales',
    legalText:
      'Bewise accompagne les PME dans l’automatisation de leurs processus et l’intégration de solutions d’intelligence artificielle.\n\nÉditeur du site : Bewise\nContact : contact@bewise.fr\nResponsable de publication : Direction Bewise\n\nLes contenus présents sur ce site sont fournis à titre informatif et peuvent être mis à jour à tout moment.',
    privacyTitle: 'Confidentialité',
    privacyText:
      'Les informations transmises via le formulaire d’audit sont utilisées uniquement pour répondre à votre demande et vous recontacter.\n\nBewise ne revend pas vos données personnelles. Vous pouvez demander l’accès, la modification ou la suppression de vos informations en nous contactant à contact@bewise.fr.',
    cookiesText:
      'Nous utilisons uniquement des cookies nécessaires au bon fonctionnement du site et à la mémorisation de votre choix.',
    cookiesButton: 'Accepter'
  }
};

const menuButton = document.querySelector('[data-menu-toggle]');
const nav = document.querySelector('[data-nav]');
const form = document.querySelector('#lead-form');
const formStatus = document.querySelector('#form-status');
const cookieBanner = document.querySelector('#cookie-banner');
const cookieAcceptButton = document.querySelector('#cookie-accept');
const modalButtons = document.querySelectorAll('[data-open-modal]');
const closeModalButtons = document.querySelectorAll('[data-close-modal]');
let lastFocusedElement = null;

const sectorDetailContent = {
  accounting: {
    theme: 'purple',
    label: 'Cabinets comptables',
    icon: 'calculator',
    title: 'Automatisez votre production.',
    highlight: 'Gardez le contrôle de vos données.',
    heroImage: '/assets/modal/accounting-security-transparent.png',
    proofImage: '/assets/modal/accounting-lock.png',
    intro: '',
    automationTitle: 'Pourquoi les cabinets travaillent avec nous',
    features: [
      ['folder', 'Collecte et classement des pièces'],
      ['refresh', 'Pré-comptabilité et traitements répétitifs'],
      ['mail', 'Relances clients automatiques'],
      ['chart', 'Reporting et tableaux de bord'],
      ['puzzle', 'Workflows entre vos logiciels']
    ],
    proofTitle: '',
    proof: [
      'Gouvernance des données pensée dès la conception',
      'Hébergement souverain ou infrastructure maîtrisée',
      'Automatisations fiables et auditables',
      'Intégration à votre environnement existant'
    ]
  },
  btp: {
    theme: 'orange',
    label: 'Entreprises du BTP',
    icon: 'helmet',
    title: 'Moins d’administratif.',
    highlight: 'Plus de terrain.',
    heroImage: '/assets/modal/btp-app-excavator-transparent.png',
    proofImage: '/assets/modal/btp-helmet-transparent.png',
    intro: '',
    automationTitle: 'Pourquoi les entreprises du BTP choisissent Bewise',
    features: [
      ['file', 'Devis et factures plus rapides'],
      ['bell', 'Relances clients automatisées'],
      ['clipboard', 'Suivi de chantiers et dépenses simplifié'],
      ['archive', 'Classement des documents automatique'],
      ['chart', 'Tableaux de bord clairs et à jour']
    ],
    proofTitle: '',
    proof: [
      'Solutions simples et intuitives, sans prise de tête',
      'Mise en place rapide, résultats visibles vite',
      'Moins d’erreurs, plus de réactivité',
      'Un accompagnement proche de vos réalités terrain'
    ]
  }
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeCssString(value) {
  return String(value ?? '').replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', '');
}

function normalizeLineBreaks(value) {
  return String(value ?? '').replaceAll('\\n', '\n');
}

function appendTextWithBreaks(parent, text) {
  normalizeLineBreaks(text)
    .split('\n')
    .forEach((line, index) => {
      if (index > 0) parent.append(document.createElement('br'));
      parent.append(document.createTextNode(line));
    });
}

function renderHighlighted(element, text, highlight) {
  element.textContent = '';
  const title = String(text || '');
  const highlighted = String(highlight || '');
  const index = highlighted ? title.indexOf(highlighted) : -1;

  if (index === -1) {
    appendTextWithBreaks(element, title);
    return;
  }

  appendTextWithBreaks(element, title.slice(0, index));
  const span = document.createElement('span');
  appendTextWithBreaks(span, highlighted);
  element.append(span);
  appendTextWithBreaks(element, title.slice(index + highlighted.length));
}

function iconSvg(icon) {
  const icons = {
    clock:
      '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v6l4 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    chart:
      '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M5 19V9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M12 19V5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M19 19v-8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    shield:
      '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v10" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    grow:
      '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M7 17L17 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10 7h7v7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v8h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  return icons[icon] || icons.grow;
}

function detailIconSvg(icon) {
  const icons = {
    calculator:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h.01M8 15h2M12 15h2M16 15h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    helmet:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 14h18v4H3zM9 6v8M15 6v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    folder:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    refresh:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M18 12a6 6 0 0 0-10-4M6 12a6 6 0 0 0 10 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    mail:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    chart:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9M12 19V5M19 19v-8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    puzzle:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6v4h4v6h-4v4H9v-4H5V7h4V3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    file:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l3 3v15H7zM14 3v4h4M9 12h6M9 16h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    bell:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16h12l-1.2-2V10a4.8 4.8 0 0 0-9.6 0v4L6 16zM10 19h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    clipboard:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5H6v16h12V5h-2M9 3h6v4H9zM9 13l2 2 4-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    archive:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v14H4zM3 3h18v4H3zM9 12h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'
  };

  return icons[icon] || icons.file;
}

function detailVisualMarkup(detail, type) {
  const src = type === 'proof' ? detail.proofImage : detail.heroImage;
  if (!src) return '';
  return `<img src="${escapeHtml(src)}" alt="" loading="eager" decoding="async">`;
}

function sectorDetailKey(sector) {
  return String(sector.label || '').toLowerCase().includes('btp') ? 'btp' : 'accounting';
}

function renderNav(content) {
  nav.innerHTML = '';
  (content.nav || defaultContent.nav).forEach((item) => {
    const link = document.createElement('a');
    link.href = navTargets[item.trim().toLowerCase()] || '#audit';
    link.textContent = item;
    nav.append(link);
  });
}

function renderClientMarquee(clients) {
  const safeClients = clients.length ? clients : defaultContent.trust.clients;
  const visibleItems = safeClients.map((client) => renderClientItem(client)).join('');
  const duplicateItems = safeClients.map((client) => renderClientItem(client, true)).join('');
  document.querySelector('#client-grid').innerHTML = `${visibleItems}${duplicateItems}`;
}

function normalizeClient(client) {
  if (typeof client === 'string') return { name: client, logo: '' };
  return {
    name: String(client?.name || ''),
    logo: String(client?.logo || '')
  };
}

function renderClientItem(client, hidden = false) {
  const item = normalizeClient(client);
  const ariaHidden = hidden ? ' aria-hidden="true"' : '';
  if (item.logo) {
    return `
      <span class="client-logo"${ariaHidden}>
        <img src="${escapeHtml(item.logo)}" alt="${hidden ? '' : escapeHtml(item.name)}" loading="lazy" decoding="async">
      </span>
    `;
  }

  return `<span${ariaHidden}>${escapeHtml(item.name)}</span>`;
}

function renderContent(content) {
  const data = { ...defaultContent, ...content };
  const hero = { ...defaultContent.hero, ...data.hero };
  const trust = { ...defaultContent.trust, ...data.trust };
  const sectors = { ...defaultContent.sectors, ...data.sectors };
  const cta = { ...defaultContent.cta, ...data.cta };
  const legal = { ...defaultContent.legal, ...data.legal };

  renderNav(data);
  renderHighlighted(document.querySelector('#hero-title'), hero.title, hero.highlight);
  document.querySelector('#hero-intro').textContent = hero.intro;
  document.querySelector('#hero-primary').textContent = hero.primaryCta;
  document.querySelector('#hero-secondary').textContent = hero.secondaryCta;

  document.querySelector('#trust-title').textContent = trust.label;
  renderClientMarquee(trust.clients || []);

  document.querySelector('#benefit-grid').innerHTML = (data.benefits || [])
    .map(
      (benefit) => `
        <article class="benefit-card">
          <div class="benefit-icon">${iconSvg(benefit.icon)}</div>
          <h3>${escapeHtml(benefit.title)}</h3>
          <p>${escapeHtml(benefit.text)}</p>
        </article>
      `
    )
    .join('');

  document.querySelector('#sector-eyebrow').textContent = sectors.eyebrow;
  renderHighlighted(document.querySelector('#sector-title'), sectors.title, 'expertise commune');
  document.querySelector('#sector-intro').textContent = sectors.intro;
  document.querySelector('#sector-grid').innerHTML = (sectors.items || [])
    .map((sector) => {
      const image = String(sector.image || '').trim();
      const imageClass = image ? ' has-image' : '';
      const imageStyle = image ? ` style="--sector-image: url('${escapeHtml(escapeCssString(image))}')"` : '';

      return `
        <article class="sector-card${imageClass}"${imageStyle}>
          <p class="sector-label">${escapeHtml(sector.label)}</p>
          <h3>${escapeHtml(normalizeLineBreaks(sector.title))}</h3>
          <p>${escapeHtml(sector.text)}</p>
          <button class="sector-more" type="button" data-sector-detail="${sectorDetailKey(sector)}">En savoir plus <span aria-hidden="true">→</span></button>
        </article>
      `;
    })
    .join('');

  document.querySelector('#cta-eyebrow').textContent = cta.eyebrow;
  renderHighlighted(document.querySelector('#audit-title'), cta.title, 'gains de performance');
  document.querySelector('#cta-points').innerHTML = (cta.points || [])
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join('');
  document.querySelector('#cta-button').textContent = cta.button;

  document.querySelector('#footer-copyright').textContent = legal.copyright;
  document.querySelector('#legal-link-label').textContent = legal.legalLabel;
  document.querySelector('#privacy-link-label').textContent = legal.privacyLabel;
  document.querySelector('#legal-modal-title').textContent = legal.legalTitle;
  document.querySelector('#legal-modal-text').textContent = legal.legalText;
  document.querySelector('#privacy-modal-title').textContent = legal.privacyTitle;
  document.querySelector('#privacy-modal-text').textContent = legal.privacyText;
  document.querySelector('#cookie-text').textContent = legal.cookiesText;
  document.querySelector('#cookie-button-label').textContent = legal.cookiesButton;

  if (localStorage.getItem('bewiseCookieConsent') !== 'accepted') {
    cookieBanner.hidden = false;
  }
}

async function loadContent() {
  try {
    const response = await fetch('/api/content');
    if (!response.ok) throw new Error('Content unavailable');
    renderContent(await response.json());
  } catch {
    renderContent(defaultContent);
  }
}

function setStatus(message, type) {
  formStatus.textContent = message;
  formStatus.classList.remove('is-success', 'is-error');
  if (type) formStatus.classList.add(`is-${type}`);
}

menuButton.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
});

nav.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    nav.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Ouvrir le menu');
  }
});

function openModal(name) {
  const modal = document.querySelector(`[data-modal="${name}"]`);
  if (!modal) return;
  lastFocusedElement = document.activeElement;
  modal.hidden = false;
  modal.querySelector('[data-close-modal]')?.focus();
}

function closeModal(modal) {
  if (!modal) return;
  modal.hidden = true;
  lastFocusedElement?.focus?.();
}

function openSectorDetail(key) {
  const detail = sectorDetailContent[key];
  if (!detail) return;
  const modal = document.querySelector('[data-modal="sector-detail"]');
  const card = document.querySelector('#sector-detail-card');
  card.dataset.theme = detail.theme;
  document.querySelector('#sector-detail-icon').innerHTML = detailIconSvg(detail.icon);
  document.querySelector('#sector-detail-label').textContent = detail.label;
  document.querySelector('#sector-detail-title').innerHTML = `
    <span class="sector-detail-title-main">${escapeHtml(detail.title)}</span>
    <span class="sector-detail-title-highlight">${escapeHtml(detail.highlight)}</span>
  `;
  const intro = document.querySelector('#sector-detail-intro');
  intro.textContent = detail.intro || '';
  intro.hidden = !detail.intro;
  document.querySelector('#sector-detail-automation-title').textContent = detail.automationTitle;
  document.querySelector('#sector-detail-features').innerHTML = detail.features
    .map(
      ([icon, label]) => `
        <article class="detail-feature">
          <div class="detail-feature-icon">${detailIconSvg(icon)}</div>
          <p>${escapeHtml(label)}</p>
        </article>
      `
    )
    .join('');
  const proofTitle = document.querySelector('#sector-detail-proof-title');
  proofTitle.textContent = detail.proofTitle || '';
  proofTitle.hidden = !detail.proofTitle;
  document.querySelector('#sector-detail-proof-list').innerHTML = detail.proof
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  document.querySelector('#sector-detail-visual').innerHTML = detailVisualMarkup(detail, 'hero');
  document.querySelector('#sector-detail-proof-visual').innerHTML = detailVisualMarkup(detail, 'proof');
  lastFocusedElement = document.activeElement;
  modal.hidden = false;
  modal.querySelector('[data-close-modal]')?.focus();
}

modalButtons.forEach((button) => {
  button.addEventListener('click', () => openModal(button.dataset.openModal));
});

closeModalButtons.forEach((button) => {
  button.addEventListener('click', () => closeModal(button.closest('[data-modal]')));
});

document.querySelectorAll('[data-modal]').forEach((modal) => {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal(modal);
  });
});

document.addEventListener('click', (event) => {
  const sectorCta = event.target.closest('.sector-detail-cta');
  if (sectorCta) {
    closeModal(document.querySelector('[data-modal="sector-detail"]'));
    return;
  }

  const sectorButton = event.target.closest('[data-sector-detail]');
  if (!sectorButton) return;
  openSectorDetail(sectorButton.dataset.sectorDetail);
});

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'escape') {
    document.querySelectorAll('[data-modal]:not([hidden])').forEach(closeModal);
  }
  if ((event.ctrlKey || event.metaKey) && event.altKey && key === 'b') {
    event.preventDefault();
    window.location.href = '/admin';
  }
});

cookieAcceptButton.addEventListener('click', () => {
  localStorage.setItem('bewiseCookieConsent', 'accepted');
  cookieBanner.hidden = true;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  const payload = Object.fromEntries(new FormData(form).entries());

  submitButton.disabled = true;
  setStatus('Envoi en cours...', null);

  try {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Impossible d’envoyer la demande');

    form.reset();
    setStatus('Merci, votre demande a bien été envoyée.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

loadContent();
