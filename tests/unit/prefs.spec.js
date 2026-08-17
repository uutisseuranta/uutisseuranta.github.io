import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// prefs.js puhuu Firestoreen `firebase/firestore`-moduulin kautta — mockataan se,
// jotta testit eivät tarvitse oikeaa Firebase-yhteyttä.
const firestoreDocs = new Map();

vi.mock('firebase/firestore', () => ({
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  memoryLocalCache: vi.fn(() => ({})),
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn((_db, ...pathSegments) => ({ path: pathSegments.join('/') })),
  getDoc: vi.fn(async (ref) => {
    const data = firestoreDocs.get(ref.path);
    return { exists: () => data !== undefined, data: () => data };
  }),
  setDoc: vi.fn(async (ref, data) => {
    firestoreDocs.set(ref.path, data);
  }),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  deleteDoc: vi.fn(async (ref) => {
    firestoreDocs.delete(ref.path);
  }),
}));

const {
  initPrefs,
  loadPrefs,
  getPrefs,
  updatePrefs,
  followTag,
  unfollowTag,
  isFollowing,
  onPrefsChange,
  exportPrefsAsJson,
  deleteUserPrefs,
  SCHEMA_VERSION,
} = await import('../../src/prefs.js');

describe('prefs.js', () => {
  beforeEach(() => {
    localStorage.clear();
    firestoreDocs.clear();
    initPrefs({}, null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('anonyymi käyttäjä (uid null)', () => {
    it('getPrefs palauttaa oletusarvot ennen loadPrefs()-kutsua', () => {
      const prefs = getPrefs();
      expect(prefs.followedTags).toEqual([]);
      expect(prefs.theme).toBe('system');
      expect(prefs.schemaVersion).toBe(SCHEMA_VERSION);
    });

    it('loadPrefs lukee aiemmin tallennetun tilan localStoragesta avaimella prefs_anonymous', async () => {
      localStorage.setItem(
        'prefs_anonymous',
        JSON.stringify({ followedTags: ['#tiede'], theme: 'dark', schemaVersion: 1 })
      );
      await loadPrefs();
      const prefs = getPrefs();
      expect(prefs.followedTags).toEqual(['#tiede']);
      expect(prefs.theme).toBe('dark');
    });

    it('loadPrefs ei kaadu virheelliseen JSONiin localStoragessa, palaa oletusarvoihin', async () => {
      localStorage.setItem('prefs_anonymous', '{not-valid-json');
      await loadPrefs();
      expect(getPrefs().followedTags).toEqual([]);
    });

    it('loadPrefs ei tee Firestore-kutsua kirjautumattomalle käyttäjälle', async () => {
      const { getDoc } = await import('firebase/firestore');
      await loadPrefs();
      expect(getDoc).not.toHaveBeenCalled();
    });
  });

  describe('migraatio (_migrate)', () => {
    it('täydentää puuttuvat kentät ja päivittää schemaVersionin nykyiseksi', async () => {
      localStorage.setItem(
        'prefs_anonymous',
        JSON.stringify({ followedTags: ['#politiikka'], schemaVersion: 1 })
      );
      await loadPrefs();
      const prefs = getPrefs();
      expect(prefs.schemaVersion).toBe(SCHEMA_VERSION);
      expect(prefs.theme).toBe('system');
      expect(prefs.currentView).toBe('home');
      expect(prefs.followedTags).toEqual(['#politiikka']);
    });
  });

  describe('tagien seuranta', () => {
    it('followTag lisää tagin ja on idempotentti', () => {
      followTag('#teknologia');
      followTag('#teknologia');
      expect(getPrefs().followedTags).toEqual(['#teknologia']);
      expect(isFollowing('#teknologia')).toBe(true);
    });

    it('unfollowTag poistaa tagin ja on idempotentti kun tagia ei seurata', () => {
      followTag('#teknologia');
      unfollowTag('#teknologia');
      unfollowTag('#teknologia');
      expect(getPrefs().followedTags).toEqual([]);
      expect(isFollowing('#teknologia')).toBe(false);
    });

    it('isFollowing palauttaa false tagille jota ei koskaan seurattu', () => {
      expect(isFollowing('#ei-olemassa')).toBe(false);
    });
  });

  describe('updatePrefs', () => {
    it('kirjoittaa muutokset localStorageen välittömästi', () => {
      updatePrefs({ theme: 'dark' });
      const stored = JSON.parse(localStorage.getItem('prefs_anonymous'));
      expect(stored.theme).toBe('dark');
    });

    it('asettaa updatedAt-aikaleiman', () => {
      const before = Date.now();
      updatePrefs({ theme: 'dark' });
      expect(getPrefs().updatedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('onPrefsChange', () => {
    it('kutsuu kuuntelijaa heti rekisteröinnin yhteydessä nykyisillä arvoilla', () => {
      const listener = vi.fn();
      onPrefsChange(listener);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ theme: 'system' }));
    });

    it('kutsuu kuuntelijaa uudelleen kun preferenssit muuttuvat', () => {
      const listener = vi.fn();
      onPrefsChange(listener);
      updatePrefs({ theme: 'dark' });
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'dark' }));
    });

    it('unsubscribe-funktio lopettaa kuuntelun', () => {
      const listener = vi.fn();
      const unsubscribe = onPrefsChange(listener);
      unsubscribe();
      updatePrefs({ theme: 'dark' });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('kirjautunut käyttäjä (Firestore-synkka)', () => {
    it('loadPrefs tallentaa paikallisen tilan Firestoreen ensimmäisellä kirjautumisella', async () => {
      initPrefs({}, 'user-1');
      await loadPrefs();
      const { setDoc } = await import('firebase/firestore');
      expect(setDoc).toHaveBeenCalledTimes(1);
    });

    it('loadPrefs korvaa paikallisen tilan uudemmalla Firestore-tilalla', async () => {
      initPrefs({}, 'user-1');
      localStorage.setItem(
        'prefs_user-1',
        JSON.stringify({ theme: 'light', schemaVersion: SCHEMA_VERSION, updatedAt: 1000 })
      );
      firestoreDocs.set('users/user-1/preferences/main', {
        theme: 'dark',
        followedTags: [],
        schemaVersion: SCHEMA_VERSION,
        updatedAt: { toMillis: () => 2000 },
      });
      await loadPrefs();
      expect(getPrefs().theme).toBe('dark');
    });

    it('loadPrefs säilyttää paikallisen tilan jos se on uudempi kuin Firestore', async () => {
      initPrefs({}, 'user-1');
      localStorage.setItem(
        'prefs_user-1',
        JSON.stringify({ theme: 'light', schemaVersion: SCHEMA_VERSION, updatedAt: 5000 })
      );
      firestoreDocs.set('users/user-1/preferences/main', {
        theme: 'dark',
        followedTags: [],
        schemaVersion: SCHEMA_VERSION,
        updatedAt: { toMillis: () => 2000 },
      });
      await loadPrefs();
      expect(getPrefs().theme).toBe('light');
    });

    it('loadPrefs ei kaadu jos Firestore-haku epäonnistuu, paikallinen tila säilyy', async () => {
      initPrefs({}, 'user-1');
      localStorage.setItem(
        'prefs_user-1',
        JSON.stringify({ theme: 'light', schemaVersion: SCHEMA_VERSION })
      );
      const { getDoc } = await import('firebase/firestore');
      getDoc.mockRejectedValueOnce(new Error('network error'));
      await expect(loadPrefs()).resolves.not.toThrow();
      expect(getPrefs().theme).toBe('light');
    });

    it('deleteUserPrefs poistaa Firestore-dokumentin ja palauttaa oletusarvot', async () => {
      initPrefs({}, 'user-1');
      firestoreDocs.set('users/user-1/preferences/main', { theme: 'dark' });
      await deleteUserPrefs();
      expect(firestoreDocs.has('users/user-1/preferences/main')).toBe(false);
      expect(getPrefs()).toEqual(
        expect.objectContaining({ theme: 'system', followedTags: [] })
      );
    });
  });

  describe('exportPrefsAsJson', () => {
    it('luo ladattavan JSON-tiedoston käyttäjän tiedoilla ja preferensseillä', () => {
      const createObjectURL = vi.fn(() => 'blob:mock-url');
      const revokeObjectURL = vi.fn();
      vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      followTag('#tiede');
      exportPrefsAsJson({ uid: 'user-1', displayName: 'Testi', email: 'testi@example.com' });

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const blobArg = createObjectURL.mock.calls[0][0];
      expect(blobArg.type).toBe('application/json');
      expect(clickSpy).toHaveBeenCalledTimes(1);

      clickSpy.mockRestore();
      vi.unstubAllGlobals();
    });
  });
});
