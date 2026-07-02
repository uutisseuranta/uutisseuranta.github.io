/**
 * prefs.js – Käyttäjäpreferenssien hallinta
 *
 * Persistointimalli: Hybrid localStorage + Firestore
 * ───────────────────────────────────────────────────
 * localStorage  → nopea paikallinen välimuisti, UI piirtyy heti ilman verkkoviivettä
 * Firestore     → kanoninen lähde kirjautuneille käyttäjille, synkronoi asetukset kaikille laitteille
 *
 * PWA-offline-tuki (edelleen, PWA-offline-tuella):
 *   Firestore IndexedDB-persistointi (enableIndexedDbPersistence) mahdollistaa sen,
 *   että kirjautunut käyttäjä voi lukea ja kirjoittaa preferenssejä myös offline-tilassa.
 *   Service Worker (SW) huolehtii staattisten resurssien välimuistista; tämä moduuli
 *   huolehtii datan offline-pysyvyydestä. Yhdessä ne muodostavat täyden PWA-offline-kokemuksen.
 *
 * Kirjautumaton käyttäjä: vain localStorage (avain "prefs_anonymous")
 * Kirjautunut käyttäjä:   localStorage + Firestore molemmat
 *
 * Tietomalli (Firestore): /users/{uid}/preferences/main
 * {
 *   followedTags  : string[],            // seuratut aihetunnisteet
 *   theme         : 'light'|'dark'|'system',
 *   updatedAt     : Timestamp,           // serverTimestamp() kirjoitushetkellä
 *   schemaVersion : number               // migraatioiden versionhallinta
 * }
 *
 * Kirjoituslogiikka:
 *   1. Kirjoita heti localStorage:hen  → nopea feedback, toimii offline
 *   2. Debounce 500 ms → kirjoita Firestoreen (vain kirjautunut käyttäjä)
 *
 * Lukuprioriteetti käynnistyksessä:
 *   1. Lue localStorage (synkroninen) → UI piirtyy heti
 *   2. Lue Firestore (asynkroninen)   → korvaa jos palvelimen tila on uudempi
 */

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  enableIndexedDbPersistence,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export const SCHEMA_VERSION = 1;

const DEFAULT_PREFS = {
  followedTags: [],
  theme: 'system',
  updatedAt: null,
  schemaVersion: SCHEMA_VERSION,
};

let _db = null;
let _uid = null;
let _debounceTimer = null;
let _prefs = { ...DEFAULT_PREFS };
let _listeners = [];

// ── Julkinen API ─────────────────────────────────────────────────

/**
 * Alusta moduuli.
 * Kutsutaan aina kun autentikointitila muuttuu (kirjautuminen / uloskirjautuminen).
 *
 * @param {import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js').FirebaseApp} app - Firebase-sovellus
 * @param {string|null} uid - Kirjautuneen käyttäjän uid, tai null
 */
export function initPrefs(app, uid) {
  _uid = uid;
  _prefs = { ...DEFAULT_PREFS };

  if (uid) {
    // Otetaan Firestore offline-persistointi käyttöön kirjautuneelle käyttäjälle.
    // Tämä on myös PWA-tuen edellytys: enableIndexedDbPersistence tallentaa
    // Firestore-datan selaimen IndexedDB:hen, jolloin preferenssit ovat luettavissa
    // ja kirjoitettavissa myös silloin kun verkkoyhteyttä ei ole (esim. SW-cache-tila).
    // Kutsu tehdään heti autentikoinnin jälkeen — ennen ensimmäistäkään getDoc/setDoc-kutsua.
    _db = getFirestore(app);
    enableIndexedDbPersistence(_db).catch((err) => {
      if (err.code === 'failed-precondition') {
        // Useampi välilehti auki — offline toimii vain yhdellä
        console.warn('[prefs] Firestore-offline ei käytössä (useampi välilehti auki).');
      } else if (err.code === 'unimplemented') {
        // Selain ei tue IndexedDB:tä
        console.warn('[prefs] Selain ei tue Firestore-offline-tallennusta.');
      }
    });
  } else {
    // Kirjautumaton käyttäjä: vain localStorage, ei Firestorea
    _db = null;
  }
}

/** Palauttaa nykyiset preferenssit (synkroninen). */
export function getPrefs() {
  return { ..._prefs };
}

/**
 * Lataa preferenssit käynnistyksessä tai kirjautumistilan muuttuessa.
 * 1) Lue localStorage → päivitä UI heti
 * 2) Lue Firestore (vain kirjautunut) → korvaa jos uudempi
 */
export async function loadPrefs() {
  _prefs = _readLocal() ?? { ...DEFAULT_PREFS };
  _notify();

  // Kirjautumaton käyttäjä: ei Firestore-latausta
  if (!_db || !_uid) return;

  try {
    const snap = await getDoc(_prefsRef());
    if (!snap.exists()) {
      // Ensimmäinen kirjautuminen tällä tilillä: tallennetaan paikallinen tila Firestoreen
      await _writeFirestore(_prefs);
      return;
    }
    const remote = snap.data();
    // Vertaillaan aikaleimoja: käytetään uudempaa
    const remoteTs = remote.updatedAt?.toMillis?.() ?? 0;
    const localTs = _prefs.updatedAt ?? 0;
    if (remoteTs >= localTs) {
      _prefs = _migrate(remote);
      _writeLocal(_prefs);
      _notify();
    }
  } catch (err) {
    // Verkkovirhe tms. — paikallinen tila riittää
    console.warn('[prefs] Firestore-lataus epäonnistui, käytetään paikallista:', err);
  }
}

/**
 * Päivitä yksi tai useampi kenttä preferensseissä.
 * Tallentaa välittömästi localStorage:hen ja debounce-ajastimella Firestoreen.
 *
 * @param {Partial<typeof DEFAULT_PREFS>} partial - Päivitettävät kentät
 */
export function updatePrefs(partial) {
  _prefs = { ..._prefs, ...partial, updatedAt: Date.now() };
  _writeLocal(_prefs);
  _notify();
  _scheduleFirestore();
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

/** Viittaus Firestore-dokumenttiin kirjautuneen käyttäjän preferensseille. */
function _prefsRef() {
  return doc(_db, 'users', _uid, 'preferences', 'main');
}

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

/**
 * Kirjoittaa preferenssit Firestoreen.
 * Käytetään merge:true jotta rinnakkaiset kirjoitukset eri kentille eivät ylikirjoita toisiaan.
 */
async function _writeFirestore(prefs) {
  if (!_db || !_uid) return;
  try {
    await setDoc(_prefsRef(), {
      ...prefs,
      updatedAt: serverTimestamp(), // Palvelimen aikaleima — luotettavampi kuin Date.now()
    }, { merge: true });
  } catch (err) {
    console.warn('[prefs] Firestore-kirjoitus epäonnistui:', err);
  }
}

/**
 * Aikatauluttaa Firestore-kirjoituksen 500 ms viiveellä (debounce).
 *
 * Tarkoitus — räpyttely (rapid successive clicks / päivitykset):
 *   Käyttäjä voi klikata Follow/Unfollow-nappia tai vaihtaa teemaa useita kertoja
 *   peräkkäin lyhyen ajan sisällä. Ilman debouncea jokainen updatePrefs()-kutsu
 *   laukaisisi oman Firestore-kirjoituksen → turhia kirjoituksia, quota-kulutusta
 *   ja mahdollisia race conditioneja.
 *
 *   Debounce-logiikka: clearTimeout nollaa edellisen ajastimen aina uuden päivityksen
 *   saapuessa. Firestore-kirjoitus tapahtuu vasta kun päivityksiä ei tule 500 ms:ään.
 *   localStorage kirjoitetaan silti välittömästi jokaisella päivityksellä (offline-tuki).
 */
function _scheduleFirestore() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => _writeFirestore(_prefs), 500);
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
 * @param {object} stored - localStorage:sta tai Firestoresta luettu raakaobjekti
 * @returns {typeof DEFAULT_PREFS}
 */
function _migrate(stored) {
  return {
    ...DEFAULT_PREFS,
    ...stored,
    schemaVersion: SCHEMA_VERSION,
  };
}
