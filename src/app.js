/**
 * app.js – Sovelluksen juurimoduuli
 *
 * Vastaa:
 *   - Firebase-alustuksesta ja autentikoinnista (Google Sign-In)
 *   - Kirjautumismodaalin auki/kiinni-logiikasta
 *   - Auth-tilan muutoksiin reagoinnista:
 *       kirjautunut  → initPrefs(app, uid), initProfileModal(user), loadPrefs()
 *       kirjautunut ulos → initPrefs(app, null), loadPrefs()
 *
 * Arkkitehtuuriraja:
 *   Tämä moduuli omistaa Firebase Auth -yhteyden.
 *   Preferenssien persistointi (Firestore + localStorage) on delegoitu prefs.js:lle.
 *   Profiilimodaalin UI on delegoitu profile.js:lle.
 *   app.js ei lue eikä kirjoita preferenssejä suoraan.
 *
 * Riippuvuudet:
 *   – prefs.js  (initPrefs, loadPrefs)
 *   – profile.js (initProfileModal, openProfileModal)
 *   – Firebase Auth, Analytics (CDN)
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
  apiKey: "AIzaSyApRi0p3KXOe6W6F-t8QInqJoZQdjOfCjI",
  authDomain: "uutisseuranta-net.firebaseapp.com",
  projectId: "uutisseuranta-net",
  storageBucket: "uutisseuranta-net.firebasestorage.app",
  messagingSenderId: "131558328064",
  appId: "1:131558328064:web:2b1eabe45fdb807c9d55e5",
  measurementId: "G-9J9T62LY57"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
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
      alert('Tämä verkkotunnus ei ole sallittu Firebase-konsolissa. Lisää se Authorized domains -listalle.');
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

// ---- FETCH OUTBOX WITH RATE-LIMIT HANDLING (Issue #60 / L-011) ----
async function fetchOutbox(tag = null, retryCount = 0) {
  let url = `${QUERY_API_URL}/ap/outbox`;
  if (tag) {
    url += `?tag=${encodeURIComponent(tag)}`;
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
        const delay = Math.pow(2, retryCount) * 1000;
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

// ---- RENDERING LOGIC (Issue #12, #20, #21, #24) ----
function renderFeed(articles) {
  const grid = document.getElementById('feed-grid');
  if (!grid) return;

  grid.innerHTML = '';
  grid.removeAttribute('aria-busy');

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

    // Reacting states
    let localReaction = localStorage.getItem(`reaction_${item.id}`) || null;

    card.innerHTML = `
      ${isLead ? `<img src="${imageUrl}" alt="${item.name}" loading="lazy" class="feed-item__image">` : ''}
      <div class="feed-item__category"><span class="category-dot"></span>${category}</div>
      <h3 class="feed-item__title"><a href="${originalUrl}" target="_blank" rel="noopener noreferrer">${item.name}</a></h3>
      ${item.summary ? `<p class="feed-item__excerpt">${item.summary}</p>` : ''}
      
      <a href="${archiveUrl}" target="_blank" rel="noopener noreferrer" class="archive-badge" title="Katso arkistoitu versio (Wayback Machine)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px; display:inline-block; vertical-align:middle;"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        Arkisto
      </a>

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

      <div class="feed-item__meta" style="margin-top:var(--space-4);">
        <span class="feed-item__source">${sourceName}</span>
        <span class="feed-item__time">${timeStr}</span>
      </div>
    `;

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
        const activeReaction = localStorage.getItem(`reaction_${articleId}`);

        // Pre-save previous state for rollback
        const prevReaction = activeReaction;

        // Optimistic update state
        let newReaction = null;
        if (activeReaction === action) {
          localStorage.removeItem(`reaction_${articleId}`);
        } else {
          localStorage.setItem(`reaction_${articleId}`, action);
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
            localStorage.setItem(`reaction_${articleId}`, prevReaction);
          } else {
            localStorage.removeItem(`reaction_${articleId}`);
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
          alert("Virhe reaktion tallennuksessa. Tila palautettu.");
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

  try {
    const articles = await fetchOutbox(currentTagFilter);
    cachedArticles = articles;
    renderFeed(articles);
    if (!currentTagFilter) {
      renderTagCloud(articles);
    }
  } catch (err) {
    const grid = document.getElementById('feed-grid');
    if (grid) {
      grid.innerHTML = `<div class="profile-empty" style="grid-column:1/-1; color:#c81e1e; text-align:center;">Uutisten lataus epäonnistui: ${err.message}</div>`;
    }
  }
}

// ---- CUSTOM USER FEED SYNC (Issue #51) ----
onPrefsChange((prefs) => {
  // Kun preferenssit latautuvat tai muuttuvat, haetaan uutiset (personoitu uutisvirta huomioiden)
  refreshFeed();
});

// Ensimmäinen uutisten lataus
refreshFeed();

