/**
 * prefs.js – Käyttäjäpreferenssien hallinta
 *
 * Arkkitehtuurimalli: Hybrid localStorage + Firestore (PWA-offline-tuella)
 * ────────────────────────────────────────────────────────────────────────
 * localStorage  → nopea paikallinen välimuisti, UI piirtyy heti
 * Firestore     → kanoninen lähde, synkronoi kaikki laitteet (myös offline)
 *
 * Tietomalli (Firestore): /users/{uid}/preferences/main
 * {
 *   followedTags : string[],   // seuratut aihetunnisteet
 *   theme        : 'light'|'dark'|'system',
 *   updatedAt    : Timestamp,
 *   schemaVersion: number      // migraatioiden versionhallinta
 * }
 *
 * Kirjoituslogiikka:
 *   1. Kirjoita heti localStorageen  (nopea feedback)
 *   2. Debounce 500 ms → kirjoita Firestoreen
 *
 * Lukuprioriteetti käynnistyksessä:
 *   1. Lue localStorage (synkroninen, UI piirtyy)
 *   2. Lue Firestore (asynkroninen, päivitä jos uudempi)
 */

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  enableIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export const SCHEMA_VERSION = 1;

const DEFAULT_PREFS = {
  followedTags: [],
  theme: 'system',
  updatedAt: null,
  schemaVersion: SCHEMA_VERSION
};

let _db = null;
let _uid = null;
let _debounceTimer = null;
let _prefs = { ...DEFAULT_PREFS };
let _listeners = [];

/** Alusta moduuli Firebase app -instanssilla ja uid:llä. */
export function initPrefs(app, uid) {
  _db  = getFirestore(app);
  _uid = uid;

  // Ota offline-persistointi käyttöön Firestorelle PWA-tukea varten
  enableIndexedDbPersistence(_db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('[prefs] Firestore-offline-tallennusta ei voitu ottaa käyttöön (useampi välilehti auki).');
    } else if (err.code === 'unimplemented') {
      console.warn('[prefs] Selain ei tue Firestore-offline-tallennusta.');
    }
  });
}

/** Palauta tämänhetkiset preferenssit (synkroninen). */
export function getPrefs() {
  return { ..._prefs };
}

/**
 * Lataa preferenssit käynnistyksessä.
 * 1) Lue localStorage → päivitä UI heti
 * 2) Lue Firestore  → korvaa jos uudempi
 */
export async function loadPrefs() {
  _prefs = _readLocal() ?? { ...DEFAULT_PREFS };
  _notify();

  if (!_db || !_uid) return;

  try {
    const snap = await getDoc(_prefsRef());
    if (!snap.exists()) {
      // Ensimmäinen kirjautuminen: persistoi paikallinen tila
      await _writeFirestore(_prefs);
      return;
    }
    const remote = snap.data();
    const remoteTs = remote.updatedAt?.toMillis?.() ?? 0;
    const localTs  = _prefs.updatedAt ?? 0;
    if (remoteTs >= localTs) {
      _prefs = _migrate(remote);
      _writeLocal(_prefs);
      _notify();
    }
  } catch (err) {
    console.warn('[prefs] Firestore-lataus epäonnistui, käytetään paikallista:', err);
  }
}

/**
 * Päivitä yksi tai useampi kenttä.
 * Tallentaa heti localStorageen, Firestoreen 500 ms jälkeen.
 */
export function updatePrefs(partial) {
  _prefs = { ..._prefs, ...partial, updatedAt: Date.now() };
  _writeLocal(_prefs);
  _notify();
  _scheduleFirestore();
}

/** Seuraa tagia – lisää jos ei vielä listassa. */
export function followTag(tag) {
  const tags = new Set(_prefs.followedTags);
  if (tags.has(tag)) return;
  tags.add(tag);
  updatePrefs({ followedTags: [...tags] });
}

/** Lopeta tagin seuraaminen. */
export function unfollowTag(tag) {
  const tags = new Set(_prefs.followedTags);
  if (!tags.has(tag)) return;
  tags.delete(tag);
  updatePrefs({ followedTags: [...tags] });
}

/** Onko tagi seurannassa? */
export function isFollowing(tag) {
  return _prefs.followedTags.includes(tag);
}

/**
 * Lataa käyttäjän omat tiedot JSON-tiedostona (profiilisivu).
 * Sisältää preferenssit + metadatan – ei muuta käyttäjädataa.
 */
export function exportPrefsAsJson(user) {
  const payload = {
    exportedAt: new Date().toISOString(),
    user: {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email
    },
    preferences: { ..._prefs }
  };
  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `uutisseuranta-asetukset-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Rekisteröi muutoskuuntelija.
 * Kutsutaan aina kun preferenssit muuttuvat.
 * Palauttaa unsubscribe-funktion.
 */
export function onPrefsChange(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}

// ── Sisäiset apufunktiot ──────────────────────────────────────────

function _prefsRef() {
  return doc(_db, 'users', _uid, 'preferences', 'main');
}

function _readLocal() {
  try {
    const raw = localStorage.getItem(`prefs_${_uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function _writeLocal(prefs) {
  try {
    localStorage.setItem(`prefs_${_uid}`, JSON.stringify(prefs));
  } catch { /* Quota tai yksityistila */ }
}

async function _writeFirestore(prefs) {
  if (!_db || !_uid) return;
  try {
    await setDoc(_prefsRef(), {
      ...prefs,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn('[prefs] Firestore-kirjoitus epäonnistui:', err);
  }
}

function _scheduleFirestore() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => _writeFirestore(_prefs), 500);
}

function _notify() {
  _listeners.forEach(fn => fn({ ..._prefs }));
}

/** Migraatio: täytä puuttuvat kentät oletusarvoilla. */
function _migrate(remote) {
  return {
    ...DEFAULT_PREFS,
    ...remote,
    schemaVersion: SCHEMA_VERSION
  };
}
