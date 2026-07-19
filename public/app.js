const menuButton = document.querySelector('[data-menu-toggle]');
const nav = document.querySelector('[data-nav]');
const form = document.querySelector('#lead-form');
const formStatus = document.querySelector('#form-status');
const cookieBanner = document.querySelector('#cookie-banner');
const cookieAcceptButton = document.querySelector('#cookie-accept');
const modalButtons = document.querySelectorAll('[data-open-modal]');
const closeModalButtons = document.querySelectorAll('[data-close-modal]');
const metricsSection = document.querySelector('.metrics-section');
const methodTimeline = document.querySelector('.method-timeline');
const methodSteps = Array.from(document.querySelectorAll('.method-step'));
const ecosystemSection = document.querySelector('.ecosystem-section');
const ecosystemStage = document.querySelector('#ecosystem-stage');
const ecosystemFlow = document.querySelector('.ecosystem-flow');
const ecosystemTabs = Array.from(document.querySelectorAll('[data-ecosystem-tab]'));
const ecosystemNodes = Array.from(document.querySelectorAll('[data-ecosystem-node]'));
let lastFocusedElement = null;
const sectionRoutes = {
  '/': '#expertise',
  '/notreapproche': '#approche',
  '/ecosysteme': '#ecosysteme',
  '/apropos': '#apropos',
  '/nouscontacter': '#contact',
  '/realisations': '#realisations'
};
const anchorRoutes = {
  '#expertise': '/',
  '#approche': '/notreapproche',
  '#ecosysteme': '/ecosysteme',
  '#apropos': '/apropos',
  '#contact': '/nouscontacter',
  '#realisations': '/realisations'
};

document.documentElement.classList.add('js-enabled');

// Lightweight first-party analytics for the admin dashboard.
function storageId(storage, key) {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const next = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  storage.setItem(key, next);
  return next;
}

function getVisitorId() {
  return storageId(localStorage, 'bewiseVisitorId');
}

function getSessionId() {
  return storageId(sessionStorage, 'bewiseSessionId');
}

function getTrafficSource() {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  if (utmSource) return utmSource;
  const referrer = document.referrer;
  if (!referrer) return 'Accès direct';

  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('google.')) return 'Google';
    if (host.includes('linkedin.')) return 'LinkedIn';
    if (host.includes('instagram.')) return 'Instagram';
    if (host.includes('tiktok.')) return 'TikTok';
    if (host.includes('facebook.') || host.includes('meta.')) return 'Réseaux sociaux';
    if (host.includes(window.location.hostname)) return 'Interne';
    return 'Sites partenaires';
  } catch {
    return 'Accès direct';
  }
}

function getDeviceType() {
  return window.matchMedia('(max-width: 760px)').matches ? 'mobile' : 'desktop';
}

function sectionNameFromElement(element) {
  if (element.id) return element.id;
  if (element.classList.contains('metrics-section')) return 'impact';
  return 'section';
}

function trackEvent(type, detail = {}) {
  const payload = {
    type,
    path: window.location.pathname || '/',
    title: document.title,
    source: getTrafficSource(),
    referrer: document.referrer,
    device: getDeviceType(),
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    ...detail
  };
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    return;
  }

  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => {});
}

trackEvent('page_view');

if ('IntersectionObserver' in window) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.target.dataset.sectionTracked) return;
        entry.target.dataset.sectionTracked = 'true';
        trackEvent('section_view', { section: sectionNameFromElement(entry.target) });
      });
    },
    { rootMargin: '0px 0px -34% 0px', threshold: 0.22 }
  );

  document.querySelectorAll('main section[id], .metrics-section').forEach((section) => sectionObserver.observe(section));
}

const scrollDepths = [25, 50, 75, 100];
const trackedScrollDepths = new Set();

function updateScrollDepth() {
  const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const depth = Math.round((window.scrollY / scrollable) * 100);
  scrollDepths.forEach((target) => {
    if (depth < target || trackedScrollDepths.has(target)) return;
    trackedScrollDepths.add(target);
    trackEvent('scroll_depth', { value: target });
  });
}

let scrollTrackingTicking = false;
window.addEventListener(
  'scroll',
  () => {
    if (scrollTrackingTicking) return;
    scrollTrackingTicking = true;
    window.requestAnimationFrame(() => {
      updateScrollDepth();
      scrollTrackingTicking = false;
    });
  },
  { passive: true }
);

window.addEventListener('pagehide', () => {
  trackEvent('time_on_page', { value: Math.round(performance.now() / 1000) });
});

window.addEventListener('error', (event) => {
  trackEvent('js_error', { message: event.message });
});

window.addEventListener('unhandledrejection', (event) => {
  trackEvent('js_error', { message: event.reason?.message || 'Promise rejetée' });
});

window.addEventListener('load', () => {
  const navigation = performance.getEntriesByType('navigation')[0];
  let lcp = 0;
  let cls = 0;

  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries.at(-1);
        if (lastEntry) lcp = Math.round(lastEntry.startTime);
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      const clsObserver = new PerformanceObserver((entryList) => {
        entryList.getEntries().forEach((entry) => {
          if (!entry.hadRecentInput) cls += entry.value;
        });
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch {
      // Browsers that do not expose these observers still send load timing.
    }
  }

  window.setTimeout(() => {
    trackEvent('performance', {
      loadMs: navigation ? Math.round(navigation.loadEventEnd || navigation.duration) : Math.round(performance.now()),
      lcp,
      cls: Math.round(cls * 1000) / 1000
    });
  }, 1200);
});

window.addEventListener('message', (event) => {
  if (!String(event.origin).includes('calendly.com')) return;
  if (event.data?.event !== 'calendly.event_scheduled') return;
  trackEvent('audit_reserved', { cta: 'Calendly' });
});

function setStatus(message, type) {
  if (!formStatus) return;
  formStatus.textContent = message;
  formStatus.classList.remove('is-success', 'is-error');
  if (type) formStatus.classList.add(`is-${type}`);
}

function closeMenu() {
  nav?.classList.remove('is-open');
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Ouvrir le menu');
}

menuButton?.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
});

nav?.addEventListener('click', (event) => {
  if (event.target.closest('a')) closeMenu();
});

function cleanPath(pathname) {
  return pathname.replace(/\/+$/, '') || '/';
}

function routeTarget(pathname) {
  return sectionRoutes[cleanPath(pathname)];
}

function scrollToRoute(pathname, behavior = 'smooth') {
  const selector = routeTarget(pathname);
  const target = selector ? document.querySelector(selector) : null;
  if (!target) return false;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : behavior, block: 'start' });
  return true;
}

function navigateToRoute(pathname, replace = false) {
  const nextPath = cleanPath(pathname);
  if (!routeTarget(nextPath)) return false;

  closeMenu();
  if (cleanPath(window.location.pathname) !== nextPath || window.location.search || window.location.hash) {
    window.history[replace ? 'replaceState' : 'pushState'](null, '', nextPath);
  }
  scrollToRoute(nextPath);
  return true;
}

// Keep clean section URLs while preserving in-page navigation and history.
document.querySelectorAll('a[href^="#"], a[href^="/"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const href = link.getAttribute('href');
    const routePath = href.startsWith('#') ? anchorRoutes[href] : routeTarget(new URL(href, window.location.origin).pathname) && href;
    if (!routePath) return;

    event.preventDefault();
    navigateToRoute(routePath);
  });
});

const initialRoute = window.location.hash && anchorRoutes[window.location.hash] ? anchorRoutes[window.location.hash] : cleanPath(window.location.pathname);
if (routeTarget(initialRoute)) {
  window.history.replaceState(null, '', initialRoute);
  if (initialRoute !== '/') window.requestAnimationFrame(() => scrollToRoute(initialRoute, 'auto'));
}

window.addEventListener('popstate', () => {
  scrollToRoute(cleanPath(window.location.pathname), 'auto');
});

if (metricsSection) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    metricsSection.classList.add('is-visible');
  } else {
    const metricsObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          metricsSection.classList.add('is-visible');
          metricsObserver.unobserve(metricsSection);
        });
      },
      {
        rootMargin: '0px 0px -16% 0px',
        threshold: 0.24
      }
    );

    metricsObserver.observe(metricsSection);
  }
}

function openModal(name) {
  const modal = document.querySelector(`[data-modal="${name}"]`);
  if (!modal) return;
  lastFocusedElement = document.activeElement;
  modal.hidden = false;
  document.body.classList.add('is-modal-open');
  modal.querySelector('[data-close-modal]')?.focus();
}

function closeModal(modal) {
  if (!modal) return;
  modal.hidden = true;
  if (!document.querySelector('[data-modal]:not([hidden])')) {
    document.body.classList.remove('is-modal-open');
  }
  lastFocusedElement?.focus?.();
}

// Calendly stays in a modal so audit booking does not send visitors away.
modalButtons.forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    closeMenu();
    if (button.dataset.openModal === 'audit') {
      const section = button.closest('section') ? sectionNameFromElement(button.closest('section')) : 'header';
      trackEvent('audit_click', {
        section,
        cta: button.textContent.replace(/\s+/g, ' ').trim()
      });
    }
    openModal(button.dataset.openModal);
  });
});

closeModalButtons.forEach((button) => {
  button.addEventListener('click', () => closeModal(button.closest('[data-modal]')));
});

document.querySelectorAll('[data-modal]').forEach((modal) => {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal(modal);
  });
});

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'escape') {
    closeMenu();
    document.querySelectorAll('[data-modal]:not([hidden])').forEach(closeModal);
  }

  if ((event.ctrlKey || event.metaKey) && event.altKey && key === 'b') {
    event.preventDefault();
    window.location.href = '/admin';
  }
});

if (cookieBanner && localStorage.getItem('bewiseCookieConsent') !== 'accepted') {
  cookieBanner.hidden = false;
}

cookieAcceptButton?.addEventListener('click', () => {
  localStorage.setItem('bewiseCookieConsent', 'accepted');
  cookieBanner.hidden = true;
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.source = getTrafficSource();
  payload.path = window.location.pathname || '/nouscontacter';
  payload.origin = 'Formulaire contact';
  payload.visitorId = getVisitorId();
  payload.sessionId = getSessionId();

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
    setStatus('Merci, votre message a bien été envoyé.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

if (methodTimeline && methodSteps.length) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  methodSteps.forEach((step, index) => {
    step.style.setProperty('--method-step-index', index);
  });

  if (prefersReducedMotion) {
    methodTimeline.style.setProperty('--method-progress', '1');
    methodSteps.forEach((step) => step.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      },
      {
        rootMargin: '0px 0px -18% 0px',
        threshold: 0.24
      }
    );

    methodSteps.forEach((step) => revealObserver.observe(step));

    let timelineTicking = false;

    function updateMethodProgress() {
      const rect = methodTimeline.getBoundingClientRect();
      const viewportAnchor = window.innerHeight * 0.62;
      const progress = (viewportAnchor - rect.top) / rect.height;
      const clampedProgress = Math.min(1, Math.max(0, progress));
      methodTimeline.style.setProperty('--method-progress', clampedProgress.toFixed(3));
    }

    function requestMethodProgressUpdate() {
      if (timelineTicking) return;
      timelineTicking = true;
      window.requestAnimationFrame(() => {
        updateMethodProgress();
        timelineTicking = false;
      });
    }

    updateMethodProgress();
    window.addEventListener('scroll', requestMethodProgressUpdate, { passive: true });
    window.addEventListener('resize', requestMethodProgressUpdate);
  }
}

const ecosystemIconMarkup = {
  users:
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M17 21a5 5 0 0 0-10 0"></path><circle cx="12" cy="8" r="4"></circle><path d="M19 8v4"></path><path d="M21 10h-4"></path></svg>',
  message:
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M4 5h16v11H8l-4 4Z"></path><path d="M8 9h8"></path><path d="M8 13h5"></path></svg>',
  document:
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6"></path><path d="M8 13h8"></path><path d="M8 17h5"></path></svg>',
  folder:
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path><path d="M3 7V6a2 2 0 0 1 2-2h5l2 3"></path></svg>',
  chart:
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M4 20V10"></path><path d="M10 20V4"></path><path d="M16 20v-7"></path><path d="M22 20V8"></path><path d="M2 20h22"></path></svg>',
  inbox:
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M4 4h16l2 10v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5Z"></path><path d="M7 14h3a2 2 0 0 0 4 0h3"></path></svg>',
  calendar:
    '<svg viewBox="0 0 24 24" focusable="false"><rect x="4" y="5" width="16" height="15" rx="2"></rect><path d="M8 3v4"></path><path d="M16 3v4"></path><path d="M4 10h16"></path><path d="M8 14h3"></path></svg>',
  build:
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M14 6 8 12l4 4 6-6"></path><path d="M4 20 8 16"></path><path d="M15 5l4-2 2 2-2 4"></path></svg>',
  bag:
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M6 8h12l-1 13H7Z"></path><path d="M9 8a3 3 0 0 1 6 0"></path></svg>',
  truck:
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M3 6h11v10H3Z"></path><path d="M14 10h4l3 3v3h-7Z"></path><circle cx="7" cy="18" r="2"></circle><circle cx="18" cy="18" r="2"></circle></svg>',
  headset:
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M4 14v-3a8 8 0 0 1 16 0v3"></path><path d="M18 19c0 1.1-.9 2-2 2h-2"></path><rect x="2" y="12" width="4" height="7" rx="2"></rect><rect x="18" y="12" width="4" height="7" rx="2"></rect></svg>',
  heart:
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M20.8 6.6a5.1 5.1 0 0 0-7.2 0L12 8.2l-1.6-1.6a5.1 5.1 0 1 0-7.2 7.2L12 22l8.8-8.2a5.1 5.1 0 0 0 0-7.2Z"></path></svg>',
  refresh:
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M20 7v5h-5"></path><path d="M4 17v-5h5"></path><path d="M18 12a6 6 0 0 0-10-4"></path><path d="M6 12a6 6 0 0 0 10 4"></path></svg>'
};

const ecosystemData = {
  services: {
    nodes: [
      { title: 'Prospection', icon: 'users', items: ['Qualification des demandes', 'Préparation des rendez-vous', 'Enrichissement du CRM'] },
      { title: 'Relation client', icon: 'message', items: ['Comptes rendus', 'E-mails & relances', 'Suivi des échanges'] },
      { title: 'Production', icon: 'document', items: ['Documents & livrables', 'Contrôle qualité', 'Validation interne'] },
      { title: 'Administration', icon: 'folder', items: ['Facturation', 'Signatures', 'Classement documentaire'] },
      { title: 'Pilotage', icon: 'chart', items: ['Rentabilité', 'Charge des équipes', 'Tableaux de bord'] }
    ]
  },
  industrie: {
    nodes: [
      { title: 'Demandes', icon: 'inbox', items: ['Qualification du besoin', 'Études techniques', 'Préparation des devis'] },
      { title: 'Planification', icon: 'calendar', items: ['Planning des équipes', 'Affectation des ressources', 'Coordination des fournisseurs'] },
      { title: 'Exécution', icon: 'build', items: ['Suivi de chantier', 'Production', 'Contrôle qualité'] },
      { title: 'Gestion', icon: 'folder', items: ['Documents réglementaires', 'Comptes rendus', 'Facturation'] },
      { title: 'Pilotage', icon: 'chart', items: ['Avancement', 'Marges', 'Délais', 'Indicateurs de terrain'] }
    ]
  },
  commerce: {
    nodes: [
      { title: 'Acquisition', icon: 'users', items: ['Qualification des prospects', 'Réponses commerciales', 'Prise de commande'] },
      { title: 'Commandes', icon: 'bag', items: ['Validation', 'Paiement', 'Préparation'] },
      { title: 'Logistique', icon: 'truck', items: ['Stocks', 'Expédition', 'Suivi des livraisons'] },
      { title: 'Relation client', icon: 'headset', items: ['SAV', 'Retours', 'Fidélisation'] },
      { title: 'Performance', icon: 'chart', items: ['Ventes', 'Prévisions', 'Marges', 'Produits gagnants'] }
    ]
  },
  sante: {
    nodes: [
      { title: 'Accueil', icon: 'calendar', items: ['Prise de rendez-vous', 'Qualification des demandes', 'Orientation'] },
      { title: 'Accompagnement', icon: 'heart', items: ['Dossiers', 'Comptes rendus', 'Coordination'] },
      { title: 'Suivi', icon: 'refresh', items: ['Relances', 'Planification', 'Communication'] },
      { title: 'Administration', icon: 'document', items: ['Documents', 'Facturation', 'Conformité'] },
      { title: 'Pilotage', icon: 'chart', items: ['Occupation', 'Satisfaction', 'Indicateurs', 'Qualité de service'] }
    ]
  }
};

function animateEcosystemFrieze() {
  if (!ecosystemSection?.classList.contains('is-in-view')) return;

  ecosystemFlow?.classList.remove('is-switching');
  ecosystemNodes.forEach((node) => node.classList.remove('is-switching'));
  void ecosystemFlow?.offsetWidth;
  ecosystemFlow?.classList.add('is-switching');
  ecosystemNodes.forEach((node) => node.classList.add('is-switching'));
}

function setEcosystem(tabName, shouldAnimate = true) {
  const nextData = ecosystemData[tabName] || ecosystemData.services;
  ecosystemTabs.forEach((tab) => {
    const isActive = tab.dataset.ecosystemTab === tabName;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    tab.setAttribute('tabindex', isActive ? '0' : '-1');
    if (isActive && ecosystemStage && tab.id) ecosystemStage.setAttribute('aria-labelledby', tab.id);
  });

  ecosystemNodes.forEach((node, index) => {
    const item = nextData.nodes[index] || nextData.nodes[0];
    node.style.setProperty('--ecosystem-index', index);
    const icon = node.querySelector('.ecosystem-icon');
    if (icon) icon.innerHTML = ecosystemIconMarkup[item.icon] || ecosystemIconMarkup.document;
    node.querySelector('h3').textContent = item.title;
    const list = node.querySelector('ul');
    if (list) {
      list.replaceChildren(
        ...item.items.map((text) => {
          const listItem = document.createElement('li');
          listItem.textContent = text;
          return listItem;
        })
      );
    }
  });

  if (shouldAnimate) animateEcosystemFrieze();
}

if (ecosystemTabs.length && ecosystemNodes.length) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  ecosystemNodes.forEach((node, index) => {
    node.style.setProperty('--ecosystem-index', index);
  });

  ecosystemTabs.forEach((tab) => {
    tab.addEventListener('click', () => setEcosystem(tab.dataset.ecosystemTab));
    tab.addEventListener('keydown', (event) => {
      const key = event.key;
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;
      event.preventDefault();

      const currentIndex = ecosystemTabs.indexOf(tab);
      const nextIndex =
        key === 'Home'
          ? 0
          : key === 'End'
            ? ecosystemTabs.length - 1
            : key === 'ArrowRight'
              ? (currentIndex + 1) % ecosystemTabs.length
              : (currentIndex - 1 + ecosystemTabs.length) % ecosystemTabs.length;
      const nextTab = ecosystemTabs[nextIndex];
      nextTab.focus();
      setEcosystem(nextTab.dataset.ecosystemTab);
    });
  });

  const activeTab = ecosystemTabs.find((tab) => tab.classList.contains('is-active')) || ecosystemTabs[0];
  setEcosystem(activeTab.dataset.ecosystemTab, false);

  if (ecosystemSection) {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      ecosystemSection.classList.add('is-in-view');
    } else {
      let ecosystemSectionInView = false;
      const ecosystemObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !ecosystemSectionInView) {
              ecosystemSectionInView = true;
              ecosystemSection.classList.add('is-in-view');
              animateEcosystemFrieze();
            } else if (!entry.isIntersecting) {
              ecosystemSectionInView = false;
              ecosystemSection.classList.remove('is-in-view');
              ecosystemFlow?.classList.remove('is-switching');
              ecosystemNodes.forEach((node) => node.classList.remove('is-switching'));
            }
          });
        },
        {
          rootMargin: '0px 0px -18% 0px',
          threshold: 0.16
        }
      );

      ecosystemObserver.observe(ecosystemSection);
    }
  }
}
