/**
 * app.js – Sovelluksen juurimoduuli / Application Root Module
 *
 * Vastaa / Responsible for:
 *   - Firebase-alustuksesta ja autentikoinnista (Google Sign-In) / Firebase initialization and Google Sign-In auth
 *   - Kirjautumismodaalin auki/kiinni-logiikasta / Toggle logic for the login modal
 *   - Auth-tilan muutoksiin reagoinnista / Reacting to Authentication state changes:
 *       kirjautunut / signed in  → initPrefs(app, uid), initProfileModal(user), loadPrefs()
 *       kirjautunut ulos / signed out → initPrefs(app, null), loadPrefs()
 *
 * Arkkitehtuuriraja / Architectural boundary:
 *   Tämä moduuli omistaa Firebase Auth -yhteyden. / This module owns the Firebase Auth connection.
 *   Preferenssien persistointi (Firestore + localStorage) on delegoitu prefs.js:lle. / Preferences persistence (Firestore + localStorage) is delegated to prefs.js.
 *   Profiilimodaalin UI on delegoitu profile.js:lle. / Profile modal UI is delegated to profile.js.
 *   app.js ei lue eikä kirjoita preferenssejä suoraan. / app.js does not read or write preferences directly.
 *
 * Riippuvuudet / Dependencies:
 *   – prefs.js  (initPrefs, loadPrefs)
 *   – profile.js (initProfileModal, openProfileModal)
 *   – Firebase Auth, Analytics (NPM)
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';
import { initPrefs, loadPrefs, followTag, unfollowTag, isFollowing, onPrefsChange, getPrefs, updatePrefs, exportPrefsAsJson, deleteUserPrefs } from './prefs.js';
import { initProfileModal, openProfileModal } from './profile.js';
import { Workbox } from 'workbox-window';

// ---- SCROLL OBSERVER ----
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.feed-item, .feature-item').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(16px)';
  el.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
  observer.observe(el);
});

// ---- FIREBASE INITIALIZATION ----
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy-api-key-for-local-dev-only",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dummy-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dummy-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dummy-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:1234567890abcdef",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-DUMMY"
};


const app = initializeApp(firebaseConfig);
// Analytics alustetaan vain, jos measurementId on määritelty ja käyttäjä on antanut suostumuksensa (GDPR / L-009)
const analytics = (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID && localStorage.getItem('consent_analytics') === 'true')
  ? getAnalytics(app)
  : null;
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const userProfile = document.getElementById('user-profile');
const userAvatar = document.getElementById('user-avatar');
const btnProfile = document.getElementById('btn-profile');

const modalLogin = document.getElementById('modal-login');
const btnCloseLogin = document.getElementById('btn-close-login');
const btnGoogleLogin = document.getElementById('btn-google-login');
const btnSkipLogin = document.getElementById('btn-skip-login');

// Login-modalin auki/kiinni-logiikka
const openLogin = () => modalLogin.classList.add('is-open');
const closeLogin = () => modalLogin.classList.remove('is-open');

btnLogin.addEventListener('click', openLogin);
btnCloseLogin.addEventListener('click', closeLogin);
btnSkipLogin.addEventListener('click', closeLogin);



btnGoogleLogin.addEventListener('click', async () => {
  closeLogin();
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Login failed", error);
    if (error.code === 'auth/unauthorized-domain') {
      showNotification('Tämä verkkotunnus ei ole sallittu Firebase-konsolissa. Lisää se Authorized domains -listalle.', true);
    }
  }
});

btnLogout.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Alustetaan preferenssit ja profiilimodaali kirjautuneelle käyttäjälle
    initPrefs(app, user.uid);
    initProfileModal(user);

    btnLogin.style.display = 'none';
    userProfile.style.display = 'flex';
    userAvatar.src = user.photoURL || '';
    userAvatar.title = user.displayName;
    if (user.photoURL) {
      userAvatar.style.display = 'block';
      userAvatar.nextElementSibling.style.display = 'none';
    } else {
      userAvatar.style.display = 'none';
      userAvatar.nextElementSibling.style.display = 'block';
    }

    await loadPrefs();
    updateNotificationsBadge();

    // Check for pending comment (Issue #11)
    const pendingArticleId = localStorage.getItem('pending_comment_article_id');
    if (pendingArticleId) {
      setTimeout(async () => {
        const card = document.querySelector(`.feed-item[data-id="${pendingArticleId}"]`);
        if (card) {
          const btn = card.querySelector('.btn-comments-toggle');
          const section = card.querySelector(`.feed-item__comments-section[data-id="${pendingArticleId}"]`);
          if (btn && section) {
            section.style.display = 'block';
            section.innerHTML = '<div style="font-size:var(--text-xs); color:var(--color-text-faint);">Ladataan kommentteja...</div>';
            try {
              const replies = await fetchReplies(pendingArticleId);
              renderCommentsSection(card, pendingArticleId, replies);
              card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (err) {
              renderCommentsSection(card, pendingArticleId, [], `Virhe kommenttien haussa: ${err.message}`);
            }
          }
        }
        localStorage.removeItem('pending_comment_article_id');
      }, 500);
    }
  } else {
    // Alustetaan preferenssit paikalliseen tilaan ilman kirjautumista
    initPrefs(app, null);

    btnLogin.style.display = 'inline-flex';
    userProfile.style.display = 'none';
    userAvatar.src = '';

    await loadPrefs();
    updateNotificationsBadge();
  }
});

// Kytketään navbarin avatar-nappi avaamaan profiilimodaali
btnProfile.addEventListener('click', () => {
  openProfileModal();
});

// Korjataan profiilikuvan latausvirheet ilman inline-käsittelijää (CSP)
userAvatar.addEventListener('error', () => {
  userAvatar.style.display = 'none';
  userAvatar.nextElementSibling.style.display = 'block';
});

// Kytketään teeman vaihto (theme toggle) prefs-moduulin ohjaamaksi.
// Korvataan inline-klikkaaja kun app.js on latautunut, jotta saadaan Firestore-synkronointi toimimaan.
const btnTheme = document.querySelector('[data-theme-toggle]');
if (btnTheme) {
  const newBtnTheme = btnTheme.cloneNode(true);
  btnTheme.parentNode.replaceChild(newBtnTheme, btnTheme);
  
  newBtnTheme.addEventListener('click', () => {
    const currentPrefs = getPrefs();
    const currentTheme = currentPrefs.theme || 'system';
    let newTheme = 'light';
    
    if (currentTheme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      newTheme = isDark ? 'light' : 'dark';
    } else {
      newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    }
    
    updatePrefs({ theme: newTheme });
  });
}

// Kuunnellaan preferenssien muutoksia ja päivitetään dokumentin teema sekä toggle-ikonin tila
onPrefsChange((prefs) => {
  const theme = prefs.theme || 'system';
  let activeTheme = theme;
  
  if (theme === 'system') {
    activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  document.documentElement.setAttribute('data-theme', activeTheme);
  
  const toggleBtn = document.querySelector('[data-theme-toggle]');
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-label', 'Vaihda ' + (activeTheme === 'dark' ? 'vaaleaan' : 'tummaan') + ' teemaan');
    toggleBtn.innerHTML = activeTheme === 'dark'
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <circle cx="12" cy="12" r="5"/>
           <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
         </svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
         </svg>`;
  }
});

// ---- API CONFIGURATION ----
const QUERY_API_URL = import.meta.env.VITE_QUERY_API_URL || 'https://query-api-754758809337.europe-north1.run.app';
const WRITE_API_URL = import.meta.env.VITE_WRITE_API_URL || 'https://write-api-754758809337.europe-north1.run.app';


// ---- HOMEPAGE DYNAMIC STATS ----
async function loadHomepageStats() {
  try {
    const res = await fetch(`${QUERY_API_URL}/ap/stats`);
    if (!res.ok) return;
    const data = await res.json();
    
    const elSources = document.getElementById('stat-sources');
    if (elSources && data.sources_count) {
      elSources.textContent = `${data.sources_count}+`;
    }
    
    const elArticles = document.getElementById('stat-articles');
    if (elArticles && data.articles_last_24h) {
      const count = data.articles_last_24h;
      if (count >= 1000) {
        elArticles.textContent = `${(count / 1000).toFixed(1)}k+`;
      } else {
        elArticles.textContent = `${count}`;
      }
    }
    
    const elInterval = document.getElementById('stat-interval');
    if (elInterval && data.update_interval_minutes) {
      elInterval.textContent = `${data.update_interval_minutes} min`;
    }

    const elActiveSources = document.getElementById('stat-active-sources-container');
    if (elActiveSources && data.active_sources && data.active_sources.length > 0) {
      const maxCnt = Math.max(...data.active_sources.map(s => s.cnt || 1));
      
      let html = '';
      data.active_sources.forEach(source => {
        const pct = Math.max(5, Math.round(((source.cnt || 0) / maxCnt) * 100));
        html += `<div class="vis-row">
          <span class="vis-source-name">${sanitize(source.name)}</span>
          <div class="vis-bar-wrap"><div class="vis-bar" style="width:${pct}%"></div></div>
          <span class="vis-count">${source.cnt}</span>
        </div>`;
      });
      elActiveSources.innerHTML = html;
    }
  } catch (err) {
    console.warn('Tilastojen haku epäonnistui:', err);
  }
}
loadHomepageStats();

let currentTagFilter = null;
let cachedArticles = [];
let currentFeedLimit = 5;
let feedObserver = null;

// ---- PWA SERVICE WORKER REGISTRATION (Issue #19 / L-011) ----
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  const wb = new Workbox('/sw.js');

  wb.addEventListener('waiting', () => {
    // Luodaan päivityskehote (PWA Toast)
    const toast = document.createElement('div');
    toast.className = 'pwa-toast';
    toast.innerHTML = `
      <span>Uusi versio uutispalvelusta on saatavilla.</span>
      <button class="pwa-toast__btn" id="pwa-update-btn">Päivitä</button>
    `;
    document.body.appendChild(toast);

    document.getElementById('pwa-update-btn').addEventListener('click', () => {
      wb.addEventListener('controlling', () => {
        window.location.reload();
      });
      wb.messageSkipWaiting();
    });
  });

  wb.register().catch(err => console.error('Service Worker registration failed:', err));
}

// Generic non-blocking notification helper using PWA toast styling
function showNotification(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = 'pwa-toast';
  if (isError) {
    toast.style.borderColor = '#e11d48';
    toast.style.borderLeft = '4px solid #e11d48';
  }
  toast.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease';
    setTimeout(() => toast.remove(), 500);
  }, 3500);
}

// ---- FETCH OUTBOX WITH RATE-LIMIT HANDLING (Issue #60 / L-011) ----
async function fetchOutbox(tag = null, limit = 50, retryCount = 0) {
  let url = `${QUERY_API_URL}/ap/outbox`;
  let params = [];
  
  if (tag) {
    params.push(`tag=${encodeURIComponent(tag)}`);
  } else {
    // Jos suodatinta ei ole valittu ("Kaikki"-näkymä), haetaan käyttäjän seuratut tagit
    // tai käytetään oletustageja jos lista on tyhjä, jotta backend ei anna 400 Bad Request -virhettä.
    const prefs = getPrefs();
    const tagsToQuery = (prefs.followedTags && prefs.followedTags.length > 0)
      ? prefs.followedTags
      : ['#politiikka', '#talous', '#tiede', '#viihde', '#ulkomaat', '#kotimaa', '#kulttuuri', '#urheilu', '#sää'];
    
    tagsToQuery.forEach(t => params.push(`tag=${encodeURIComponent(t)}`));
  }
  
  params.push(`n=${limit}`);
  url += `?${params.join('&')}`;

  const headers = {};
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { headers });

    if (response.status === 429) {
      if (retryCount < 3) {
        // Luetaan Retry-After-headeri (Issue #60)
        const retryAfterHeader = response.headers.get('Retry-After');
        let delay = Math.pow(2, retryCount) * 1000; // Alkuperäinen exponential backoff -fallback
        
        if (retryAfterHeader) {
          const seconds = parseInt(retryAfterHeader, 10);
          if (!isNaN(seconds)) {
            delay = seconds * 1000;
          }
        }
        
        console.warn(`Rate limited (429). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchOutbox(tag, limit, retryCount + 1);
      }
      throw new Error('Liian monta pyyntöä (Rate limit). Yritä hetken kuluttua uudelleen.');
    }

    if (!response.ok) {
      throw new Error(`Virhe uutisten haussa (HTTP ${response.status})`);
    }

    const data = await response.json();
    return data.orderedItems || [];
  } catch (error) {
    console.error('Error fetching outbox:', error);
    throw error;
  }
}

// Sanitointiapufunktio XSS-hyökkäysten estämiseksi (Security / XSS)
function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// URL-osoitteiden sanitointiapufunktio javascript: -skripti-injektioiden estämiseksi (Security / XSS)
function sanitizeUrl(urlStr) {
  if (!urlStr) return '#';
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch (e) {
    if (urlStr.startsWith('/') || urlStr.startsWith('#')) {
      return urlStr;
    }
  }
  return '#';
}

// ---- RENDERING LOGIC (Issue #12, #20, #21, #24) ----
function renderFeed(articles) {
  const grid = document.getElementById('feed-grid');
  if (!grid) return;

  grid.innerHTML = '';
  grid.setAttribute('aria-busy', 'false');

  if (articles.length === 0) {
    grid.innerHTML = '<div class="profile-empty" style="grid-column: 1/-1; text-align: center;">Ei uutisia valituilla kriteereillä.</div>';
    return;
  }

  // Luodaan uutiskortit
  articles.forEach((item, index) => {
    const isLead = index === 0 && !currentTagFilter;
    const card = document.createElement('div');
    card.className = `feed-item ${isLead ? 'feed-item--lead' : 'feed-item--small'}`;
    
    // AS2 metadata attributes for D-CENT patterns
    card.setAttribute('data-id', item.id);
    card.setAttribute('data-type', item.type);

    const imageUrl = item.image && item.image.url ? item.image.url : 'https://picsum.photos/seed/news/800/450';
    const category = item.tag && item.tag.find(t => !t.name.startsWith('likes:') && !t.name.startsWith('dislikes:'))?.name || 'Yleinen';
    const sourceName = item.attributedTo && item.attributedTo.name ? item.attributedTo.name : 'Uutislähde';
    
    // Time rendering in local timezone (Issue #12)
    let timeStr = 'Aika tuntematon';
    if (item.published) {
      try {
        timeStr = new Intl.DateTimeFormat('fi-FI', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.published));
      } catch (e) {}
    }

    // Wayback Machine wildcard-arkistolinkki (Issue #24)
    const originalUrl = item.url || '#';
    const archiveUrl = item.url_archive || `https://web.archive.org/web/*/${originalUrl}`;

    // Reactions counts (Issue #20 & #21)
    const likesCount = item.likes && typeof item.likes.totalItems === 'number' ? item.likes.totalItems : 0;
    const dislikesCount = item.dislikes && typeof item.dislikes.totalItems === 'number' ? item.dislikes.totalItems : 0;
    const hasReactions = likesCount + dislikesCount > 0;
    
    const agreePct = hasReactions ? Math.round(likesCount / (likesCount + dislikesCount) * 100) : 0;
    const disagreePct = hasReactions ? 100 - agreePct : 0;

    // Comments count (Issue #11)
    const commentCount = item.replies && typeof item.replies.totalItems === 'number' ? item.replies.totalItems : 0;

    // Reacting states - prefix with uid if authenticated to prevent cross-user leak (Issue #20 / L-015)
    const reactionKey = auth.currentUser ? `reaction_${auth.currentUser.uid}_${item.id}` : `reaction_${item.id}`;
    let localReaction = localStorage.getItem(reactionKey) || null;
    const hasVoted = localReaction !== null;

    card.innerHTML = `
      ${isLead ? `<a href="${sanitizeUrl(originalUrl)}" target="_blank" class="article-link" data-archive="${sanitizeUrl(archiveUrl)}" rel="noopener noreferrer nofollow" style="display:block; overflow:hidden; border-radius:var(--radius-md);"><img src="${imageUrl}" alt="${sanitize(item.name)}" loading="lazy" referrerpolicy="no-referrer" class="feed-item__image"></a>` : ''}
      <h3 class="feed-item__title"><a href="${sanitizeUrl(originalUrl)}" target="_blank" class="article-link" data-archive="${sanitizeUrl(archiveUrl)}" rel="noopener noreferrer nofollow">${sanitize(item.name)}</a></h3>
      ${item.summary ? `<p class="feed-item__excerpt">${sanitize(item.summary)}</p>` : ''}
      
      ${(hasReactions && hasVoted) ? `
        <div class="vote-stats" role="img" aria-label="Reaktiot: ${agreePct}% samaa mieltä (${likesCount} ääntä), ${disagreePct}% eri mieltä (${dislikesCount} ääntä)" style="display: flex;">
          <div class="vote-stats__segment vote-stats__segment--agree" style="flex: ${agreePct}"></div>
          <div class="vote-stats__segment vote-stats__segment--disagree" style="flex: ${disagreePct}"></div>
        </div>
      ` : `<div class="vote-stats" style="display:none;"><div class="vote-stats__segment vote-stats__segment--agree"></div><div class="vote-stats__segment vote-stats__segment--disagree"></div></div>`}

      <div class="reaction-container">
        <button class="btn-reaction" data-action="like" data-id="${item.id}" aria-pressed="${localReaction === 'Like' ? 'true' : 'false'}">
          👍 Samaa mieltä ${hasVoted ? `(${likesCount})` : ''}
        </button>
        <button class="btn-reaction" data-action="dislike" data-id="${item.id}" aria-pressed="${localReaction === 'Dislike' ? 'true' : 'false'}">
          👎 Eri mieltä ${hasVoted ? `(${dislikesCount})` : ''}
        </button>
        <button class="btn-comments-toggle" data-id="${item.id}" style="font-size:var(--text-xs); color:var(--color-text-faint); margin-left:auto; background:none; border:none; cursor:pointer; display:flex; align-items:center; gap:4px;">
          💬 Kommentit (${commentCount})
        </button>
      </div>

      <div class="feed-item__meta" style="margin-top:var(--space-4); display:flex; align-items:center; gap:var(--space-2); width:100%;">
        <span class="feed-item__source">${sourceName}</span>
        <span class="feed-item__time">${timeStr}</span>
        <button class="btn-add-tag-toggle" data-id="${item.id}" style="font-size:var(--text-xs); color:var(--color-primary); background:none; border:none; cursor:pointer; margin-left:var(--space-2); padding:0;">+ Lisää tagi</button>
        ${item.url_archive ? `
          <a href="${sanitizeUrl(archiveUrl)}" target="_blank" rel="noopener noreferrer nofollow" class="feed-item__archive-link" style="margin-left:auto; font-size:var(--text-xs); color:var(--color-text-faint); text-decoration:none; display:flex; align-items:center; gap:4px;" aria-label="Lue artikkelin arkistoitu versio Wayback Machinessa (avautuu uudessa välilehdessä)">
            📎 Arkisto
          </a>
        ` : ''}
      </div>
      <div class="add-tag-form-container" data-id="${item.id}" style="display:none; margin-top:var(--space-2); gap:var(--space-2); align-items:center; width:100%;">
        <input type="text" class="add-tag-input" placeholder="tiede" style="font-size:var(--text-xs); padding:var(--space-1) var(--space-2); border:1px solid var(--color-divider); border-radius:var(--radius-sm); background:var(--color-surface); color:var(--color-text); width:120px;" aria-label="Uuden tagin nimi" />
        <button class="btn-add-tag-submit btn-primary" style="font-size:var(--text-xxs); padding:var(--space-1) var(--space-2);">Tallenna</button>
        <button class="btn-add-tag-cancel btn-ghost" style="font-size:var(--text-xxs); padding:var(--space-1) var(--space-2);">Peruuta</button>
      </div>
      <div class="feed-item__comments-section" data-id="${item.id}" style="display:none; margin-top:var(--space-4); border-top:1px solid var(--color-divider); padding-top:var(--space-4); width:100%;"></div>
    `;

    // Intercept clicks on article links to check connectivity via Query API (Issue #24 / backend proxy check)
    card.querySelectorAll('.article-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        
        // Show visual processing state
        const originalOpacity = link.style.opacity;
        const originalCursor = link.style.cursor;
        link.style.opacity = '0.6';
        link.style.cursor = 'wait';
        
        const checkUrl = `${QUERY_API_URL}/ap/check-status?url=${encodeURIComponent(originalUrl)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2.0s timeout
        
        let alive = true;
        try {
          const res = await fetch(checkUrl, {
            signal: controller.signal
          });
          if (res.ok) {
            const data = await res.json();
            alive = data.alive;
          } else {
            alive = false;
          }
        } catch (err) {
          console.warn("Backend check failed, fallback to archive:", err);
          alive = false;
        } finally {
          clearTimeout(timeoutId);
          link.style.opacity = originalOpacity;
          link.style.cursor = originalCursor;
        }

        if (alive) {
          window.open(originalUrl, '_blank', 'noopener,noreferrer');
        } else {
          console.warn("Original link unreachable, redirecting to archive:", archiveUrl);
          window.open(archiveUrl, '_blank', 'noopener,noreferrer');
        }
      });
    });

    // Reaction click handlers (Issue #20 & #21)
    card.querySelectorAll('.btn-reaction').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!auth.currentUser) {
          openLogin();
          return;
        }

        const action = btn.getAttribute('data-action') === 'like' ? 'Like' : 'Dislike';
        const articleId = btn.getAttribute('data-id');
        const userReactionKey = `reaction_${auth.currentUser.uid}_${articleId}`;
        const activeReaction = localStorage.getItem(userReactionKey);

        // Pre-save previous state for rollback
        const prevReaction = activeReaction;

        // Optimistic update state (supports undo / re-clicking active removes reaction)
        let newReaction = null;
        if (activeReaction === action) {
          localStorage.removeItem(userReactionKey);
        } else {
          localStorage.setItem(userReactionKey, action);
          newReaction = action;
        }

        // Current counts
        let currentLikes = likesCount;
        let currentDislikes = dislikesCount;

        // Adjust counts locally based on transitions
        if (prevReaction === 'Like') currentLikes--;
        if (prevReaction === 'Dislike') currentDislikes--;
        if (newReaction === 'Like') currentLikes++;
        if (newReaction === 'Dislike') currentDislikes++;

        // Update UI elements instantly (using DRY renderReactionButtons helper)
        renderReactionButtons(card, currentLikes, currentDislikes, newReaction);

        // Synkronoidaan uudet laskurit cachedArticles-taulukkoon (Blocker-korjaus)
        const cachedArticle = cachedArticles.find(a => a.id === articleId);
        if (cachedArticle) {
          if (!cachedArticle.likes) cachedArticle.likes = { totalItems: 0 };
          if (!cachedArticle.dislikes) cachedArticle.dislikes = { totalItems: 0 };
          cachedArticle.likes.totalItems = currentLikes;
          cachedArticle.dislikes.totalItems = currentDislikes;
        }

        // Perform network request
        try {
          if (newReaction) {
            await postReaction(articleId, newReaction);
          } else {
            await deleteReaction(articleId, activeReaction);
          }
        } catch (err) {
          console.error("Reaction failed, rolling back UI", err);
          // Rollback localStorage
          if (prevReaction) {
            localStorage.setItem(userReactionKey, prevReaction);
          } else {
            localStorage.removeItem(userReactionKey);
          }
          
          // Rollback cachedArticles-taulukkoon virhetilanteessa (Blocker-korjaus)
          const cachedArticle = cachedArticles.find(a => a.id === articleId);
          if (cachedArticle) {
            if (!cachedArticle.likes) cachedArticle.likes = { totalItems: 0 };
            if (!cachedArticle.dislikes) cachedArticle.dislikes = { totalItems: 0 };
            cachedArticle.likes.totalItems = likesCount;
            cachedArticle.dislikes.totalItems = dislikesCount;
          }

          // Rollback DOM elements using DRY helper
          renderReactionButtons(card, likesCount, dislikesCount, prevReaction);
          showNotification("Virhe reaktion tallennuksessa. Tila palautettu.", true);
        }
      });
    });
    // User can add tag (Issue #13) - Inline form implementation (No prompt() / Security pattern)
    const tagFormContainer = card.querySelector('.add-tag-form-container');
    const addTagToggle = card.querySelector('.btn-add-tag-toggle');
    const addTagCancel = card.querySelector('.btn-add-tag-cancel');
    const addTagSubmit = card.querySelector('.btn-add-tag-submit');
    const addTagInput = card.querySelector('.add-tag-input');
    
    if (addTagToggle && tagFormContainer) {
      addTagToggle.addEventListener('click', (e) => {
        e.preventDefault();
        if (!auth.currentUser) {
          openLogin();
          return;
        }
        tagFormContainer.style.display = 'flex';
        addTagInput.focus();
      });
    }
    
    if (addTagCancel && tagFormContainer) {
      addTagCancel.addEventListener('click', (e) => {
        e.preventDefault();
        tagFormContainer.style.display = 'none';
        addTagInput.value = '';
      });
    }
    
    if (addTagSubmit && tagFormContainer) {
      addTagSubmit.addEventListener('click', async (e) => {
        e.preventDefault();
        const tagInputVal = addTagInput.value.trim();
        if (!tagInputVal) return;
        
        let formatted = tagInputVal.toLowerCase();
        if (!formatted.startsWith('#')) formatted = '#' + formatted;
        
        try {
          const token = await auth.currentUser.getIdToken();
          const res = await fetch(`${WRITE_API_URL}/ap/inbox`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              "@context": "https://www.w3.org/ns/activitystreams",
              "type": "Add",
              "actor": `https://uutisseuranta.net/users/${auth.currentUser.uid}`,
              "object": {
                "type": "Hashtag",
                "name": formatted
              },
              "target": {
                "type": "Article",
                "id": item.id
              }
            })
          });
          if (res.ok) {
            showNotification(`Tagi ${formatted} lisätty uutiselle!`);
            if (!item.tag) item.tag = [];
            item.tag.push({ type: "Hashtag", name: formatted });
            refreshFeed();
          } else {
            showNotification("Tagin lisääminen epäonnistui", true);
          }
        } catch (err) {
          console.error("Error adding tag:", err);
          showNotification("Virhe tagin lisäyksessä", true);
        }
      });
    }

    // Comments section toggle click handler (Issue #11)
    card.querySelectorAll('.btn-comments-toggle').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const articleId = btn.getAttribute('data-id');
        const section = card.querySelector(`.feed-item__comments-section[data-id="${articleId}"]`);
        if (!section) return;

        if (section.style.display === 'block') {
          section.style.display = 'none';
        } else {
          section.style.display = 'block';
          section.innerHTML = '<div style="font-size:var(--text-xs); color:var(--color-text-faint);">Ladataan kommentteja...</div>';
          try {
            const replies = await fetchReplies(articleId);
            renderCommentsSection(card, articleId, replies);
          } catch (err) {
            renderCommentsSection(card, articleId, [], `Virhe kommenttien haussa: ${err.message}`);
          }
        }
      });
    });

    grid.appendChild(card);
  });
  updateActiveSourcesWidget(articles);
}

// ---- SEND ACTIONS TO WRITE API (Issue #20) ----
async function postReaction(articleId, type) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${WRITE_API_URL}/ap/inbox`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      "@context": "https://www.w3.org/ns/activitystreams",
      "type": type,
      "actor": `https://uutisseuranta.net/users/${auth.currentUser.uid}`,
      "object": articleId
    })
  });
  if (!res.ok) throw new Error("Reaction failed");
}

async function deleteReaction(articleId, type) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${WRITE_API_URL}/ap/inbox`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      "@context": "https://www.w3.org/ns/activitystreams",
      "type": "Undo",
      "actor": `https://uutisseuranta.net/users/${auth.currentUser.uid}`,
      "object": {
        "type": type,
        "actor": `https://uutisseuranta.net/users/${auth.currentUser.uid}`,
        "object": articleId
      }
    })
  });
  if (!res.ok) throw new Error("Undo reaction failed");
}

// ---- TAG CLOUD LOGIC (Issue #16) ----
function renderTagCloud(articles) {
  const container = document.getElementById('tag-cloud');
  if (!container) return;

  const counts = new Map();
  articles.forEach(item => {
    if (item.tag) {
      item.tag.forEach(t => {
        if (!t.name.startsWith('likes:') && !t.name.startsWith('dislikes:')) {
          counts.set(t.name, (counts.get(t.name) || 0) + 1);
        }
      });
    }
  });

  // Näytetään 7 tagia (tukeakseen 7±2 suositusta)
  const sortedTags = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);

  container.innerHTML = '';
  
  // All tags option
  const allBtn = document.createElement('button');
  allBtn.className = `tag-cloud__tag ${!currentTagFilter ? 'tag-cloud__tag--active' : ''}`;
  allBtn.textContent = 'Kaikki';
  allBtn.setAttribute('aria-label', 'Näytä kaikki uutiset');
  allBtn.addEventListener('click', () => {
    currentTagFilter = null;
    refreshFeed();
  });
  container.appendChild(allBtn);

  sortedTags.forEach(([tagName, count]) => {
    const btn = document.createElement('button');
    btn.className = `tag-cloud__tag ${currentTagFilter === tagName ? 'tag-cloud__tag--active' : ''}`;
    // Ei näytetä numeroa tai artikkelimäärää
    btn.textContent = tagName;
    btn.setAttribute('aria-label', `Suodata tagilla ${tagName}`);
    btn.addEventListener('click', () => {
      currentTagFilter = currentTagFilter === tagName ? null : tagName;
      refreshFeed();
    });
    container.appendChild(btn);
  });

  // Viimeinen tagi pilvessä suurennuslasimerkillä (🔍) uuden tagin hakemiseksi/lisäämiseksi
  const searchBtn = document.createElement('button');
  searchBtn.className = 'tag-cloud__tag';
  searchBtn.textContent = '🔍';
  searchBtn.setAttribute('aria-label', 'Lisää uusi tagi hakukriteeriksi');
  searchBtn.addEventListener('click', () => {
    const userTag = prompt('Syötä uusi tagi hakukriteeriksi (esim. helsinki):');
    if (userTag && userTag.trim()) {
      let formatted = userTag.trim();
      if (!formatted.startsWith('#')) {
        formatted = '#' + formatted;
      }
      currentTagFilter = formatted.toLowerCase();
      refreshFeed();
    }
  });
  container.appendChild(searchBtn);
}

async function refreshFeed() {
  currentFeedLimit = 5;
  if (feedObserver) {
    feedObserver.disconnect();
    feedObserver = null;
  }

  // Piilotetaan tagipilvi aluksi (Issue #10: tagipilvi näytetään vasta kun 500 artikkelia on haettu)
  const tagCloudContainer = document.getElementById('tag-cloud');
  if (tagCloudContainer) {
    tagCloudContainer.style.display = 'none';
  }

  const grid = document.getElementById('feed-grid');
  const isInitialLoad = grid && (!grid.children.length || grid.querySelector('.skeleton-card'));
  
  if (grid) {
    grid.setAttribute('aria-busy', 'true');
    if (isInitialLoad) {
      grid.innerHTML = `
        <div class="skeleton-card" aria-hidden="true"><div class="skeleton-img"></div><div class="skeleton-title"></div><div class="skeleton-text"></div></div>
        <div class="skeleton-card" aria-hidden="true"><div class="skeleton-img"></div><div class="skeleton-title"></div><div class="skeleton-text"></div></div>
        <div class="skeleton-card" aria-hidden="true"><div class="skeleton-img"></div><div class="skeleton-title"></div><div class="skeleton-text"></div></div>
      `;
    } else {
      // Visuaalinen indikaattori lataukselle pitäen nykyisen sisällön näkyvissä
      grid.style.opacity = '0.6';
    }
  }

  const startTime = Date.now();

  try {
    const articles = await fetchOutbox(currentTagFilter, currentFeedLimit);
    cachedArticles = articles;

    // Varmistetaan, että skeleton-loader näkyy vähintään 100ms (UX-vaatimus / Issue #12)
    const elapsed = Date.now() - startTime;
    if (elapsed < 100) {
      await new Promise(resolve => setTimeout(resolve, 100 - elapsed));
    }

    renderFeed(articles);
    setupScrollPagination();
  } catch (err) {
    console.error("Feed loading failed:", err);
    const grid = document.getElementById('feed-grid');
    if (grid) {
      grid.setAttribute('aria-busy', 'false');
      // Virherajapinta / Error boundary uutisvirralle (Issue #58)
      grid.innerHTML = `
        <div class="error-boundary" style="grid-column: 1/-1; text-align: center; padding: var(--space-8); border: 2px dashed var(--color-error, #ff4d4d); border-radius: var(--radius-md); background: var(--color-bg-offset);">
          <div style="font-size: var(--text-2xl); margin-bottom: var(--space-4);">⚠️</div>
          <h3 style="margin-bottom: var(--space-2); color: var(--color-text-bright);">Uutisvirran lataus epäonnistui</h3>
          <p style="color: var(--color-text-faint); margin-bottom: var(--space-6); font-size: var(--text-sm);">${sanitize(err.message || 'Yhteysongelma rajapintaan.')}</p>
          <div style="display: flex; gap: var(--space-4); justify-content: center;">
            <button class="btn btn--primary" id="btn-error-retry" style="padding: var(--space-2) var(--space-4); background: var(--color-primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer;">Yritä uudelleen</button>
            ${cachedArticles && cachedArticles.length > 0 ? `<button class="btn btn--secondary" id="btn-error-offline" style="padding: var(--space-2) var(--space-4); background: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer;">Näytä offline-versio</button>` : ''}
          </div>
        </div>
      `;

      const retryBtn = document.getElementById('btn-error-retry');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => refreshFeed());
      }

      const offlineBtn = document.getElementById('btn-error-offline');
      if (offlineBtn && cachedArticles && cachedArticles.length > 0) {
        offlineBtn.addEventListener('click', () => {
          renderFeed(cachedArticles);
        });
      }
    }
  } finally {
    const grid = document.getElementById('feed-grid');
    if (grid) {
      grid.style.opacity = '1.0';
    }
  }
}

function setupScrollPagination() {
  if (feedObserver) {
    feedObserver.disconnect();
    feedObserver = null;
  }

  const grid = document.getElementById('feed-grid');
  if (!grid) return;

  const cards = grid.querySelectorAll('.feed-item');
  if (cards.length === 0) return;

  if (currentFeedLimit === 5) {
    // Luodaan sentinel-elementti uutisvirran loppuun
    let sentinel = document.getElementById('feed-sentinel');
    if (!sentinel) {
      sentinel = document.createElement('div');
      sentinel.id = 'feed-sentinel';
      sentinel.style.height = '10px';
      sentinel.style.gridColumn = '1 / -1';
      grid.appendChild(sentinel);
    }
    
    feedObserver = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting && currentFeedLimit === 5) {
        feedObserver.disconnect();
        feedObserver = null;
        sentinel.remove();
        await loadMoreFeed(50);
      }
    }, { threshold: 0.1 });
    
    feedObserver.observe(sentinel);
  } else if (currentFeedLimit === 50) {
    // Tarkkaillaan 30. artikkelikorttia (indeksi 29)
    if (cards.length >= 30) {
      const targetCard = cards[29];
      feedObserver = new IntersectionObserver(async (entries) => {
        if (entries[0].isIntersecting && currentFeedLimit === 50) {
          feedObserver.disconnect();
          feedObserver = null;
          await loadMoreFeed(500);
        }
      }, { threshold: 0.1 });
      feedObserver.observe(targetCard);
    } else {
      // Jos palvelin palautti vähemmän kuin 30 artikkelia, ollaan uutisten lopussa
      currentFeedLimit = 500;
      renderTagCloud(cachedArticles);
      const tagCloudContainer = document.getElementById('tag-cloud');
      if (tagCloudContainer) {
        tagCloudContainer.style.display = 'flex';
      }
    }
  } else if (currentFeedLimit === 500) {
    // Kun 500 artikkelia on haettu, piirretään ja näytetään tagipilvi niiden alla
    renderTagCloud(cachedArticles);
    const tagCloudContainer = document.getElementById('tag-cloud');
    if (tagCloudContainer) {
      tagCloudContainer.style.display = 'flex';
    }
  }
}

async function loadMoreFeed(newLimit) {
  const grid = document.getElementById('feed-grid');
  if (!grid) return;

  // Luodaan latausilmoitus
  let loader = document.getElementById('feed-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'feed-loader';
    loader.style.gridColumn = '1 / -1';
    loader.style.textAlign = 'center';
    loader.style.padding = 'var(--space-4)';
    loader.style.color = 'var(--color-text-faint)';
    loader.style.fontSize = 'var(--text-sm)';
    loader.innerHTML = '<span class="loading-spinner"></span> Ladataan lisää uutisia...';
    grid.appendChild(loader);
  }

  currentFeedLimit = newLimit;

  try {
    const articles = await fetchOutbox(currentTagFilter, currentFeedLimit);
    cachedArticles = articles;
    
    if (loader) loader.remove();
    
    renderFeed(articles);
    setupScrollPagination();
  } catch (err) {
    console.error("Load more failed:", err);
    if (loader) {
      loader.innerHTML = `<span style="color:var(--color-error);">${sanitize(err.message || 'Haku epäonnistui')}</span>`;
      setTimeout(() => loader.remove(), 3000);
    }
  }
}

// ---- CUSTOM USER FEED SYNC (Issue #51) & SPA ROUTER ----
onPrefsChange((prefs) => {
  const view = prefs.currentView || 'home';
  document.body.className = `view-${view}`;
  
  const homeLink = document.getElementById('nav-link-home');
  const newsLink = document.getElementById('nav-link-news');
  
  if (homeLink) homeLink.classList.toggle('nav__link--active', view === 'home');
  if (newsLink) newsLink.classList.toggle('nav__link--active', view === 'news');
  
  // Ladataan uutiset vain uutissivulla
  if (view === 'news') {
    refreshFeed();
  }
});

// ---- SPA ROUTER CLICK HANDLERS ----
const initSPARouter = () => {
  const homeLink = document.getElementById('nav-link-home');
  const newsLink = document.getElementById('nav-link-news');
  const featuresLink = document.getElementById('nav-link-features');
  const logoLink = document.querySelector('.nav__logo');
  
  const setView = (view, e) => {
    if (e) e.preventDefault();
    updatePrefs({ currentView: view });
  };

  if (logoLink) logoLink.addEventListener('click', (e) => setView('home', e));
  if (homeLink) homeLink.addEventListener('click', (e) => setView('home', e));
  if (newsLink) newsLink.addEventListener('click', (e) => setView('news', e));
  
  if (featuresLink) {
    featuresLink.addEventListener('click', () => {
      updatePrefs({ currentView: 'home' });
    });
  }
  
  document.querySelectorAll('a[href="#uutiset"]').forEach(link => {
    link.addEventListener('click', (e) => setView('news', e));
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSPARouter);
} else {
  initSPARouter();
}

// ---- COMMENT & REPLIES LOGIC (Issue #11) ----
async function fetchReplies(articleId) {
  const res = await fetch(`${QUERY_API_URL}/ap/replies?id=${encodeURIComponent(articleId)}`);
  if (!res.ok) throw new Error("Kommenttien haku epäonnistui");
  const data = await res.json();
  return data.orderedItems || [];
}

async function postComment(parentId, content) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${WRITE_API_URL}/ap/inbox`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      "@context": "https://www.w3.org/ns/activitystreams",
      "type": "Create",
      "actor": `https://uutisseuranta.net/users/${auth.currentUser.uid}`,
      "object": {
        "type": "Note",
        "inReplyTo": parentId,
        "content": content
      }
    })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Kommentin lähetys epäonnistui");
  }
}

async function postCommentReaction(commentId, type) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${WRITE_API_URL}/ap/inbox`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      "@context": "https://www.w3.org/ns/activitystreams",
      "type": type,
      "actor": `https://uutisseuranta.net/users/${auth.currentUser.uid}`,
      "object": commentId
    })
  });
  if (!res.ok) throw new Error("Reaktio epäonnistui");
}

function renderCommentsSection(card, articleId, replies, errorMessage = null) {
  const container = card.querySelector(`.feed-item__comments-section[data-id="${articleId}"]`);
  if (!container) return;

  container.innerHTML = '';

  if (errorMessage) {
    const errorBanner = document.createElement('div');
    errorBanner.className = 'error-boundary';
    errorBanner.style.fontSize = 'var(--text-xs)';
    errorBanner.style.color = 'var(--color-error, #ff4d4d)';
    errorBanner.style.padding = 'var(--space-2)';
    errorBanner.style.marginBottom = 'var(--space-3)';
    errorBanner.style.border = '1px dashed var(--color-error, #ff4d4d)';
    errorBanner.style.borderRadius = 'var(--radius-md)';
    errorBanner.style.background = 'var(--color-bg-offset)';
    errorBanner.textContent = errorMessage;
    container.appendChild(errorBanner);
  }

  const commentsList = document.createElement('div');
  commentsList.className = 'comments-list';
  commentsList.style.display = 'flex';
  commentsList.style.flexDirection = 'column';
  commentsList.style.gap = 'var(--space-3)';
  commentsList.style.marginBottom = 'var(--space-4)';

  const mainComments = replies.filter(r => r.object.inReplyTo === articleId);
  const repliesToComments = replies.filter(r => r.object.inReplyTo !== articleId);

  if (mainComments.length === 0) {
    const noComments = document.createElement('div');
    noComments.className = 'no-comments';
    noComments.style.color = 'var(--color-text-muted)';
    noComments.style.fontSize = 'var(--text-sm)';
    noComments.style.marginBottom = 'var(--space-4)';
    noComments.textContent = 'Ei vielä kommentteja. Kirjoita ensimmäinen!';
    commentsList.appendChild(noComments);
  } else {
    mainComments.forEach(comment => {
      const cObj = comment.object;
      const actorName = cObj.attributedTo ? cObj.attributedTo.split('/').pop() : 'Käyttäjä';
      const actorPic = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
      const pubDate = new Date(cObj.published);
      const timeAgo = pubDate.toLocaleString('fi-FI');

      const commentDiv = document.createElement('div');
      commentDiv.className = 'comment-item level-1';
      commentDiv.style.border = '1px solid var(--color-divider)';
      commentDiv.style.borderRadius = 'var(--radius-md)';
      commentDiv.style.padding = 'var(--space-3)';
      commentDiv.style.background = 'var(--color-surface-hover)';

      commentDiv.innerHTML = `
        <div style="display:flex; align-items:center; gap:var(--space-2); margin-bottom:var(--space-2);">
          <img src="${actorPic}" alt="" style="width:24px; height:24px; border-radius:50%;" />
          <strong style="font-size:var(--text-sm);">${actorName}</strong>
          <time datetime="${cObj.published}" style="font-size:var(--text-xs); color:var(--color-text-faint); margin-left:auto;">${timeAgo}</time>
        </div>
        <p style="font-size:var(--text-sm); margin:0 0 var(--space-2) 0; white-space:pre-wrap;">${cObj.content}</p>
        <div style="display:flex; gap:var(--space-2); align-items:center;">
          <button class="btn-comment-reply" data-parent-id="${cObj.id}" style="font-size:var(--text-xs); color:var(--color-primary); background:none; border:none; cursor:pointer; padding:0;">Vastaa</button>
          <button class="btn-comment-agree" data-id="${cObj.id}" style="font-size:var(--text-xs); color:var(--color-text-muted); background:none; border:none; cursor:pointer; padding:0; margin-left:auto;">👍 Samaa mieltä (${cObj.like_count || 0})</button>
          <button class="btn-comment-disagree" data-id="${cObj.id}" style="font-size:var(--text-xs); color:var(--color-text-muted); background:none; border:none; cursor:pointer; padding:0;">👎 Eri mieltä (${cObj.dislike_count || 0})</button>
        </div>
        <div class="replies-container" style="margin-left:var(--space-6); margin-top:var(--space-3); display:flex; flex-direction:column; gap:var(--space-2); border-left:2px solid var(--color-divider); padding-left:var(--space-3);">
          <!-- Vastaukset rendataan tähän -->
        </div>
      `;

      const childReplies = repliesToComments.filter(r => r.object.inReplyTo === cObj.id);
      const repliesContainer = commentDiv.querySelector('.replies-container');

      childReplies.forEach(reply => {
        const rObj = reply.object;
        const rActorName = rObj.attributedTo ? rObj.attributedTo.split('/').pop() : 'Käyttäjä';
        const rTimeAgo = new Date(rObj.published).toLocaleString('fi-FI');

        const replyDiv = document.createElement('div');
        replyDiv.className = 'comment-item level-2';
        replyDiv.style.background = 'var(--color-surface)';
        replyDiv.style.border = '1px solid var(--color-divider)';
        replyDiv.style.borderRadius = 'var(--radius-md)';
        replyDiv.style.padding = 'var(--space-2)';

        replyDiv.innerHTML = `
          <div style="display:flex; align-items:center; gap:var(--space-2); margin-bottom:var(--space-1);">
            <img src="${actorPic}" alt="" style="width:20px; height:20px; border-radius:50%;" />
            <strong style="font-size:var(--text-xs);">${rActorName}</strong>
            <time datetime="${rObj.published}" style="font-size:var(--text-xxs); color:var(--color-text-faint); margin-left:auto;">${rTimeAgo}</time>
          </div>
          <p style="font-size:var(--text-xs); margin:0 0 var(--space-2) 0; white-space:pre-wrap;">${rObj.content}</p>
          <div style="display:flex; gap:var(--space-2); align-items:center;">
            <button class="btn-comment-reply-l2" data-parent-id="${cObj.id}" style="font-size:var(--text-xxs); color:var(--color-primary); background:none; border:none; cursor:pointer; padding:0;">Vastaa</button>
          </div>
        `;
        repliesContainer.appendChild(replyDiv);
      });

      if (childReplies.length === 0) {
        repliesContainer.style.display = 'none';
      }

      commentsList.appendChild(commentDiv);
    });
  }

  container.appendChild(commentsList);

  const form = document.createElement('form');
  form.className = 'main-comment-form';
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = 'var(--space-2)';

  form.innerHTML = `
    <textarea class="comment-textarea" placeholder="Kirjoita kommentti..." aria-label="Uusi kommentti" style="width:100%; min-height:60px; padding:var(--space-2); border:1px solid var(--color-divider); border-radius:var(--radius-md); font-family:inherit; font-size:var(--text-sm); background:var(--color-surface); color:var(--color-text); resize:vertical;"></textarea>
    <button type="submit" class="btn btn--primary" style="align-self:flex-end; padding:var(--space-1) var(--space-3); font-size:var(--text-xs);">Lähetä kommentti</button>
  `;
  
  const threadUsers = Array.from(new Set(
    replies.map(r => r.object && r.object.attributedTo ? r.object.attributedTo.split('/').pop() : '')
           .filter(name => name && name !== 'Käyttäjä')
  ));
  bindAutocompleteToTextarea(form.querySelector('.comment-textarea'), threadUsers);

  // Palautetaan mahdollisesti välimuistissa oleva kirjoitus Google-kirjautumisen jälkeen
  const pendingKey = `pending_comment_${articleId}`;
  const pendingText = localStorage.getItem(pendingKey);
  if (pendingText) {
    form.querySelector('.comment-textarea').value = pendingText;
    localStorage.removeItem(pendingKey);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const textarea = form.querySelector('.comment-textarea');
    const content = textarea.value.trim();
    if (!content) return;

    if (!auth.currentUser) {
      localStorage.setItem(pendingKey, content);
      localStorage.setItem('pending_comment_article_id', articleId);
      openLogin();
      return;
    }

    try {
      await postComment(articleId, content);
      textarea.value = '';
      const freshReplies = await fetchReplies(articleId);
      renderCommentsSection(card, articleId, freshReplies);
    } catch (err) {
      alert("Kommentin lähetys epäonnistui: " + err.message);
    }
  });

  container.appendChild(form);

  container.querySelectorAll('.btn-comment-reply, .btn-comment-reply-l2').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const parentId = btn.getAttribute('data-parent-id');
      
      const parentCommentDiv = btn.closest('.comment-item.level-1');
      let replyForm = parentCommentDiv.querySelector('.reply-form');
      if (replyForm) {
        replyForm.querySelector('.reply-textarea').focus();
        return;
      }

      replyForm = document.createElement('form');
      replyForm.className = 'reply-form';
      replyForm.style.display = 'flex';
      replyForm.style.flexDirection = 'column';
      replyForm.style.gap = 'var(--space-2)';
      replyForm.style.marginTop = 'var(--space-2)';
      replyForm.style.marginLeft = 'var(--space-6)';

      replyForm.innerHTML = `
        <textarea class="reply-textarea" placeholder="Kirjoita vastaus..." aria-label="Uusi vastaus" style="width:100%; min-height:40px; padding:var(--space-2); border:1px solid var(--color-divider); border-radius:var(--radius-md); font-family:inherit; font-size:var(--text-xs); background:var(--color-surface); color:var(--color-text); resize:vertical;"></textarea>
        <div style="display:flex; justify-content:flex-end; gap:var(--space-2);">
          <button type="button" class="btn-cancel-reply" style="font-size:var(--text-xxs); color:var(--color-text-muted); background:none; border:none; cursor:pointer;">Peruuta</button>
          <button type="submit" class="btn btn--primary" style="padding:var(--space-1) var(--space-2); font-size:var(--text-xxs);">Vastaa</button>
        </div>
      `;

      const pendingReplyKey = `pending_reply_${parentId}`;
      const pendingReplyText = localStorage.getItem(pendingReplyKey);
      if (pendingReplyText) {
        replyForm.querySelector('.reply-textarea').value = pendingReplyText;
        localStorage.removeItem(pendingReplyKey);
      }

      replyForm.querySelector('.btn-cancel-reply').addEventListener('click', () => replyForm.remove());

      replyForm.addEventListener('submit', async (e2) => {
        e2.preventDefault();
        const rTextarea = replyForm.querySelector('.reply-textarea');
        const rContent = rTextarea.value.trim();
        if (!rContent) return;

        if (!auth.currentUser) {
          localStorage.setItem(pendingReplyKey, rContent);
          localStorage.setItem('pending_reply_parent_id', parentId);
          localStorage.setItem('pending_comment_article_id', articleId);
          openLogin();
          return;
        }

        try {
          await postComment(parentId, rContent);
          replyForm.remove();
          const freshReplies = await fetchReplies(articleId);
          renderCommentsSection(card, articleId, freshReplies);
        } catch (err) {
          alert("Vastauksen lähetys epäonnistui: " + err.message);
        }
      });

      parentCommentDiv.appendChild(replyForm);
      replyForm.querySelector('.reply-textarea').focus();
    });
  });

  container.querySelectorAll('.btn-comment-agree, .btn-comment-disagree').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!auth.currentUser) {
        openLogin();
        return;
      }
      const commentId = btn.getAttribute('data-id');
      const action = btn.classList.contains('btn-comment-agree') ? 'Like' : 'Dislike';
      
      try {
        await postCommentReaction(commentId, action);
        const freshReplies = await fetchReplies(articleId);
        renderCommentsSection(card, articleId, freshReplies);
      } catch (err) {
        console.error("Comment reaction failed:", err);
      }
    });
  });
}


// Altistetaan preferenssifunktiot globaalisti smoke-testiä varten / Expose preference functions globally for smoke tests
window.updatePrefs = updatePrefs;
window.exportPrefsAsJson = exportPrefsAsJson;
window.deleteUserPrefs = deleteUserPrefs;





// ---- REACTION BUTTONS DRY RENDERER (Issue #20 & #21) ----
function renderReactionButtons(card, likesCount, dislikesCount, localReaction) {
  const likeBtn = card.querySelector('.btn-reaction[data-action="like"]');
  const dislikeBtn = card.querySelector('.btn-reaction[data-action="dislike"]');
  const statsBar = card.querySelector('.vote-stats');
  if (!likeBtn || !dislikeBtn) return;
  
  const hasVoted = localReaction !== null;
  likeBtn.setAttribute('aria-pressed', localReaction === 'Like' ? 'true' : 'false');
  likeBtn.innerHTML = `👍 Samaa mieltä${hasVoted ? ` (${likesCount})` : ''}`;
  
  dislikeBtn.setAttribute('aria-pressed', localReaction === 'Dislike' ? 'true' : 'false');
  dislikeBtn.innerHTML = `👎 Eri mieltä${hasVoted ? ` (${dislikesCount})` : ''}`;
  
  const total = likesCount + dislikesCount;
  if (statsBar) {
    if (total > 0 && hasVoted) {
      const agree = Math.round(likesCount / total * 100);
      const disagree = 100 - agree;
      statsBar.setAttribute('aria-label', `Reaktiot: ${agree}% samaa mieltä (${likesCount} ääntä), ${disagree}% eri mieltä (${dislikesCount} ääntä)`);
      statsBar.querySelector('.vote-stats__segment--agree').style.flex = agree;
      statsBar.querySelector('.vote-stats__segment--disagree').style.flex = disagree;
      statsBar.style.display = 'flex';
    } else {
      statsBar.style.display = 'none';
    }
  }
}

// ---- ACTIVE SOURCES WIDGET DYNAMIC UPDATE (Issue #1 / UP-6) ----
// HUOMIO: loadHomepageStats() hakee globaalit kokonaistilastot BigQuery-tietokannasta,
// kun taas tämä funktio laskee aktiiviset lähteet dynaamisesti ja reaktiivisesti
// vain kulloinkin client-puolella suodatetun/näytettävän uutisvirran perusteella.
function updateActiveSourcesWidget(articles) {
  const elActiveSources = document.getElementById('stat-active-sources-container');
  if (!elActiveSources) return;
  
  const counts = {};
  articles.forEach(item => {
    const sourceName = item.attributedTo && item.attributedTo.name ? item.attributedTo.name : 'Uutislähde';
    counts[sourceName] = (counts[sourceName] || 0) + 1;
  });
  
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(...Object.values(counts), 1);
  
  let html = '';
  sorted.forEach(([name, count]) => {
    const pct = Math.max(5, Math.round((count / max) * 100));
    html += `
      <div class="vis-row">
        <span class="vis-source-name">${sanitize(name)}</span>
        <div class="vis-bar-wrap"><div class="vis-bar" style="width:${pct}%"></div></div>
        <span class="vis-count">${count}</span>
      </div>
    `;
  });
  elActiveSources.innerHTML = html;
}

// ---- COMMENT AUTOCOMPLETE (Issue #14 & #15) ----
// Autocomplete-valikon singleton-toteutus muistivuotojen estämiseksi
let _autocompleteMenu = null;

function getAutocompleteMenu() {
  if (_autocompleteMenu) return _autocompleteMenu;
  _autocompleteMenu = document.createElement('div');
  _autocompleteMenu.className = 'autocomplete-menu hidden';
  _autocompleteMenu.style.position = 'absolute';
  _autocompleteMenu.style.background = 'var(--color-bg-offset)';
  _autocompleteMenu.style.border = '1px solid var(--color-divider)';
  _autocompleteMenu.style.borderRadius = 'var(--radius-sm)';
  _autocompleteMenu.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
  _autocompleteMenu.style.zIndex = '1000';
  _autocompleteMenu.style.maxHeight = '150px';
  _autocompleteMenu.style.overflowY = 'auto';
  _autocompleteMenu.style.padding = '4px 0';
  document.body.appendChild(_autocompleteMenu);
  return _autocompleteMenu;
}

function bindAutocompleteToTextarea(textarea, customUsers = []) {
  // Käytetään ainoastaan viestiketjun aktiivisia kommentoijia
  const users = Array.from(new Set(customUsers));
  const tags = ['politiikka', 'talous', 'tiede', 'viihde', 'kotimaa', 'ulkomaat', 'kulttuuri', 'urheilu', 'sää'];
  
  const menu = getAutocompleteMenu();
  let triggerIndex = -1;
  let activeTrigger = null;
  
  textarea.addEventListener('input', () => {
    const text = textarea.value;
    const cursor = textarea.selectionStart;
    const beforeCursor = text.slice(0, cursor);
    
    const lastAt = beforeCursor.lastIndexOf('@');
    const lastHash = beforeCursor.lastIndexOf('#');
    const lastTriggerIndex = Math.max(lastAt, lastHash);
    
    if (lastTriggerIndex !== -1 && lastTriggerIndex >= beforeCursor.lastIndexOf(' ')) {
      activeTrigger = beforeCursor[lastTriggerIndex];
      triggerIndex = lastTriggerIndex;
      const query = beforeCursor.slice(triggerIndex + 1).toLowerCase();
      
      const list = activeTrigger === '@' ? users : tags;
      const filtered = list.filter(item => item.startsWith(query));
      
      if (filtered.length > 0) {
        const rect = textarea.getBoundingClientRect();
        menu.style.left = `${rect.left + window.scrollX}px`;
        menu.style.top = `${rect.bottom + window.scrollY + 5}px`;
        menu.classList.remove('hidden');
        
        menu.innerHTML = '';
        filtered.forEach(item => {
          const btn = document.createElement('button');
          btn.style.width = '100%';
          btn.style.textAlign = 'left';
          btn.style.padding = 'var(--space-1) var(--space-2)';
          btn.style.background = 'none';
          btn.style.border = 'none';
          btn.style.color = 'var(--color-text)';
          btn.style.cursor = 'pointer';
          btn.style.fontSize = 'var(--text-xs)';
          btn.textContent = activeTrigger === '#' ? '#' + item : '@' + item;
          
          btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const replacement = activeTrigger === '#' ? '#' + item : '@' + item;
            textarea.value = text.slice(0, triggerIndex) + replacement + ' ' + text.slice(cursor);
            textarea.focus();
            menu.classList.add('hidden');
          });
          menu.appendChild(btn);
        });
      } else {
        menu.classList.add('hidden');
      }
    } else {
      menu.classList.add('hidden');
    }
  });
  
  textarea.addEventListener('blur', () => {
    setTimeout(() => {
      menu.classList.add('hidden');
    }, 200);
  });
}

// ---- IN-APP NOTIFICATIONS BADGE (Issue #4) ----
async function updateNotificationsBadge() {
  const btnNotif = document.getElementById('btn-notifications');
  const badge = document.getElementById('notification-badge');
  if (!btnNotif || !badge) return;
  
  if (!auth.currentUser) {
    btnNotif.classList.add('hidden');
    return;
  }
  
  btnNotif.classList.remove('hidden');
  
  const prefs = getPrefs();
  const followedTags = prefs.followedTags || [];
  if (followedTags.length === 0) {
    badge.classList.add('hidden');
    return;
  }
  
  let unreadCount = 0;
  try {
    const articles = cachedArticles || await fetchOutbox(null, 50);
    followedTags.forEach(tag => {
      const tagArticles = articles.filter(item => item.tag && item.tag.some(t => t.name.toLowerCase() === tag.toLowerCase()));
      if (tagArticles.length > 0) {
        const newestId = tagArticles[0].id;
        const lastSeen = localStorage.getItem(`seen_${auth.currentUser.uid}_${tag}`);
        if (lastSeen !== newestId) {
          unreadCount++;
        }
      }
    });
  } catch (e) {
    console.warn("Unread badge update check failed:", e);
  }
  
  if (unreadCount > 0) {
    badge.textContent = unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
    badge.textContent = '';
  }
}
