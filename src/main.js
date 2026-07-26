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
import { initPrefs, loadPrefs, followTag, unfollowTag, isFollowing, onPrefsChange, getPrefs, updatePrefs } from './prefs.js';
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
  } else {
    // Alustetaan preferenssit paikalliseen tilaan ilman kirjautumista
    initPrefs(app, null);

    btnLogin.style.display = 'inline-flex';
    userProfile.style.display = 'none';
    userAvatar.src = '';

    await loadPrefs();
  }
});

// Kytketään navbarin avatar-nappi avaamaan profiilimodaali
btnProfile.addEventListener('click', () => {
  openProfileModal();
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
const QUERY_API_URL = import.meta.env.VITE_QUERY_API_URL || 'https://query-api-yq2o6p5wqa-lz.a.run.app';
const WRITE_API_URL = import.meta.env.VITE_WRITE_API_URL || 'https://write-api-yq2o6p5wqa-lz.a.run.app';

let currentTagFilter = null;
let cachedArticles = [];

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
async function fetchOutbox(tag = null, retryCount = 0) {
  let url = `${QUERY_API_URL}/ap/outbox`;
  if (tag) {
    url += `?tag=${encodeURIComponent(tag)}`;
  } else {
    // Jos suodatinta ei ole valittu ("Kaikki"-näkymä), haetaan käyttäjän seuratut tagit
    // tai käytetään oletustageja jos lista on tyhjä, jotta backend ei anna 400 Bad Request -virhettä.
    const prefs = getPrefs();
    const tagsToQuery = (prefs.followedTags && prefs.followedTags.length > 0)
      ? prefs.followedTags
      : ['#politiikka', '#talous', '#tiede', '#viihde', '#ulkomaat', '#kotimaa', '#kulttuuri', '#urheilu', '#sää'];
    
    const params = tagsToQuery.map(t => `tag=${encodeURIComponent(t)}`).join('&');
    url += `?${params}`;
  }

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
        return fetchOutbox(tag, retryCount + 1);
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

    card.innerHTML = `
      ${isLead ? `<a href="${sanitizeUrl(originalUrl)}" target="_blank" class="article-link" data-archive="${sanitizeUrl(archiveUrl)}" rel="noopener noreferrer nofollow" style="display:block; overflow:hidden; border-radius:var(--radius-md);"><img src="${imageUrl}" alt="${sanitize(item.name)}" loading="lazy" class="feed-item__image"></a>` : ''}
      <div class="feed-item__category"><span class="category-dot"></span>${sanitize(category)}</div>
      <h3 class="feed-item__title"><a href="${sanitizeUrl(originalUrl)}" target="_blank" class="article-link" data-archive="${sanitizeUrl(archiveUrl)}" rel="noopener noreferrer nofollow">${sanitize(item.name)}</a></h3>
      ${item.summary ? `<p class="feed-item__excerpt">${sanitize(item.summary)}</p>` : ''}
      
      ${hasReactions ? `
        <div class="vote-stats" role="img" aria-label="Reaktiot: ${agreePct}% samaa mieltä (${likesCount} ääntä), ${disagreePct}% eri mieltä (${dislikesCount} ääntä)">
          <div class="vote-stats__segment vote-stats__segment--agree" style="flex: ${agreePct}"></div>
          <div class="vote-stats__segment vote-stats__segment--disagree" style="flex: ${disagreePct}"></div>
        </div>
      ` : ''}

      <div class="reaction-container">
        <button class="btn-reaction" data-action="like" data-id="${item.id}" aria-pressed="${localReaction === 'Like' ? 'true' : 'false'}">
          👍 Samaa mieltä (${likesCount})
        </button>
        <button class="btn-reaction" data-action="dislike" data-id="${item.id}" aria-pressed="${localReaction === 'Dislike' ? 'true' : 'false'}">
          👎 Eri mieltä (${dislikesCount})
        </button>
        <span style="font-size:var(--text-xs); color:var(--color-text-faint); margin-left:auto;">💬 ${commentCount}</span>
      </div>

      <div class="feed-item__meta" style="margin-top:var(--space-4); display:flex; align-items:center; gap:var(--space-2); width:100%;">
        <span class="feed-item__source">${sourceName}</span>
        <span class="feed-item__time">${timeStr}</span>
        ${item.url_archive ? `
          <a href="${sanitizeUrl(archiveUrl)}" target="_blank" rel="noopener noreferrer nofollow" class="feed-item__archive-link" style="margin-left:auto; font-size:var(--text-xs); color:var(--color-text-faint); text-decoration:none; display:flex; align-items:center; gap:4px;" aria-label="Lue artikkelin arkistoitu versio Wayback Machinessa (avautuu uudessa välilehdessä)">
            📎 Arkisto
          </a>
        ` : ''}
      </div>
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

        // Optimistic update state
        let newReaction = null;
        if (activeReaction === action) {
          localStorage.removeItem(userReactionKey);
        } else {
          localStorage.setItem(userReactionKey, action);
          newReaction = action;
        }

        // Instantly update DOM state (optimistic representation)
        const likeBtn = card.querySelector('.btn-reaction[data-action="like"]');
        const dislikeBtn = card.querySelector('.btn-reaction[data-action="dislike"]');
        
        // Current counts
        let currentLikes = likesCount;
        let currentDislikes = dislikesCount;

        // Adjust counts locally based on transitions
        if (prevReaction === 'Like') currentLikes--;
        if (prevReaction === 'Dislike') currentDislikes--;
        if (newReaction === 'Like') currentLikes++;
        if (newReaction === 'Dislike') currentDislikes++;

        // Update UI elements instantly
        likeBtn.setAttribute('aria-pressed', newReaction === 'Like' ? 'true' : 'false');
        likeBtn.innerHTML = `👍 Samaa mieltä (${currentLikes})`;
        dislikeBtn.setAttribute('aria-pressed', newReaction === 'Dislike' ? 'true' : 'false');
        dislikeBtn.innerHTML = `👎 Eri mieltä (${currentDislikes})`;

        // Synkronoidaan uudet laskurit cachedArticles-taulukkoon (Blocker-korjaus)
        const cachedArticle = cachedArticles.find(a => a.id === articleId);
        if (cachedArticle) {
          if (!cachedArticle.likes) cachedArticle.likes = { totalItems: 0 };
          if (!cachedArticle.dislikes) cachedArticle.dislikes = { totalItems: 0 };
          cachedArticle.likes.totalItems = currentLikes;
          cachedArticle.dislikes.totalItems = currentDislikes;
        }

        // Update the progress bar if present
        const statsBar = card.querySelector('.vote-stats');
        const total = currentLikes + currentDislikes;
        if (statsBar) {
          if (total > 0) {
            const agree = Math.round(currentLikes / total * 100);
            const disagree = 100 - agree;
            statsBar.setAttribute('aria-label', `Reaktiot: ${agree}% samaa mieltä (${currentLikes} ääntä), ${disagree}% eri mieltä (${currentDislikes} ääntä)`);
            statsBar.querySelector('.vote-stats__segment--agree').style.flex = agree;
            statsBar.querySelector('.vote-stats__segment--disagree').style.flex = disagree;
            statsBar.style.display = 'flex';
          } else {
            statsBar.style.display = 'none';
          }
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

          // Rollback DOM elements
          likeBtn.setAttribute('aria-pressed', prevReaction === 'Like' ? 'true' : 'false');
          likeBtn.innerHTML = `👍 Samaa mieltä (${likesCount})`;
          dislikeBtn.setAttribute('aria-pressed', prevReaction === 'Dislike' ? 'true' : 'false');
          dislikeBtn.innerHTML = `👎 Eri mieltä (${dislikesCount})`;
          
          if (statsBar) {
            if (likesCount + dislikesCount > 0) {
              statsBar.setAttribute('aria-label', `Reaktiot: ${agreePct}% samaa mieltä (${likesCount} ääntä), ${disagreePct}% eri mieltä (${dislikesCount} ääntä)`);
              statsBar.querySelector('.vote-stats__segment--agree').style.flex = agreePct;
              statsBar.querySelector('.vote-stats__segment--disagree').style.flex = disagreePct;
              statsBar.style.display = 'flex';
            } else {
              statsBar.style.display = 'none';
            }
          }
          showNotification("Virhe reaktion tallennuksessa. Tila palautettu.", true);
        }
      });
    });

    grid.appendChild(card);
  });
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

  const sortedTags = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  container.innerHTML = '';
  
  // All tags option
  const allBtn = document.createElement('button');
  allBtn.className = `tag-cloud__tag ${!currentTagFilter ? 'tag-cloud__tag--active' : ''}`;
  allBtn.textContent = 'Kaikki';
  allBtn.addEventListener('click', () => {
    currentTagFilter = null;
    refreshFeed();
  });
  container.appendChild(allBtn);

  sortedTags.forEach(([tagName, count]) => {
    const btn = document.createElement('button');
    btn.className = `tag-cloud__tag ${currentTagFilter === tagName ? 'tag-cloud__tag--active' : ''}`;
    btn.textContent = `${tagName} (${count})`;
    btn.setAttribute('aria-label', `Tagi ${tagName}, ${count} uutista`);
    btn.addEventListener('click', () => {
      currentTagFilter = currentTagFilter === tagName ? null : tagName;
      refreshFeed();
    });
    container.appendChild(btn);
  });
}

async function refreshFeed() {
  const grid = document.getElementById('feed-grid');
  if (grid) {
    grid.innerHTML = `
      <div class="skeleton-card" aria-hidden="true"><div class="skeleton-img"></div><div class="skeleton-title"></div><div class="skeleton-text"></div></div>
      <div class="skeleton-card" aria-hidden="true"><div class="skeleton-img"></div><div class="skeleton-title"></div><div class="skeleton-text"></div></div>
      <div class="skeleton-card" aria-hidden="true"><div class="skeleton-img"></div><div class="skeleton-title"></div><div class="skeleton-text"></div></div>
    `;
    grid.setAttribute('aria-busy', 'true');
  }

  const startTime = Date.now();

  try {
    const articles = await fetchOutbox(currentTagFilter);
    cachedArticles = articles;

    // Varmistetaan, että skeleton-loader näkyy vähintään 100ms (UX-vaatimus / Issue #12)
    const elapsed = Date.now() - startTime;
    if (elapsed < 100) {
      await new Promise(resolve => setTimeout(resolve, 100 - elapsed));
    }

    renderFeed(articles);
    if (!currentTagFilter) {
      renderTagCloud(articles);
    }
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


