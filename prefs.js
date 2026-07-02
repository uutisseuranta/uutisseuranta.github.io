/**
 * prefs.js – Käyttäjäpreferenssien hallinta
 *
 * Persistointi: selaimen localStorage
 * ─────────────────────────────────────
 * Kaikki preferenssit tallennetaan paikallisesti localStorage:hen.
 * Firestore-synkronointia ei käytetä (arkkitehtuuripäätös, ks. TECHNICAL_DESIGN.md).
 *
 * Avain muodostetaan käyttäjän uid:stä, joten eri käyttäjien
 * asetukset eivät sekoitu samalla laitteella.
 * Kirjautumattomalle käyttäjälle käytetään avainta "prefs_anonymous".
 *
 * Tietomalli (localStorage):
 * {
 *   followedTags  : string[],            // seuratut aihetunnisteet
 *   theme         : 'light'|'dark'|'system',
 *   updatedAt     : number | null,        // Date.now() aikaleima
 *   schemaVersion : number                // migraatioiden versionhallinta
 * }
 */

export const SCHEMA_VERSION = 1;

const DEFAULT_PREFS = {
  followedTags: [],
  theme: 'system',
  updatedAt: null,
  schemaVersion: SCHEMA_VERSION,
};

/** Nykyinen uid – null tarkoittaa kirjautumatonta käyttäjää. */
let _uid = null;

/** Käynnissä oleva preferenssikopio muistissa. */
let _prefs = { ...DEFAULT_PREFS };

/** Rekisteröidyt muutoskuuntelijat. */
let _listeners = [];

// ── Julkinen API ─────────────────────────────────────────────────

/**
 * Alusta moduuli.
 * Kutsutaan aina kun autentikointitila muuttuu (kirjautuminen / uloskirjautuminen).
 *
 * @param {import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js').FirebaseApp} _app - Firebase-sovellus (ei käytetä, API-yhteensopivuus)
 * @param {string|null} uid - Kirjautuneen käyttäjän uid, tai null
 */
export function initPrefs(_app, uid) {
  _uid = uid;
  // Nollataan muistin tila jotta ei jää edellisen käyttäjän tietoja
  _prefs = { ...DEFAULT_PREFS };
}

/** Palauttaa nykyiset preferenssit (synkroninen). */
export function getPrefs() {
  return { ..._prefs };
}

/**
 * Lataa preferenssit localStorage:sta.
 * Lukee oikean käyttäjäkohtaisen avaimen.
 * Kutsutaan aina autentikointitilan muuttuessa.
 */
export async function loadPrefs() {
  _prefs = _readLocal() ?? { ...DEFAULT_PREFS };
  _notify();
}

/**
 * Päivitä yksi tai useampi kenttä preferensseissä.
 * Tallentaa välittömästi localStorage:hen ja ilmoittaa kuuntelijoille.
 *
 * @param {Partial<typeof DEFAULT_PREFS>} partial - Päivitettävät kentät
 */
export function updatePrefs(partial) {
  _prefs = { ..._prefs, ...partial, updatedAt: Date.now() };
  _writeLocal(_prefs);
  _notify();
}

/** Lisää tagi seurantalistaan. Idempotent – ei tee mitään jos jo seurannassa. */
export function followTag(tag) {
  const tags = new Set(_prefs.followedTags);
  if (tags.has(tag)) return;
  tags.add(tag);
  updatePrefs({ followedTags: [...tags] });
}

/** Poistaa tagin seurantalistalta. Idempotent – ei tee mitään jos ei seurannassa. */
export function unfollowTag(tag) {
  const tags = new Set(_prefs.followedTags);
  if (!tags.has(tag)) return;
  tags.delete(tag);
  updatePrefs({ followedTags: [...tags] });
}

/** Palauttaa true jos tagi on seurantalistalla. */
export function isFollowing(tag) {
  return _prefs.followedTags.includes(tag);
}

/**
 * Vie käyttäjän preferenssit JSON-tiedostona selaimelle ladattavaksi.
 * Sisältää vain käyttäjän omat asetukset – ei muuta dataa.
 *
 * @param {{ uid: string, displayName: string, email: string }} user
 */
export function exportPrefsAsJson(user) {
  const payload = {
    exportedAt: new Date().toISOString(),
    user: {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
    },
    preferences: { ..._prefs },
  };
  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `uutisseuranta-asetukset-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  // Vapautetaan muisti
  URL.revokeObjectURL(url);
}

/**
 * Rekisteröi muutoskuuntelija.
 * Kuuntelija kutsutaan aina kun preferenssit muuttuvat.
 * Palauttaa unsubscribe-funktion.
 *
 * @param {(prefs: typeof DEFAULT_PREFS) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onPrefsChange(fn) {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter(l => l !== fn);
  };
}

// ── Sisäiset apufunktiot ─────────────────────────────────────────

/** Muodostaa localStorage-avaimen uid:n perusteella. */
function _storageKey() {
  return `prefs_${_uid ?? 'anonymous'}`;
}

/** Lukee preferenssit localStorage:sta. Palauttaa null jos ei löydy tai parse epäonnistuu. */
function _readLocal() {
  try {
    const raw = localStorage.getItem(_storageKey());
    if (!raw) return null;
    return _migrate(JSON.parse(raw));
  } catch {
    // JSON-parsaus tai localStorage epäonnistui (yksityistila, vioittunut data)
    return null;
  }
}

/** Kirjoittaa preferenssit localStorage:hen. Epäonnistuminen on hiljainen (quota tms.). */
function _writeLocal(prefs) {
  try {
    localStorage.setItem(_storageKey(), JSON.stringify(prefs));
  } catch {
    // Voi epäonnistua yksityistilassa tai kun tallennustila on täynnä
  }
}

/** Ilmoittaa kaikille rekisteröidyille kuuntelijoille preferenssien muutoksesta. */
function _notify() {
  const snapshot = { ..._prefs };
  _listeners.forEach(fn => fn(snapshot));
}

/**
 * Päivittää vanhan rakenteen uuteen skeemaan täyttämällä puuttuvat kentät.
 * Varmistaa taaksepäin yhteensopivuuden kun tietomalliin lisätään kenttiä.
 *
 * @param {object} stored - localStorage:sta luettu raakaobjekti
 * @returns {typeof DEFAULT_PREFS}
 */
function _migrate(stored) {
  return {
    ...DEFAULT_PREFS,
    ...stored,
    schemaVersion: SCHEMA_VERSION,
  };
}
