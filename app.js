import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js';
import { initPrefs, loadPrefs, followTag, unfollowTag, getPrefs, onPrefsChange } from './prefs.js';
import { initProfileModal, openProfileModal } from './profile.js';

// ---- CONFIG & INITIALIZATION ----
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
  }
});

btnLogout.addEventListener('click', () => signOut(auth));

// ---- SCROLL OBSERVER ----
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.feed-item').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(16px)';
  el.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
  observer.observe(el);
});

// ---- ITERATION 1: JACCARD SIMILARITY (UP-13) ----
function calculateJaccard(tagsA, tagsB) {
  const setA = new Set(tagsA);
  const setB = new Set(tagsB);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

function renderRelatedArticles() {
  const items = Array.from(document.querySelectorAll('.feed-item'));
  items.forEach(item => {
    const id = item.getAttribute('data-id');
    const tags = (item.getAttribute('data-tags') || '').split(',').map(t => t.trim()).filter(Boolean);
    
    // Etsi eniten samankaltaiset
    const matches = items
      .filter(other => other.getAttribute('data-id') !== id)
      .map(other => {
        const otherTags = (other.getAttribute('data-tags') || '').split(',').map(t => t.trim()).filter(Boolean);
        const score = calculateJaccard(tags, otherTags);
        return { element: other, score };
      })
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score);

    // Poista vanha liittyvien osio jos on
    item.querySelector('.related-articles')?.remove();

    if (matches.length > 0) {
      const div = document.createElement('div');
      div.className = 'related-articles';
      div.innerHTML = `<h4 class="related-articles__title">Liittyvät aiheet (Jaccard)</h4>`;
      matches.slice(0, 2).forEach(m => {
        const title = m.element.querySelector('.feed-item__title').textContent;
        const scorePct = Math.round(m.score * 100);
        const link = document.createElement('span');
        link.className = 'related-article-link';
        link.textContent = `🔗 ${title} (${scorePct}% samankaltaisuus)`;
        link.style.cursor = 'pointer';
        link.addEventListener('click', (e) => {
          e.stopPropagation();
          m.element.scrollIntoView({ behavior: 'smooth' });
          m.element.style.outline = '2px solid var(--color-primary)';
          setTimeout(() => m.element.style.outline = '', 2000);
        });
        div.appendChild(link);
      });
      item.appendChild(div);
    }
  });
}

// ---- ITERATION 1: FILTER & SEARCH LOGIC (UP-9, UP-14, UP-11) ----
const searchInput = document.getElementById('search-input');
const btnClearSearch = document.getElementById('btn-clear-search');
const filterBar = document.getElementById('filter-bar');
const activeFiltersContainer = document.getElementById('active-filters');
const btnClearFilters = document.getElementById('btn-clear-filters');

function filterFeed() {
  const prefs = getPrefs();
  const followedTags = prefs.followedTags || [];
  const searchQuery = (searchInput.value || '').toLowerCase().trim();
  
  // Tallenna katseluaika kullekin valitulle tägille uuden sisällön ilmoituksen nollaamiseksi (UP-11)
  followedTags.forEach(tag => {
    localStorage.setItem(`seen_${tag}`, Date.now().toString());
  });

  // Rakenna aktiivisten suodattimien palkki
  if (followedTags.length > 0) {
    filterBar.style.display = 'flex';
    activeFiltersContainer.innerHTML = '';
    followedTags.forEach(tag => {
      const badge = document.createElement('span');
      badge.className = 'filter-badge';
      badge.innerHTML = `#${tag} <button class="filter-badge__remove" data-remove="${tag}">&times;</button>`;
      activeFiltersContainer.appendChild(badge);
    });
  } else {
    filterBar.style.display = 'none';
  }

  // Päivitä täginappien aktiivisuus uutiskorteissa
  document.querySelectorAll('.feed-item__tag-btn').forEach(btn => {
    const tag = btn.getAttribute('data-tag');
    if (followedTags.includes(tag)) {
      btn.classList.add('active');
      btn.classList.remove('tag--has-new'); // Nollataan uuden ilmoituksen merkki klikatessa
    } else {
      btn.classList.remove('active');
      
      // Tarkistetaan onko uutta sisältöä (UP-11)
      const lastSeen = parseInt(localStorage.getItem(`seen_${tag}`) || '0', 10);
      const hasNew = Array.from(document.querySelectorAll(`.feed-item[data-tags*="${tag}"]`)).some(item => {
        // Tässä käytetään demo-aikaleimana esim. 2 tuntia sitten = -2h, tai nykyhetkeä
        return lastSeen < (Date.now() - 3600000); // Demo: jos tagia ei ole katsottu tuntiin
      });
      if (hasNew) {
        btn.classList.add('tag--has-new');
      } else {
        btn.classList.remove('tag--has-new');
      }
    }
  });

  let visibleCount = 0;
  const items = document.querySelectorAll('.feed-item');
  items.forEach(item => {
    const title = item.querySelector('.feed-item__title').textContent.toLowerCase();
    const excerpt = item.querySelector('.feed-item__excerpt')?.textContent.toLowerCase() || '';
    const tags = (item.getAttribute('data-tags') || '').split(',').map(t => t.trim());
    
    // Tarkista hakusana
    const matchesSearch = !searchQuery || 
                          title.includes(searchQuery) || 
                          excerpt.includes(searchQuery) || 
                          tags.some(t => t.includes(searchQuery));

    // Tarkista seuratut tagit (OR-logiikka)
    const matchesTags = followedTags.length === 0 || 
                        tags.some(t => followedTags.includes(t));

    if (matchesSearch && matchesTags) {
      item.classList.remove('hidden');
      visibleCount++;
    } else {
      item.classList.add('hidden');
    }
  });

  // Näytä "Ei tuloksia" -ilmoitus jos tarpeen
  document.querySelector('.feed-no-results')?.remove();
  if (visibleCount === 0) {
    const feedGrid = document.querySelector('.feed-grid');
    const noResults = document.createElement('div');
    noResults.className = 'feed-no-results';
    noResults.innerHTML = `
      <h3>Ei hakutuloksia</h3>
      <p>Kokeile toista hakusanaa tai poista aktiivisia aiheita.</p>
    `;
    feedGrid.appendChild(noResults);
  }
}

// Kuuntelijat suodattimien poistoille
activeFiltersContainer.addEventListener('click', e => {
  const removeBtn = e.target.closest('.filter-badge__remove');
  if (removeBtn) {
    const tag = removeBtn.getAttribute('data-remove');
    unfollowTag(tag);
  }
});

btnClearFilters.addEventListener('click', () => {
  const prefs = getPrefs();
  const followedTags = [...(prefs.followedTags || [])];
  followedTags.forEach(tag => unfollowTag(tag));
});

// Kuuntelijat haulle
searchInput.addEventListener('input', () => {
  const val = searchInput.value;
  btnClearSearch.style.display = val ? 'block' : 'none';
  filterFeed();
});

btnClearSearch.addEventListener('click', () => {
  searchInput.value = '';
  btnClearSearch.style.display = 'none';
  filterFeed();
});

// Kuuntelijat tägeille uutiskorteissa
document.addEventListener('click', e => {
  const tagBtn = e.target.closest('.feed-item__tag-btn');
  if (tagBtn) {
    const tag = tagBtn.getAttribute('data-tag');
    const prefs = getPrefs();
    if ((prefs.followedTags || []).includes(tag)) {
      unfollowTag(tag);
    } else {
      followTag(tag);
    }
  }
});

// ---- AUTH STATE & INITIALIZATION ----
onAuthStateChanged(auth, async (user) => {
  if (user) {
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
    initPrefs(app, null);

    btnLogin.style.display = 'inline-flex';
    userProfile.style.display = 'none';
    userAvatar.src = '';

    await loadPrefs();
  }
  
  // Renderöi Jaccard-samankaltaisuudet heti latauksen jälkeen
  renderRelatedArticles();
  filterFeed();
});

onPrefsChange(() => {
  filterFeed();
});
