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
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js';
import { initPrefs, loadPrefs, followTag, unfollowTag, isFollowing, onPrefsChange, getPrefs, updatePrefs } from './prefs.js';
import { initProfileModal, openProfileModal } from './profile.js';

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
