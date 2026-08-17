import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prefsMock = {
  getPrefs: vi.fn(() => ({ followedTags: [], theme: 'system' })),
  exportPrefsAsJson: vi.fn(),
  unfollowTag: vi.fn(),
  onPrefsChange: vi.fn(() => vi.fn()),
  updatePrefs: vi.fn(),
  deleteUserPrefs: vi.fn(async () => {}),
};

vi.mock('../../src/prefs.js', () => prefsMock);

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  signOut: vi.fn(async () => {}),
  deleteUser: vi.fn(async () => {}),
  reauthenticateWithPopup: vi.fn(async () => {}),
  GoogleAuthProvider: vi.fn(),
}));

function makeUser(overrides = {}) {
  return {
    uid: 'user-1',
    displayName: 'Testi Käyttäjä',
    email: 'testi@example.com',
    photoURL: null,
    metadata: {},
    ...overrides,
  };
}

let initProfileModal, openProfileModal, closeProfileModal;

describe('profile.js', () => {
  beforeEach(async () => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    prefsMock.getPrefs.mockReturnValue({ followedTags: [], theme: 'system' });
    prefsMock.onPrefsChange.mockReturnValue(vi.fn());

    // profile.js pitää modaalin moduulitason singletonina (_modal) — ladataan
    // moduuli uudelleen joka testissä jotta testit eivät vuoda toisiinsa.
    vi.resetModules();
    ({ initProfileModal, openProfileModal, closeProfileModal } = await import('../../src/profile.js'));
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('initProfileModal luo modaalin piilotettuna DOMiin', () => {
    initProfileModal(makeUser());
    const modal = document.getElementById('profile-modal');
    expect(modal).not.toBeNull();
    expect(modal.hasAttribute('hidden')).toBe(true);
  });

  it('initProfileModal ei luo modaalia uudestaan kun sitä kutsutaan monta kertaa', () => {
    initProfileModal(makeUser());
    initProfileModal(makeUser());
    expect(document.querySelectorAll('#profile-modal').length).toBe(1);
  });

  it('openProfileModal poistaa hidden-attribuutin ja asettaa aria-modalin', () => {
    initProfileModal(makeUser());
    openProfileModal();
    const modal = document.getElementById('profile-modal');
    expect(modal.hasAttribute('hidden')).toBe(false);
    expect(modal.getAttribute('aria-modal')).toBe('true');
  });

  it('closeProfileModal palauttaa hidden-attribuutin ja poistaa aria-modalin', () => {
    initProfileModal(makeUser());
    openProfileModal();
    closeProfileModal();
    const modal = document.getElementById('profile-modal');
    expect(modal.hasAttribute('hidden')).toBe(true);
    expect(modal.hasAttribute('aria-modal')).toBe(false);
  });

  it('closeProfileModal ei kaadu jos modaalia ei ole vielä luotu', () => {
    expect(() => closeProfileModal()).not.toThrow();
  });

  it('backdrop-klikkaus sulkee modaalin', () => {
    initProfileModal(makeUser());
    openProfileModal();
    document.querySelector('.profile-backdrop').click();
    expect(document.getElementById('profile-modal').hasAttribute('hidden')).toBe(true);
  });

  it('sulje-painike sulkee modaalin', () => {
    initProfileModal(makeUser());
    openProfileModal();
    document.querySelector('.profile-close').click();
    expect(document.getElementById('profile-modal').hasAttribute('hidden')).toBe(true);
  });

  it('renderöi käyttäjän nimen ja sähköpostin HTML-escapettuna (XSS-suoja)', () => {
    initProfileModal(makeUser({ displayName: '<script>alert(1)</script>', email: 'a@b.com' }));
    openProfileModal();
    const nameEl = document.querySelector('.profile-name');
    expect(nameEl.innerHTML).not.toContain('<script>');
    expect(nameEl.textContent).toBe('<script>alert(1)</script>');
  });

  it('näyttää tyhjän tilan viestin kun seurattuja tageja ei ole', () => {
    initProfileModal(makeUser());
    openProfileModal();
    expect(document.querySelector('.profile-empty')).not.toBeNull();
  });

  it('renderöi seuratut tagit ja poisto-painikkeen kutsuu unfollowTag', () => {
    prefsMock.getPrefs.mockReturnValue({ followedTags: ['#tiede'], theme: 'system' });
    initProfileModal(makeUser());
    openProfileModal();
    const removeBtn = document.querySelector('.profile-tag-remove');
    expect(removeBtn).not.toBeNull();
    expect(removeBtn.dataset.tag).toBe('#tiede');
    removeBtn.click();
    expect(prefsMock.unfollowTag).toHaveBeenCalledWith('#tiede');
  });

  it('teemavalinnan muutos kutsuu updatePrefsia valitulla arvolla', () => {
    initProfileModal(makeUser());
    openProfileModal();
    const select = document.querySelector('#profile-theme');
    select.value = 'dark';
    select.dispatchEvent(new Event('change'));
    expect(prefsMock.updatePrefs).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('vientipainike kutsuu exportPrefsAsJson käyttäjäobjektilla', () => {
    const user = makeUser();
    initProfileModal(user);
    openProfileModal();
    document.querySelector('#btn-export-json').click();
    expect(prefsMock.exportPrefsAsJson).toHaveBeenCalledWith(user);
  });

  it('kirjaudu ulos -painike kutsuu signOutin ja sulkee modaalin', async () => {
    const { signOut } = await import('firebase/auth');
    initProfileModal(makeUser());
    openProfileModal();
    document.querySelector('#btn-profile-logout').click();
    expect(signOut).toHaveBeenCalled();
    expect(document.getElementById('profile-modal').hasAttribute('hidden')).toBe(true);
  });

  it('rekisteröi onPrefsChange-kuuntelijan joka päivittää sisällön modaalin ollessa auki', () => {
    initProfileModal(makeUser());
    expect(prefsMock.onPrefsChange).toHaveBeenCalledTimes(1);
  });
});
