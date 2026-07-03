/**
 * prefs.js – Käyttäjäpreferenssien hallinta
 *
 * Persistointimalli: Hybrid localStorage + Firestore
 * ───────────────────────────────────────────────────
 * localStorage  → nopea paikallinen välimuisti, UI piirtyy heti ilman verkkoviivettä
 * Firestore     → kanoninen lähde kirjautuneille käyttäjille, synkronoi asetukset kaikille laitteille
 *
 * PWA-offline-tuki:
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

// Tietomallin versio — kasvata kun DEFAULT_PREFS:iin lisätään kenttiä.
// _migrate() käyttää tätä arvoa taaksepäin yhteensopivuuden varmistamiseksi.
export const SCHEMA_VERSION = 1;

/** Oletusarvoinen preferenssirakenne. Toimii myös migraation pohjana. */
const DEFAULT_PREFS = {
  followedTags: [],
  theme: 'system',
  updatedAt: null,
  schemaVersion: SCHEMA_VERSION,
};

// ── Moduulin tila ─────────────────────────────────────────────────
// Kaikki muuttujat ovat moduulin yksityisiä — ulkopuolelta käytetään
// vain alla olevaa julkista API:ta.

/** Firestore-instanssi. null = kirjautumaton tai Firestore ei käytössä. */
let _db = null;

/** Kirjautuneen käyttäjän uid. null = anonyymi käyttäjä. */
let _uid = null;

/** Debounce-ajastin Firestore-kirjoituksille. Ks. _scheduleFirestore(). */
let _debounceTimer = null;

/** Muistissa olevat preferenssit — aina ajantasainen kopio. */
let _prefs = { ...DEFAULT_PREFS };

/** Rekisteröidyt muutoskuuntelijat. Ks. onPrefsChange(). */
let _listeners = [];

// ── Julkinen API ─────────────────────────────────────────────────

/**
 * Alusta moduuli.
 * Kutsutaan aina kun autentikointitila muuttuu (kirjautuminen / uloskirjautuminen).
 * Nollaa muistissa olevan tilan ja asettaa Firestore-instanssin kirjautuneelle käyttäjälle.
 *
 * Huom. _listeners nollataan myös — estää muistivuodon tilanteessa jossa
 * initPrefs() kutsutaan useamman kerran (auth-tilan muutos). Kutsuja vastaa
 * rekisteröimisestä uudelleen tarvittaessa initPrefs()-kutsun jälkeen.
 *
 * @param {import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js').FirebaseApp} app - Firebase-sovellus
 * @param {string|null} uid - Kirjautuneen käyttäjän uid, tai null
 */
export function initPrefs(app, uid) {
  _uid = uid;
  _prefs = { ...DEFAULT_PREFS };
  _listeners = [];

  if (uid) {
    // Otetaan Firestore offline-persistointi käyttöön kirjautuneelle käyttäjälle.
    // enableIndexedDbPersistence tallentaa Firestore-datan selaimen IndexedDB:hen,
    // jolloin preferenssit ovat luettavissa ja kirjoitettavissa myös offline-tilassa.
    // Kutsu tehdään heti autentikoinnin jälkeen — ennen ensimmäistäkään getDoc/setDoc-kutsua.
    _db = getFirestore(app);
    enableIndexedDbPersistence(_db).catch((err) => {
      if (err.code === 'failed-precondition') {
        // Useampi välilehti auki samanaikaisesti — offline-persistointi toimii vain yhdellä.
        console.warn('[prefs] Firestore-offline ei käytössä (useampi välilehti auki).');
      } else if (err.code === 'unimplemented') {
        // Selain (esim. vanha Safari) ei tue IndexedDB:tä.
        console.warn('[prefs] Selain ei tue Firestore-offline-tallennusta.');
      }
    });
  } else {
    // Kirjautumaton käyttäjä: vain localStorage käytössä, ei Firestore-yhteyttä.
    _db = null;
  }
}

/** Palauttaa nykyiset preferenssit (synkroninen, ei sivuvaikutuksia). */
export function getPrefs() {
  return { ..._prefs };
}

/**
 * Lataa preferenssit käynnistyksessä tai kirjautumistilan muuttuessa.
 * 1) Lue localStorage → päivitä UI heti
 * 2) Lue Firestore (vain kirjautunut) → korvaa jos palvelimen versio on uudempi
 *
 * Virhe Firestore-haussa ei kaada sovellusta — paikalliset tiedot riittävät.
 */
export async function loadPrefs() {
  _prefs = _readLocal() ?? { ...DEFAULT_PREFS };
  _notify();

  // Kirjautumaton käyttäjä tai Firestore ei alustettu: ei Firestore-latausta.
  if (!_db || !_uid) return;

  try {
    const snap = await getDoc(_prefsRef());
    if (!snap.exists()) {
      // Ensimmäinen kirjautuminen tällä tilillä: tallennetaan paikallinen tila Firestoreen.
      await _writeFirestore(_prefs);
      return;
    }
    const remote = snap.data();
    // Vertaillaan aikaleimoja millisekunteina — käytetään uudempaa versiota.
    const remoteTs = remote.updatedAt?.toMillis?.() ?? 0;
    const localTs = _prefs.updatedAt ?? 0;
    if (remoteTs >= localTs) {
      _prefs = _migrate(remote);
      _writeLocal(_prefs);
      _notify();
    }
  } catch (err) {
    // Verkkovirhe, autentikointiongelma tms. — paikallinen tila riittää.
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

/** Poistaa tagin seurantalistasta. Idempotent – ei tee mitään jos ei seurannassa. */
export function unfollowTag(tag) {
  const tags = new Set(_prefs.followedTags);
  if (!tags.has(tag)) return;
  tags.delete(tag);
  updatePrefs({ followedTags: [...tags] });
}

/**
 * Rekisteröi muutoskuuntelija.
 * Kutsutaan heti rekisteröinnin yhteydessä nykyisillä preferensseillä,
 * ja sen jälkeen aina kun preferenssit muuttuvat.
 *
 * Palauttaa unsubscribe-funktion jolla kuuntelija poistetaan.
 *
 * @param {function(typeof DEFAULT_PREFS): void} fn
 * @returns {function(): void}
 */
export function onPrefsChange(fn) {
  _listeners.push(fn);
  fn({ ..._prefs }); // kutsu heti nykyisillä arvoilla
  return () => { _listeners = _listeners.filter((l) => l !== fn); };
}

// ── Yksityiset apufunktiot ────────────────────────────────────────

/**
 * Palauttaa Firestore DocumentReference preferenssidokumentille.
 *
 * Polku: /users/{uid}/preferences/main
 *
 * Miksi alakokoelma 'preferences' eikä suoraan /users/{uid}/main ?
 *   Alakokoelma ryhmittelee käyttäjäkohtaisen datan tyypeittäin
 *   (/users/{uid}/preferences/, /users/{uid}/sessions/ jne.) ilman
 *   nimeämiskonflikteja. Rakenne skaalautuu lisäämättä kenttiä
 *   pääkäyttäjädokumenttiin.
 *
 * Miksi Security Rulesissa {document=**} eikä täsmäpolku ?
 *   firestore.rules kattaa koko /users/{uid}/{document=**} -haaran
 *   rekursiivisella wildcardilla. Tämä mahdollistaa uudet alakokoelmat
 *   (esim. /users/{uid}/notifications/) ilman rules-muutosta. Katso
 *   firestore.rules revisit-kriteeri jos rakenteen laajuus kasvaa.
 */
function _prefsRef() {
  return doc(_db, 'users', _uid, 'preferences', 'main');
}

/** Lukee preferenssit localStorage:sta. null jos ei löydy tai JSON virheellinen. */
function _readLocal() {
  const key = _uid ? `prefs_${_uid}` : 'prefs_anonymous';
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Kirjoittaa preferenssit localStorage:hen. */
function _writeLocal(prefs) {
  const key = _uid ? `prefs_${_uid}` : 'prefs_anonymous';
  try {
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch (err) {
    console.warn('[prefs] localStorage-kirjoitus epäonnistui:', err);
  }
}

/**
 * Kirjoittaa preferenssit Firestoreen.
 * Käytetään suoraan vain loadPrefs():ssa ensimmäistä kirjautumista varten.
 * Muuten käytetään _scheduleFirestore():a debounce-kirjoituksiin.
 */
async function _writeFirestore(prefs) {
  if (!_db || !_uid) return;
  try {
    await setDoc(_prefsRef(), {
      ...prefs,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[prefs] Firestore-kirjoitus epäonnistui:', err);
  }
}

/**
 * Ajastaa Firestore-kirjoituksen 500 ms viiveellä.
 * Peruuttaa edellisen ajastimen jos updatePrefs() kutsutaan uudelleen
 * ennen kuin ajastin laukeaa — estää turhat kirjoitukset nopeissa muutoksissa.
 */
function _scheduleFirestore() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => _writeFirestore(_prefs), 500);
}

/** Kutsuu kaikki rekisteröidyt muutoskuuntelijat kopiolla nykyisistä preferensseistä. */
function _notify() {
  const snapshot = { ..._prefs };
  _listeners.forEach((fn) => fn(snapshot));
}

/**
 * Migroi vanhan schemaVersion:n mukaisen preferenssidatan nykymalliin.
 * Palauttaa aina täydellisen DEFAULT_PREFS-rakenteen täydennettynä remote-datalla.
 *
 * @param {object} remote - Firestore-dokumentin data
 * @returns {typeof DEFAULT_PREFS}
 */
function _migrate(remote) {
  // Versio 1 → 1: ei muutoksia, yhdistetään vain oletusarvot puuttuvien kenttien täydentämiseksi.
  return { ...DEFAULT_PREFS, ...remote, schemaVersion: SCHEMA_VERSION };
}
