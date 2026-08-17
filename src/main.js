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
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';
import { initPrefs, loadPrefs, followTag, unfollowTag, isFollowing, onPrefsChange, getPrefs, updatePrefs, exportPrefsAsJson, deleteUserPrefs } from './prefs.js';
import { Workbox } from 'workbox-window';

// ---- STATIC SCROLL OBSERVER ----
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-item').forEach(el => {
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

// Rekisteröidään auth-callbackit ja testiapufunktiot vain kehitys- ja testiympäristössä (Päätös G-014)
if (import.meta.env.DEV || (typeof window !== 'undefined' && window.__TESTING__)) {
  window.__authCallbacks = [];
  window.signInForTest = async (email, password) => {
    if (email === 'mockuser@test.com') {
      console.log("Using E2E mock user login bypass");
      const mockUser = {
        uid: 'mock-uid-123',
        email: email,
        displayName: 'Mock Test User',
        photoURL: '',
        getIdToken: async () => 'mock-token-xyz'
      };
      Object.defineProperty(auth, 'currentUser', {
        get: () => mockUser,
        configurable: true
      });
      if (window.__authCallbacks) {
        for (const cb of window.__authCallbacks) {
          await cb(mockUser);
        }
      }
      return mockUser;
    }
    return signInWithEmailAndPassword(auth, email, password);
  };

  window.registerForTest = async (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
  };
}

const myOnAuthStateChanged = (authInstance, callback) => {
  if (window.__authCallbacks) {
    window.__authCallbacks.push(callback);
  }
  return onAuthStateChanged(authInstance, callback);
};

const btnLogin = document.getElementById('btn-login');
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



myOnAuthStateChanged(auth, async (user) => {
  if (user) {
    // Alustetaan preferenssit ja profiilimodaali kirjautuneelle käyttäjälle
    initPrefs(app, user.uid);
    import('./profile.js').then(({ initProfileModal }) => {
      initProfileModal(user);
    });

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
    migrateOldSeenKeys();
    updateNotificationsBadge();

    try {
      const saved = localStorage.getItem(`unsynced_reads_${user.uid}`);
      if (saved) {
        const ids = JSON.parse(saved) || [];
        ids.forEach(id => pendingSeenSync.add(id));
        localStorage.removeItem(`unsynced_reads_${user.uid}`);
        setTimeout(syncPendingSeen, 1000);
      }
    } catch (e) {
      console.warn("Failed to load unsynced reads:", e);
    }

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
            section.innerHTML = '<div class="comments-loading-text">Ladataan kommentteja...</div>';
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
    migrateOldSeenKeys();
    updateNotificationsBadge();
  }
});

// Kytketään navbarin avatar-nappi avaamaan profiilimodaali
btnProfile.addEventListener('click', async () => {
  const { initProfileModal, openProfileModal } = await import('./profile.js');
  if (auth.currentUser) {
    initProfileModal(auth.currentUser);
  }
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

// ---- SCROLL READ OBSERVER (AS2 Read Activity) ----
const readObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const card = e.target;
      const articleId = card.getAttribute('data-id');
      
      // Animointi (kuten scroll observer)
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
      
      if (articleId) {
        markArticleAsRead(articleId, card);
      }
    }
  });
}, { threshold: 0.1 });

let pendingSeenSync = new Set();
let seenSyncDebounceTimer = null;

async function syncPendingSeen(options = {}) {
  if (seenSyncDebounceTimer) {
    clearTimeout(seenSyncDebounceTimer);
    seenSyncDebounceTimer = null;
  }
  
  if (pendingSeenSync.size === 0 || !auth.currentUser) {
    return;
  }
  
  const batch = Array.from(pendingSeenSync);
  pendingSeenSync.clear();
  
  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`${WRITE_API_URL}/ap/inbox`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      keepalive: options.keepalive || false,
      body: JSON.stringify({
        "@context": "https://www.w3.org/ns/activitystreams",
        "type": "Read",
        "actor": `https://uutisseuranta.net/users/${auth.currentUser.uid}`,
        "object": batch
      })
    });
    
    if (!response.ok) {
      throw new Error(`Sync failed with HTTP ${response.status}`);
    }
  } catch (err) {
    console.warn("Failed to sync read activities, restoring to queue:", err);
    batch.forEach(id => pendingSeenSync.add(id));
  }
}

// Tapahtumapohjainen synkronointi: välilehden vaihto ja taustalle siirtyminen (Päätös L-020)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && pendingSeenSync.size > 0 && auth.currentUser) {
    syncPendingSeen({ keepalive: true });
  }
});

// Flushataan ja tallennetaan synkronoimattomat luetut ennen sivulta poistumista
window.addEventListener('beforeunload', () => {
  if (pendingSeenSync.size > 0 && auth.currentUser) {
    try {
      const uid = auth.currentUser.uid;
      localStorage.setItem(`unsynced_reads_${uid}`, JSON.stringify(Array.from(pendingSeenSync)));
    } catch (e) {
      console.warn("Failed to save unsynced reads on beforeunload:", e);
    }
  }
});

async function markArticleAsRead(articleId, card) {
  const uid = auth.currentUser ? auth.currentUser.uid : 'anonymous';
  const fingerprint = card.getAttribute('data-fingerprint') || 'true';
  const listKey = `seen_list_${uid}`;
  
  let seen = [];
  try {
    seen = JSON.parse(localStorage.getItem(listKey)) || [];
  } catch (e) {
    seen = [];
  }
  
  const existingIndex = seen.findIndex(p => p[0] === String(articleId));
  if (existingIndex !== -1) {
    if (seen[existingIndex][1] === fingerprint) {
      return;
    }
    seen.splice(existingIndex, 1);
  }
  
  seen.push([String(articleId), fingerprint]);
  
  if (seen.length > 10000) {
    seen.shift();
  }
  
  try {
    localStorage.setItem(listKey, JSON.stringify(seen));
  } catch (e) {
    console.warn("FIFO write failed:", e);
  }
  
  card.classList.add('feed-item--read');
  
  if (auth.currentUser) {
    pendingSeenSync.add(articleId);
    if (pendingSeenSync.size >= 500) {
      syncPendingSeen();
    } else {
      if (seenSyncDebounceTimer) clearTimeout(seenSyncDebounceTimer);
      seenSyncDebounceTimer = setTimeout(() => {
        syncPendingSeen();
      }, 2000);
    }
  }
}

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
      
      elActiveSources.innerHTML = '';
      data.active_sources.forEach(source => {
        const pct = Math.max(5, Math.round(((source.cnt || 0) / maxCnt) * 100));
        
        const row = document.createElement('div');
        row.className = 'vis-row';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'vis-source-name';
        nameSpan.textContent = source.name;
        
        const barWrap = document.createElement('div');
        barWrap.className = 'vis-bar-wrap';
        const bar = document.createElement('div');
        bar.className = 'vis-bar';
        bar.style.width = `${pct}%`;
        barWrap.appendChild(bar);
        
        const countSpan = document.createElement('span');
        countSpan.className = 'vis-count';
        countSpan.textContent = source.cnt;
        
        row.appendChild(nameSpan);
        row.appendChild(barWrap);
        row.appendChild(countSpan);
        elActiveSources.appendChild(row);
      });
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
if ('serviceWorker' in navigator && !import.meta.env.DEV && !window.__DISABLE_SERVICE_WORKER__) {
  const wb = new Workbox('/sw.js');

  wb.addEventListener('waiting', () => {
    wb.addEventListener('controlling', () => {
      window.location.reload();
    });
    wb.messageSkipWaiting();
  });

  wb.register().then(reg => {
    if (reg) {
      reg.update();
    }
  }).catch(err => console.error('Service Worker registration failed:', err));
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
  
  const headers = {
    'Content-Type': 'application/json'
  };

  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (err) {
      console.warn("Failed to get idToken for outbox query:", err);
    }
  }

  let seenIds = [];
  const uid = auth.currentUser ? auth.currentUser.uid : 'anonymous';
  if (uid === 'anonymous') {
    try {
      const raw = localStorage.getItem(`seen_list_${uid}`);
      if (raw) {
        const seenList = JSON.parse(raw) || [];
        seenIds = seenList.map(p => p[0]).reverse();
      }
    } catch (e) {
      console.warn("Failed to read seen list for outbox POST:", e);
    }
  }

  const bodyData = {
    tag: tag ? [tag] : null,
    n: limit
  };

  if (uid === 'anonymous') {
    bodyData.seen_ids = seenIds;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyData)
    });

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
    const items = data.orderedItems || [];
    return items.map(item => {
      if (item && item.type === 'Create' && item.object && typeof item.object === 'object') {
        return {
          ...item,
          ...item.object,
          id: item.id, // Keep Create activity ID as primary ID for seen_list tracking
          type: item.object.type || 'Article'
        };
      }
      return item;
    });
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

  const uid = auth.currentUser ? auth.currentUser.uid : 'anonymous';

  // Luetaan luetut uutiset kerralla Map-rakenteeseen tehokkuuden takia
  let seenMap = new Map();
  try {
    const raw = localStorage.getItem(`seen_list_${uid}`);
    if (raw) {
      seenMap = new Map(JSON.parse(raw));
    }
  } catch (e) {
    console.warn("Failed to read seen list:", e);
  }

  let displayedArticles = articles;

  if (displayedArticles.length === 0) {
    // Jos kaikki ladatut uutiset on jo luettu, ladataan automaattisesti suurempi erä.
    // Pääte-ehtona toimii currentFeedLimit < 500, joka estää ikuisen lataussilmukan.
    if (currentFeedLimit < 500) {
      const nextLimit = currentFeedLimit === 5 ? 50 : 500;
      setTimeout(() => loadMoreFeed(nextLimit), 0);
      return;
    }
    
    // Varmistetaan, että tagipilvi renderöidään ja näytetään, vaikka uutisia ei näkyisikään aloitussivulla
    if (cachedArticles) {
      renderTagCloud(cachedArticles);
      const tagCloudContainer = document.getElementById('tag-cloud');
      if (tagCloudContainer) {
        tagCloudContainer.style.display = 'flex';
      }
    }
    
    grid.innerHTML = '<div class="profile-empty profile-empty-text">Ei uutisia valituilla kriteereillä.</div>';
    return;
  }

  // Luodaan uutiskortit
  displayedArticles.forEach((item, index) => {
    const isLead = index === 0 && !currentTagFilter;
    const card = document.createElement('div');
    
    // AS2 metadata attributes for D-CENT patterns
    card.setAttribute('data-id', item.id);
    card.setAttribute('data-type', item.type);

    const imageUrl = item.image && item.image.url ? item.image.url : null;
    const category = item.tag && item.tag.find(t => !t.name.startsWith('likes:') && !t.name.startsWith('dislikes:'))?.name || 'Yleinen';
    const displayTags = (item.tag || []).filter(t => t.name && !t.name.startsWith('likes:') && !t.name.startsWith('dislikes:'));
    const sourceName = item.attributedTo && item.attributedTo.name ? item.attributedTo.name : 'Uutislähde';
    
    // Time rendering in local timezone (Issue #12)
    let timeStr = 'Aika tuntematon';
    if (item.published) {
      try {
        timeStr = new Intl.DateTimeFormat('fi-FI', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.published));
      } catch (e) {}
    }

    // Maksumuuri / Schema.org isAccessibleForFree
    const isPaywalled = item.isAccessibleForFree === false || (item.tag && item.tag.some(t => t.name && t.name.toLowerCase() === '#tilaajille'));

    const originalUrl = item.url || '#';
    const archiveUrl = item.url_archive || null;

    // Jos maksumuuriartikkelille ei ole olemassa Web Archive -snapshotia (url_archive), ei näytetä uutista syötteessä lainkaan
    if (isPaywalled && !archiveUrl) {
      return;
    }

    // Jos kyseessä on maksumuuriartikkeli ja sille on arkistolinkki, päälinkki ohjaa suoraan toimivaan arkistoon
    const targetUrl = (isPaywalled && archiveUrl) ? archiveUrl : originalUrl;

    // Comments count (Issue #11 / D-CENT)
    const commentCount = item.replies && typeof item.replies.totalItems === 'number' ? item.replies.totalItems : 0;

    // Luodaan sormenjälki artikkelin nykyisestä tilasta (kommenttien määrä ja tägit)
    const fingerprint = JSON.stringify({
      comments: commentCount,
      tags: displayTags.map(t => t.name).sort()
    });
    const isRead = seenMap.get(String(item.id)) === fingerprint;
    
    card.className = `feed-item ${isLead ? 'feed-item--lead' : 'feed-item--small'} ${isRead ? 'feed-item--read' : ''}`;
    card.setAttribute('data-fingerprint', fingerprint);

    card.innerHTML = `
      ${imageUrl ? `<a href="${sanitizeUrl(targetUrl)}" target="_blank" class="article-link article-link-image-wrap" data-archive="${sanitizeUrl(archiveUrl)}" rel="noopener noreferrer nofollow"><img src="${imageUrl}" alt="${sanitize(item.name)}" loading="lazy" referrerpolicy="no-referrer" class="feed-item__image"></a>` : ''}
      <h3 class="feed-item__title"><a href="${sanitizeUrl(targetUrl)}" target="_blank" class="article-link" data-archive="${sanitizeUrl(archiveUrl)}" rel="noopener noreferrer nofollow">${sanitize(item.name)}</a></h3>
      ${item.summary ? `<p class="feed-item__excerpt">${sanitize(item.summary)}</p>` : ''}
      
      <div class="reaction-container reaction-container-vertical">
        ${commentCount > 0 ? `
        <button class="btn-comments-toggle btn-comments-toggle-styled" data-id="${item.id}">
          💬 Kommentit (${commentCount})
        </button>
        ` : ''}
        
        <div class="quick-comment-container quick-comment-container-styled">
          <textarea class="quick-comment-textarea quick-comment-textarea-styled" placeholder="Kirjoita kommentti..." data-id="${item.id}" aria-label="Pikakommentti"></textarea>
          <div class="quick-comment-actions quick-comment-actions-styled">
            <button class="btn-quick-comment-submit btn-primary btn-quick-comment-submit-styled">Lähetä</button>
            <button class="btn-quick-comment-cancel btn-ghost btn-quick-comment-cancel-styled">Peruuta</button>
          </div>
        </div>
      </div>

      <div class="feed-item__meta feed-item__meta-row">
        <span class="feed-item__source">${sourceName}</span>
        <span class="feed-item__time feed-item__time-left">${timeStr}</span>
        
        <div class="feed-item__tags-list feed-item__tags-list-row">
          ${displayTags.map(t => `<span class="feed-item__tag feed-item__tag-styled" data-tag="${sanitize(t.name)}">${sanitize(t.name)}</span>`).join('')}
          <button class="btn-add-tag-toggle btn-add-tag-toggle-styled" data-id="${item.id}" aria-label="Lisää tagi">+</button>
        </div>
      </div>
      <div class="add-tag-form-container add-tag-form-container-styled" data-id="${item.id}">
        <input type="text" class="add-tag-input add-tag-input-styled" placeholder="tiede" aria-label="Uuden tagin nimi" />
        <button class="btn-add-tag-submit btn-primary btn-add-tag-submit-styled">Tallenna</button>
        <button class="btn-add-tag-cancel btn-ghost btn-add-tag-cancel-styled">Peruuta</button>
      </div>
      <div class="feed-item__comments-section feed-item__comments-section-styled" data-id="${item.id}"></div>
    `;

    // Click handler for quick comment
    const quickCommentTextarea = card.querySelector('.quick-comment-textarea');
    const quickCommentActions = card.querySelector('.quick-comment-actions');
    const btnQuickSubmit = card.querySelector('.btn-quick-comment-submit');
    const btnQuickCancel = card.querySelector('.btn-quick-comment-cancel');
    
    if (quickCommentTextarea && quickCommentActions) {
      quickCommentTextarea.addEventListener('focus', () => {
        if (!auth.currentUser) {
          openLogin();
          quickCommentTextarea.blur();
          return;
        }
        quickCommentTextarea.style.minHeight = '60px';
        quickCommentTextarea.style.resize = 'vertical';
        quickCommentActions.style.display = 'flex';
      });
      
      btnQuickCancel.addEventListener('click', (e) => {
        e.preventDefault();
        quickCommentTextarea.value = '';
        quickCommentTextarea.style.minHeight = '36px';
        quickCommentTextarea.style.height = '36px';
        quickCommentTextarea.style.resize = 'none';
        quickCommentActions.style.display = 'none';
      });
      
      btnQuickSubmit.addEventListener('click', async (e) => {
        e.preventDefault();
        const content = quickCommentTextarea.value.trim();
        if (!content) return;
        
        try {
          await postComment(item.id, content);
          quickCommentTextarea.value = '';
          quickCommentTextarea.style.minHeight = '36px';
          quickCommentTextarea.style.height = '36px';
          quickCommentTextarea.style.resize = 'none';
          quickCommentActions.style.display = 'none';
          
          const section = card.querySelector(`.feed-item__comments-section[data-id="${item.id}"]`);
          if (section) {
            section.style.display = 'block';
            section.innerHTML = '<div class="comments-loading-text">Ladataan kommentteja...</div>';
            const freshReplies = await fetchReplies(item.id);
            renderCommentsSection(card, item.id, freshReplies);
          }
        } catch (err) {
          showNotification("Kommentin lähetys epäonnistui: " + err.message, true);
        }
      });
    }

    // Click handler for tags to filter the feed
    card.querySelectorAll('.feed-item__tag').forEach(tagEl => {
      tagEl.addEventListener('click', (e) => {
        e.preventDefault();
        const tagName = tagEl.getAttribute('data-tag');
        if (tagName) {
          currentTagFilter = currentTagFilter === tagName ? null : tagName;
          refreshFeed();
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
          section.innerHTML = '<div class="comments-loading-text">Ladataan kommentteja...</div>';
          try {
            const replies = await fetchReplies(articleId);
            renderCommentsSection(card, articleId, replies);
          } catch (err) {
            renderCommentsSection(card, articleId, [], `Virhe kommenttien haussa: ${err.message}`);
          }
        }
      });
    });

    // Animoidaan uutiskortit ja seurataan niiden lukemista IntersectionObserverilla
    card.style.opacity = '0';
    card.style.transform = 'translateY(16px)';
    card.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
    readObserver.observe(card);

    grid.appendChild(card);
  });
  updateActiveSourcesWidget(articles);
}


// ---- TAG CLOUD LOGIC (Issue #16) ----
function renderTagCloud(articles) {
  const container = document.getElementById('tag-cloud');
  if (!container) return;

  const counts = new Map();
  articles.forEach(item => {
    if (item.tag) {
      item.tag.forEach(t => {
        if (t && t.name && !t.name.startsWith('likes:') && !t.name.startsWith('dislikes:')) {
          counts.set(t.name, (counts.get(t.name) || 0) + 1);
        }
      });
    }
  });

  // Näytetään 42 tagia
  const sortedTags = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 42);

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

}

async function refreshFeed() {
  if (pendingSeenSync.size > 0 && auth.currentUser) {
    await syncPendingSeen();
  }

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
    console.error("Feed loading failed:", err.stack || err);
    const grid = document.getElementById('feed-grid');
    if (grid) {
      grid.setAttribute('aria-busy', 'false');
      // Virherajapinta / Error boundary uutisvirralle (Issue #58)
      grid.innerHTML = `
        <div class="error-boundary error-boundary-styled">
          <div class="error-boundary-icon">⚠️</div>
          <h3 class="error-boundary-title">Uutisvirran lataus epäonnistui</h3>
          <p class="error-boundary-desc">${sanitize(err.message || 'Yhteysongelma rajapintaan.')}</p>
          <div style="font-family: monospace; font-size: 0.8rem; margin: 12px auto; padding: 12px; background: rgba(0,0,0,0.05); border-radius: 4px; text-align: left; max-width: 500px; word-break: break-all; color: var(--color-text, #333);">
            <strong>Debug-tiedot:</strong><br>
            Virhe: ${sanitize(err.name || 'Error')}: ${sanitize(err.message || 'Tuntematon virhe')}<br>
            Konteksti: refreshFeed
          </div>
          <div class="error-boundary-actions">
            <button class="btn btn--primary btn-error-retry-styled" id="btn-error-retry">Yritä uudelleen</button>
            ${cachedArticles && cachedArticles.length > 0 ? `<button class="btn btn--secondary btn-error-offline-styled" id="btn-error-offline">Näytä offline-versio</button>` : ''}
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
  if (pendingSeenSync.size > 0 && auth.currentUser) {
    await syncPendingSeen();
  }

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
    console.error("Load more failed:", err.stack || err);
    if (loader) {
      loader.remove();
    }
    
    // Piirretään rikas virheilmoitus suoraan gridiin
    grid.innerHTML = `
      <div class="error-boundary error-boundary-styled">
        <div class="error-boundary-icon">⚠️</div>
        <h3 class="error-boundary-title">Uutisten lataus epäonnistui</h3>
        <p class="error-boundary-desc">${sanitize(err.message || 'Yhteysongelma rajapintaan.')}</p>
        <div style="font-family: monospace; font-size: 0.8rem; margin: 12px auto; padding: 12px; background: rgba(0,0,0,0.05); border-radius: 4px; text-align: left; max-width: 500px; word-break: break-all; color: var(--color-text, #333);">
          <strong>Debug-tiedot:</strong><br>
          Virhe: ${sanitize(err.name || 'Error')}: ${sanitize(err.message || 'Tuntematon virhe')}<br>
          Pyydetty raja (limit): ${currentFeedLimit}<br>
          Konteksti: loadMoreFeed
        </div>
        <div class="error-boundary-actions">
          <button class="btn btn--primary btn-error-retry-styled" id="btn-error-retry">Yritä uudelleen</button>
        </div>
      </div>
    `;

    const retryBtn = document.getElementById('btn-error-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        loadMoreFeed(currentFeedLimit);
      });
    }

    // Jos 500 uutisen haku epäonnistuu, mutta meillä on aiemmin ladattu uutiserä,
    // piirretään ja näytetään tagipilvi sen avulla.
    if (cachedArticles && cachedArticles.length > 0) {
      renderTagCloud(cachedArticles);
      const tagCloudContainer = document.getElementById('tag-cloud');
      if (tagCloudContainer) {
        tagCloudContainer.style.display = 'flex';
      }
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
  
  // Vieritetään sivu ylös uuteen näkymään siirryttäessä (Issue #150 / L-012)
  window.scrollTo({ top: 0, behavior: 'instant' });
  
  // Ladataan uutiset vain uutissivulla
  if (view === 'news') {
    refreshFeed();
  }
});

function migrateOldSeenKeys() {
  try {
    // TODO: Tämä kattaa vain nykyisen käyttäjän ja anonyymin tilan. Jos laitteella on aiemmin ollut
    // kirjautuneena muita käyttäjiä (muita UID-tunnuksia), heidän vanhoja "seen_<uid>_art_*" avaimiaan
    // ei siivota tai migroida. Tämä on pieni tallennustilavuoto, joka voidaan siivota myöhemmin.
    const uids = ['anonymous'];
    if (auth.currentUser) uids.push(auth.currentUser.uid);
    
    uids.forEach(uid => {
      const listKey = `seen_list_${uid}`;
      if (localStorage.getItem(listKey)) return;
      
      const migrated = [];
      const keysToDelete = [];
      const prefix = `seen_${uid}_art_`;
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const artId = key.substring(prefix.length);
          const val = localStorage.getItem(key);
          migrated.push([artId, val]);
          keysToDelete.push(key);
        }
      }
      
      if (migrated.length > 0) {
        if (migrated.length > 10000) migrated.splice(0, migrated.length - 10000);
        localStorage.setItem(listKey, JSON.stringify(migrated));
        keysToDelete.forEach(k => localStorage.removeItem(k));
        console.log(`[seen] Migrated ${migrated.length} seen articles for user ${uid}`);
      }
    });
  } catch (e) {
    console.warn("Migration of seen keys failed:", e);
  }
}

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
  const items = data.orderedItems || [];
  return items.map(item => {
    if (item && item.type === 'Create' && item.object && typeof item.object === 'object') {
      return {
        ...item,
        ...item.object,
        id: item.id,
        type: item.object.type || 'Note'
      };
    }
    return item;
  });
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

  const mainComments = replies.filter(r => r.inReplyTo === articleId);
  const repliesToComments = replies.filter(r => r.inReplyTo !== articleId);

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
      const cObj = comment;
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
        <div class="comment-header-row">
          <img src="${actorPic}" alt="" class="comment-actor-avatar" />
          <strong class="comment-actor-name">${sanitize(actorName)}</strong>
          <time datetime="${cObj.published}" class="comment-published-time">${timeAgo}</time>
        </div>
        <p class="comment-content-text">${sanitize(cObj.content)}</p>
        <div class="comment-actions-row">
          <button class="btn-comment-reply btn-comment-reply-styled" data-parent-id="${sanitize(cObj.id)}">Vastaa</button>
          <button class="btn-comment-agree btn-comment-agree-styled" data-id="${sanitize(cObj.id)}">👍 Samaa mieltä (${cObj.like_count || 0})</button>
          <button class="btn-comment-disagree btn-comment-disagree-styled" data-id="${sanitize(cObj.id)}">👎 Eri mieltä (${cObj.dislike_count || 0})</button>
        </div>
        <div class="replies-container comment-replies-container">
          <!-- Vastaukset rendataan tähän -->
        </div>
      `;

      const childReplies = repliesToComments.filter(r => r.inReplyTo === cObj.id);
      const repliesContainer = commentDiv.querySelector('.replies-container');

      childReplies.forEach(reply => {
        const rObj = reply;
        const rActorName = rObj.attributedTo ? sanitize(rObj.attributedTo.split('/').pop()) : 'Käyttäjä';
        const rTimeAgo = new Date(rObj.published).toLocaleString('fi-FI');

        const replyDiv = document.createElement('div');
        replyDiv.className = 'comment-item level-2';
        replyDiv.style.background = 'var(--color-surface)';
        replyDiv.style.border = '1px solid var(--color-divider)';
        replyDiv.style.borderRadius = 'var(--radius-md)';
        replyDiv.style.padding = 'var(--space-2)';

        replyDiv.innerHTML = `
          <div class="reply-header-row">
            <img src="${actorPic}" alt="" class="comment-actor-avatar-l2" />
            <strong class="comment-actor-name-l2">${rActorName}</strong>
            <time datetime="${rObj.published}" class="comment-published-time-l2">${rTimeAgo}</time>
          </div>
          <p class="comment-content-text-l2">${sanitize(rObj.content)}</p>
          <div class="comment-actions-row">
            <button class="btn-comment-reply-l2 btn-comment-reply-l2-styled" data-parent-id="${sanitize(cObj.id)}">Vastaa</button>
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

  // Kerätään viestiketjun kommentoijien nimet autocompletea varten ja sanitoidaan ne XSS:n estämiseksi
  const threadUsers = Array.from(new Set(
    replies
      .map(r => sanitize((r.attributedTo ? r.attributedTo : '').split('/').pop()))
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
      showNotification("Kommentin lähetys epäonnistui: " + err.message, true);
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
          showNotification("Vastauksen lähetys epäonnistui: " + err.message, true);
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


// Altistetaan preferenssifunktiot globaalisti vain testejä varten
if (import.meta.env.DEV || (typeof window !== 'undefined' && window.__TESTING__)) {
  window.updatePrefs = updatePrefs;
  window.exportPrefsAsJson = exportPrefsAsJson;
  window.deleteUserPrefs = deleteUserPrefs;
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
  
  // Refaktoroitu ohjelmalliseksi CSP-yhteensopivuuden takaamiseksi
  elActiveSources.innerHTML = '';
  sorted.forEach(([name, count]) => {
    const pct = Math.max(5, Math.round((count / max) * 100));
    const row = document.createElement('div');
    row.className = 'vis-row';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'vis-source-name';
    nameSpan.textContent = name;
    
    const barWrap = document.createElement('div');
    barWrap.className = 'vis-bar-wrap';
    const bar = document.createElement('div');
    bar.className = 'vis-bar';
    bar.style.width = `${pct}%`;
    barWrap.appendChild(bar);
    
    const countSpan = document.createElement('span');
    countSpan.className = 'vis-count';
    countSpan.textContent = count;
    
    row.appendChild(nameSpan);
    row.appendChild(barWrap);
    row.appendChild(countSpan);
    elActiveSources.appendChild(row);
  });
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
    const articles = (cachedArticles && cachedArticles.length > 0) ? cachedArticles : await fetchOutbox(null, 50);
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
