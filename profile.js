/**
 * profile.js – Profiilimodaali ja datanvienti (PWA-offline-tuella)
 *
 * Vastaa profiilimodaalin renderöinnistä ja
 * käyttäjätietojen JSON-viennistä.
 *
 * Riippuvuudet:
 *   – prefs.js  (getPrefs, exportPrefsAsJson, followTag,
 *                unfollowTag, isFollowing, onPrefsChange)
 *   – Firebase Auth user-objekti
 */

import {
  getPrefs,
  exportPrefsAsJson,
  unfollowTag,
  onPrefsChange,
  updatePrefs
} from './prefs.js';

import { getAuth, signOut, deleteUser } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

let _user    = null;
let _modal   = null;
let _unsub   = null;

/** Alusta moduuli – luo modaali-DOM ja rekisteröi kuuntelijat. */
export function initProfileModal(user) {
  _user = user;
  _ensureModal();
}

/** Avaa profiilimodaali. */
export function openProfileModal() {
  if (!_modal) return;
  _renderContent();
  _modal.removeAttribute('hidden');
  _modal.setAttribute('aria-modal', 'true');
  document.body.style.overflow = 'hidden';
  _modal.querySelector('.profile-close')?.focus();
}

/** Sulje profiilimodaali. */
export function closeProfileModal() {
  if (!_modal) return;
  _modal.setAttribute('hidden', '');
  _modal.removeAttribute('aria-modal');
  document.body.style.overflow = '';
}

// ── Sisäiset ─────────────────────────────────────────────────────

function _ensureModal() {
  if (_modal) return;

  _modal = document.createElement('div');
  _modal.id = 'profile-modal';
  _modal.setAttribute('role', 'dialog');
  _modal.setAttribute('aria-labelledby', 'profile-modal-title');
  _modal.setAttribute('hidden', '');
  _modal.innerHTML = `
    <div class="profile-backdrop"></div>
    <div class="profile-panel">
      <div class="profile-header">
        <h2 id="profile-modal-title" class="profile-title">Profiili</h2>
        <button class="profile-close" aria-label="Sulje profiili">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="profile-body"></div>
    </div>
  `;

  // Sulkeminen
  _modal.querySelector('.profile-backdrop')
    .addEventListener('click', closeProfileModal);
  _modal.querySelector('.profile-close')
    .addEventListener('click', closeProfileModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeProfileModal();
  });

  document.body.appendChild(_modal);

  // Päivitä seuratut tagit reaaliajassa
  _unsub = onPrefsChange(() => {
    if (!_modal.hasAttribute('hidden')) _renderContent();
  });
}

function _renderContent() {
  const body  = _modal.querySelector('.profile-body');
  const prefs = getPrefs();
  const tags  = prefs.followedTags ?? [];

  // Offline-varma kuvan renderöinti: jos kuvaa ei ole tai sen lataus epäonnistuu,
  // käytetään paikallista inline-SVG-avatar-ikonia.
  let avatarHTML = '';
  if (_user.photoURL) {
    avatarHTML = `<img src="${_escAttr(_user.photoURL)}" alt="" width="64" height="64"
                       class="profile-avatar" loading="lazy"
                       onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">`;
  }

  const svgFallback = `
    <svg class="profile-avatar-fallback" width="64" height="64" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="1.5"
         style="background:var(--color-surface-offset); border-radius:var(--radius-full); padding:var(--space-2); color:var(--color-text-muted); ${_user.photoURL ? 'display:none;' : ''}">
      <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  `;

  body.innerHTML = `
    <div class="profile-user">
      <div style="position:relative; width:64px; height:64px; flex-shrink:0;">
        ${avatarHTML}
        ${svgFallback}
      </div>
      <div>
        <div class="profile-name">${_escHtml(_user.displayName || '–')}</div>
        <div class="profile-email">${_escHtml(_user.email || '')}</div>
        <div class="profile-created" style="font-size:var(--text-xs);color:var(--color-text-faint);margin-top:var(--space-1)">Liittynyt: ${new Date(_user.metadata.creationTime).toLocaleDateString('fi-FI')}</div>
      </div>
    </div>

    <section class="profile-section">
      <h3 class="profile-section-title">Seuratut aiheet</h3>
      ${
        tags.length === 0
          ? '<p class="profile-empty">Et seuraa vielä yhtään aihetta.<br>Klikkaa artikkelin tagia aloittaaksesi seurannan.</p>'
          : `<div class="profile-tags">${
              tags.map(tag => `
                <span class="profile-tag">
                  <span class="profile-tag-name">${_escHtml(tag)}</span>
                  <button class="profile-tag-remove"
                          data-tag="${_escAttr(tag)}"
                          aria-label="Lopeta ${_escHtml(tag)}-seuranta">
                    <svg width="12" height="12" viewBox="0 0 24 24"
                         fill="none" stroke="currentColor" stroke-width="2.5">
                       <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </span>
              `).join('')
            }</div>`
      }
    </section>

    <section class="profile-section">
      <h3 class="profile-section-title">Ulkoasu</h3>
      <div class="profile-theme-select">
        <select id="profile-theme" class="profile-select" aria-label="Valitse teema">
          <option value="system" ${prefs.theme === 'system' ? 'selected' : ''}>Järjestelmän oletus</option>
          <option value="light" ${prefs.theme === 'light' ? 'selected' : ''}>Vaalea</option>
          <option value="dark" ${prefs.theme === 'dark' ? 'selected' : ''}>Tumma</option>
        </select>
      </div>
    </section>

    <section class="profile-section">
      <h3 class="profile-section-title">Omat tiedot</h3>
      <p class="profile-help"
         style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-4)">
        Lataa kaikki tallennetut asetuksesi JSON-tiedostona.
      </p>
      <button class="btn-export" id="btn-export-json">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Lataa asetukset (JSON)
      </button>
    </section>

    <section class="profile-section">
      <h3 class="profile-section-title">Tilinhallinta</h3>
      <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;margin-top:var(--space-2)">
        <button class="btn-profile-logout" id="btn-profile-logout">Kirjaudu ulos</button>
        <button class="btn-danger" id="btn-delete-account">Poista tili</button>
      </div>
    </section>
  `;

  // Tagien poisto
  body.querySelectorAll('.profile-tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      unfollowTag(btn.dataset.tag);
    });
  });

  // Teeman valinta
  body.querySelector('#profile-theme')?.addEventListener('change', e => {
    updatePrefs({ theme: e.target.value });
  });

  // JSON-vienti
  body.querySelector('#btn-export-json')?.addEventListener('click', () => {
    exportPrefsAsJson(_user);
  });

  // Kirjaudu ulos profiilista
  body.querySelector('#btn-profile-logout')?.addEventListener('click', () => {
    const auth = getAuth();
    signOut(auth);
    closeProfileModal();
  });

  // Poista tili
  body.querySelector('#btn-delete-account')?.addEventListener('click', async () => {
    if (confirm("Haluatko varmasti poistaa tilisi ja kaikki asetuksesi pysyvästi? Tätä toimintoa ei voi peruuttaa.")) {
      try {
        const uid = _user.uid;
        localStorage.removeItem(`prefs_${uid}`);
        localStorage.removeItem(`seen_${uid}`);
        
        await deleteUser(_user);
        alert("Tili ja paikalliset asetukset poistettu onnistuneesti.");
        closeProfileModal();
      } catch (err) {
        console.error("Tilin poisto epäonnistui", err);
        if (err.code === 'auth/requires-recent-login') {
          alert("Tämä toiminto vaatii äskettäisen sisäänkirjautumisen. Kirjaudu uudelleen sisään ja yritä uudelleen.");
        } else {
          alert("Tilin poistaminen epäonnistui: " + err.message);
        }
      }
    }
  });
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _escAttr(str) {
  return String(str).replace(/"/g,'&quot;');
}
