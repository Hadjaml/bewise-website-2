const loginPanel = document.querySelector('#login-panel');
const dashboard = document.querySelector('#dashboard');
const loginForm = document.querySelector('#login-form');
const loginStatus = document.querySelector('#login-status');
const logoutButton = document.querySelector('#logout-button');
const refreshLeadsButton = document.querySelector('#refresh-leads');
const leadList = document.querySelector('#lead-list');
const contentForm = document.querySelector('#content-form');
const contentStatus = document.querySelector('#content-status');
const benefitsEditor = document.querySelector('#benefits-editor');
const sectorsEditor = document.querySelector('#sectors-editor');
const addBenefitButton = document.querySelector('#add-benefit');
const addSectorButton = document.querySelector('#add-sector');
const toggleEditButton = document.querySelector('#toggle-edit');
const editLockPanel = document.querySelector('#edit-lock-panel');

const statuses = {
  new: 'Nouveau',
  contacted: 'Contacté',
  qualified: 'Qualifié',
  done: 'Traité',
  archived: 'Archivé'
};

function statusLabel(status) {
  return statuses[status] || statuses.new;
}

let currentContent = null;
let isContentEditing = false;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function lines(value) {
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
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

function setStatus(element, message, type) {
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
  if (!response.ok) {
    throw new Error(payload.error || 'Erreur serveur');
  }
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

function setContentEditing(enabled) {
  isContentEditing = enabled;
  contentForm.classList.toggle('is-locked', !enabled);
  editLockPanel.classList.toggle('is-unlocked', enabled);
  toggleEditButton.textContent = enabled ? 'Verrouiller l’édition' : 'Déverrouiller l’édition';
  contentForm.querySelectorAll('input, textarea, select, button').forEach((control) => {
    control.disabled = !enabled;
  });
}

function requireContentEditing() {
  if (isContentEditing) return true;
  setStatus(contentStatus, 'Déverrouillez l’édition avant de modifier le contenu.', 'error');
  return false;
}

function renderSelectOptions(value) {
  return Object.entries(statuses)
    .map(([key, label]) => `<option value="${key}" ${key === value ? 'selected' : ''}>${label}</option>`)
    .join('');
}

function updateLeadCardStatus(card, status) {
  card.dataset.status = status;
  const pill = card.querySelector('.status-pill');
  if (pill) {
    pill.className = `status-pill status-${status}`;
    pill.textContent = statusLabel(status);
  }
}

function renderLeads(leads) {
  if (!leads.length) {
    leadList.innerHTML = '<div class="empty-state">Aucune demande pour le moment.</div>';
    return;
  }

  leadList.innerHTML = leads
    .map((lead) => {
      const date = lead.createdAt ? new Date(lead.createdAt).toLocaleString('fr-FR') : '';
      const contact = [lead.email, lead.phone].filter(Boolean).join(' · ');
      const status = lead.status || 'new';
      return `
        <article class="lead-card" data-lead-id="${escapeHtml(lead.id)}" data-status="${escapeHtml(status)}">
          <div class="lead-main">
            <div class="lead-meta">
              <span>${escapeHtml(date)}</span>
              <span>${escapeHtml(lead.company)}</span>
            </div>
            <div class="lead-title-row">
              <h2>${escapeHtml(lead.name)}</h2>
              <span class="status-pill status-${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
            </div>
            <p>${escapeHtml(contact)}</p>
            ${lead.message ? `<p>${escapeHtml(lead.message)}</p>` : ''}
          </div>
          <div class="lead-actions">
            <label class="field">
              <span>Statut</span>
              <select data-status-select>${renderSelectOptions(lead.status || 'new')}</select>
            </label>
          </div>
        </article>
      `;
    })
    .join('');
}

async function loadLeads() {
  leadList.innerHTML = '<div class="empty-state">Chargement des demandes...</div>';
  try {
    renderLeads(await api('/api/admin/leads'));
  } catch (error) {
    leadList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function benefitEditorTemplate(benefit, index) {
  const icon = benefit.icon || 'clock';
  const options = ['clock', 'chart', 'shield', 'grow']
    .map((name) => `<option value="${name}" ${name === icon ? 'selected' : ''}>${name}</option>`)
    .join('');

  return `
    <div class="editable-item benefit-row">
      <div class="editable-item-header">
        <p class="editable-item-title">Bénéfice ${index + 1}</p>
        <button class="remove-button" type="button" aria-label="Retirer ce bénéfice" data-remove-benefit="${index}">×</button>
      </div>
      <div class="field">
        <label>Icône</label>
        <select data-field="icon">${options}</select>
      </div>
      <div class="field">
        <label>Titre</label>
        <input data-field="title" value="${escapeHtml(benefit.title)}">
      </div>
      <div class="field field-full">
        <label>Texte</label>
        <textarea data-field="text" rows="3">${escapeHtml(benefit.text)}</textarea>
      </div>
    </div>
  `;
}

function sectorEditorTemplate(sector, index) {
  return `
    <div class="editable-item sector-row">
      <div class="editable-item-header">
        <p class="editable-item-title">Secteur ${index + 1}</p>
        <button class="remove-button" type="button" aria-label="Retirer ce secteur" data-remove-sector="${index}">×</button>
      </div>
      <div class="field">
        <label>Libellé</label>
        <input data-field="label" value="${escapeHtml(sector.label)}">
      </div>
      <div class="field">
        <label>Titre</label>
        <input data-field="title" value="${escapeHtml(sector.title)}">
      </div>
      <div class="field field-full">
        <label>Texte</label>
        <textarea data-field="text" rows="3">${escapeHtml(sector.text)}</textarea>
      </div>
      <div class="field field-full">
        <label>Image</label>
        <input data-field="image" value="${escapeHtml(sector.image)}" placeholder="/assets/sectors/btp.jpg">
      </div>
    </div>
  `;
}

function renderListEditors() {
  benefitsEditor.innerHTML = (currentContent.benefits || []).map(benefitEditorTemplate).join('');
  sectorsEditor.innerHTML = (currentContent.sectors?.items || []).map(sectorEditorTemplate).join('');
  setContentEditing(isContentEditing);
}

function fillContentForm(content) {
  currentContent = structuredClone(content);
  document.querySelector('#nav-items').value = (content.nav || []).join('\n');
  document.querySelector('#hero-title-field').value = content.hero?.title || '';
  document.querySelector('#hero-highlight-field').value = content.hero?.highlight || '';
  document.querySelector('#hero-intro-field').value = content.hero?.intro || '';
  document.querySelector('#hero-primary-field').value = content.hero?.primaryCta || '';
  document.querySelector('#hero-secondary-field').value = content.hero?.secondaryCta || '';
  document.querySelector('#trust-label-field').value = content.trust?.label || '';
  document.querySelector('#clients-field').value = (content.trust?.clients || []).map(formatClientLine).join('\n');
  document.querySelector('#sectors-eyebrow-field').value = content.sectors?.eyebrow || '';
  document.querySelector('#sectors-title-field').value = content.sectors?.title || '';
  document.querySelector('#sectors-intro-field').value = content.sectors?.intro || '';
  document.querySelector('#cta-eyebrow-field').value = content.cta?.eyebrow || '';
  document.querySelector('#cta-title-field').value = content.cta?.title || '';
  document.querySelector('#cta-points-field').value = (content.cta?.points || []).join('\n');
  document.querySelector('#cta-button-field').value = content.cta?.button || '';
  document.querySelector('#legal-copyright-field').value = content.legal?.copyright || '';
  document.querySelector('#legal-label-field').value = content.legal?.legalLabel || '';
  document.querySelector('#privacy-label-field').value = content.legal?.privacyLabel || '';
  document.querySelector('#legal-title-field').value = content.legal?.legalTitle || '';
  document.querySelector('#privacy-title-field').value = content.legal?.privacyTitle || '';
  document.querySelector('#legal-text-field').value = content.legal?.legalText || '';
  document.querySelector('#privacy-text-field').value = content.legal?.privacyText || '';
  document.querySelector('#cookies-text-field').value = content.legal?.cookiesText || '';
  document.querySelector('#cookies-button-field').value = content.legal?.cookiesButton || '';
  renderListEditors();
}

async function loadContent() {
  fillContentForm(await api('/api/content'));
}

function readRows(selector) {
  return [...document.querySelectorAll(selector)].map((row) => {
    const item = {};
    row.querySelectorAll('[data-field]').forEach((field) => {
      item[field.dataset.field] = field.value.trim();
    });
    return item;
  });
}

function buildContentFromForm() {
  return {
    siteName: currentContent.siteName || 'Bewise',
    nav: lines(document.querySelector('#nav-items').value),
    hero: {
      title: document.querySelector('#hero-title-field').value.trim(),
      highlight: document.querySelector('#hero-highlight-field').value.trim(),
      intro: document.querySelector('#hero-intro-field').value.trim(),
      primaryCta: document.querySelector('#hero-primary-field').value.trim(),
      secondaryCta: document.querySelector('#hero-secondary-field').value.trim()
    },
    trust: {
      label: document.querySelector('#trust-label-field').value.trim(),
      clients: lines(document.querySelector('#clients-field').value).map(parseClientLine)
    },
    benefits: readRows('.benefit-row'),
    sectors: {
      eyebrow: document.querySelector('#sectors-eyebrow-field').value.trim(),
      title: document.querySelector('#sectors-title-field').value.trim(),
      intro: document.querySelector('#sectors-intro-field').value.trim(),
      items: readRows('.sector-row')
    },
    cta: {
      eyebrow: document.querySelector('#cta-eyebrow-field').value.trim(),
      title: document.querySelector('#cta-title-field').value.trim(),
      points: lines(document.querySelector('#cta-points-field').value),
      button: document.querySelector('#cta-button-field').value.trim()
    },
    legal: {
      copyright: document.querySelector('#legal-copyright-field').value.trim(),
      legalLabel: document.querySelector('#legal-label-field').value.trim(),
      privacyLabel: document.querySelector('#privacy-label-field').value.trim(),
      legalTitle: document.querySelector('#legal-title-field').value.trim(),
      privacyTitle: document.querySelector('#privacy-title-field').value.trim(),
      legalText: document.querySelector('#legal-text-field').value.trim(),
      privacyText: document.querySelector('#privacy-text-field').value.trim(),
      cookiesText: document.querySelector('#cookies-text-field').value.trim(),
      cookiesButton: document.querySelector('#cookies-button-field').value.trim()
    }
  };
}

async function boot() {
  try {
    await api('/api/admin/me');
    showDashboard();
    await Promise.all([loadLeads(), loadContent()]);
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
    await Promise.all([loadLeads(), loadContent()]);
  } catch (error) {
    setStatus(loginStatus, error.message, 'error');
  }
});

logoutButton.addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST', body: '{}' });
  showLogin();
});

refreshLeadsButton.addEventListener('click', loadLeads);

leadList.addEventListener('change', async (event) => {
  const select = event.target.closest('[data-status-select]');
  if (!select) return;

  const card = select.closest('[data-lead-id]');
  select.disabled = true;
  try {
    await api(`/api/admin/leads/${encodeURIComponent(card.dataset.leadId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: select.value })
    });
    updateLeadCardStatus(card, select.value);
  } catch (error) {
    alert(error.message);
  } finally {
    select.disabled = false;
  }
});

document.querySelectorAll('.tab-button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab-button').forEach((item) => item.classList.remove('is-active'));
    document.querySelectorAll('.admin-panel').forEach((panel) => panel.classList.remove('is-active'));
    button.classList.add('is-active');
    document.querySelector(`#panel-${button.dataset.tab}`).classList.add('is-active');
  });
});

addBenefitButton.addEventListener('click', () => {
  if (!requireContentEditing()) return;
  currentContent.benefits = currentContent.benefits || [];
  currentContent.benefits.push({ icon: 'clock', title: 'Nouveau bénéfice', text: '' });
  renderListEditors();
});

addSectorButton.addEventListener('click', () => {
  if (!requireContentEditing()) return;
  currentContent.sectors = currentContent.sectors || { items: [] };
  currentContent.sectors.items = currentContent.sectors.items || [];
  currentContent.sectors.items.push({ label: 'Nouveau secteur', title: '', text: '', image: '' });
  renderListEditors();
});

benefitsEditor.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-benefit]');
  if (!button) return;
  if (!requireContentEditing()) return;
  if (!window.confirm('Retirer ce bénéfice du site ?')) return;
  currentContent.benefits.splice(Number(button.dataset.removeBenefit), 1);
  renderListEditors();
});

sectorsEditor.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-sector]');
  if (!button) return;
  if (!requireContentEditing()) return;
  if (!window.confirm('Retirer ce secteur du site ?')) return;
  currentContent.sectors.items.splice(Number(button.dataset.removeSector), 1);
  renderListEditors();
});

toggleEditButton.addEventListener('click', () => {
  if (isContentEditing) {
    setContentEditing(false);
    setStatus(contentStatus, 'Édition verrouillée.', null);
    return;
  }

  if (!window.confirm('Déverrouiller l’édition du contenu public ?')) return;
  setContentEditing(true);
  setStatus(contentStatus, 'Mode édition actif. Vérifiez vos changements avant d’enregistrer.', null);
});

contentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!requireContentEditing()) return;
  if (!window.confirm('Enregistrer ces modifications sur le site public ?')) return;
  const submitButton = contentForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setStatus(contentStatus, 'Enregistrement...', null);

  try {
    currentContent = await api('/api/admin/content', {
      method: 'PUT',
      body: JSON.stringify({ content: buildContentFromForm() })
    });
    fillContentForm(currentContent);
    setContentEditing(false);
    setStatus(contentStatus, 'Contenu enregistré.', 'success');
  } catch (error) {
    setStatus(contentStatus, error.message, 'error');
  } finally {
    submitButton.disabled = !isContentEditing;
  }
});

boot();
