import { test, expect } from '@playwright/test';

test.describe('Uutisseuranta Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Disable Service Worker registration and set testing flag in E2E tests
    await page.addInitScript(() => {
      window.__DISABLE_SERVICE_WORKER__ = true;
      window.__TESTING__ = true;
    });

    // Navigate to establishing the correct origin
    const targetUrl = process.env.EFFECTIVE_URL || 'https://uutisseuranta.net';
    console.log(`Establishing origin on ${targetUrl}...`);
    await page.goto('/');

    // Safely clear localStorage and IndexedDB with the correct origin context
    await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      if (window.indexedDB && window.indexedDB.databases) {
        const dbs = await window.indexedDB.databases();
        for (const db of dbs) {
          await new Promise((resolve) => {
            const req = window.indexedDB.deleteDatabase(db.name);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          });
        }
      }
    });

    // Reload page with a clean slate
    await page.reload();

    // Log console errors to detect CORS or CSP violations
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`CONSOLE ERROR: ${msg.text()}`);
      }
    });
  });

  test('UP-2: should load the news feed without errors', async ({ page }) => {
    // Mock the backend API response to provide a mock article
    await page.route('**/ap/outbox*', async route => {
      const json = {
        "@context": "https://www.w3.org/ns/activitystreams",
        "type": "OrderedCollection",
        "totalItems": 1,
        "orderedItems": [
          {
            "id": "https://activitystreams.uutisseuranta.net/ap/outbox/article-1",
            "type": "Create",
            "actor": "https://uutisseuranta.net/sources/yle",
            "object": {
              "id": "https://uutisseuranta.net/articles/1",
              "type": "Article",
              "name": "Testiuutinen",
              "summary": "Tämä on testiuutisen lyhyt kuvaus E2E-testausta varten.",
              "url": "https://yle.fi/uutiset/1",
              "published": "2026-07-27T00:00:00Z",
              "tag": [
                { "type": "Hashtag", "name": "#politiikka" }
              ]
            }
          }
        ]
      };
      await route.fulfill({ json });
    });

    // Navigate to the news view
    const newsLink = page.locator('#nav-link-news');
    await expect(newsLink).toBeVisible();
    await newsLink.click();

    // Wait for the articles container to stop loading
    const feedContainer = page.locator('#feed-grid');
    await expect(feedContainer).toBeVisible();
    
    // Assert that we have actual article cards loaded (not the failed state)
    const articles = page.locator('.feed-item');
    await expect(articles.first()).toBeVisible({ timeout: 15000 });
    
    // Varmistetaan ettei sivulla näy virheilmoitusta
    const errorBanner = page.locator('text=Uutisvirran lataus epäonnistui');
    await expect(errorBanner).not.toBeVisible();
  });

  test('UP-3: should toggle theme between light and dark mode', async ({ page }) => {
    const html = page.locator('html');
    
    // Find theme toggle button strictly by data-theme-toggle attribute
    const themeBtn = page.locator('[data-theme-toggle]');
    await expect(themeBtn).toBeVisible();
    
    const initialTheme = await html.getAttribute('data-theme') || 'dark';
    await themeBtn.click();
    
    const newTheme = await html.getAttribute('data-theme');
    expect(newTheme).not.toBe(initialTheme);
  });

  test('UP-4: should open login modal on button click', async ({ page }) => {
    // Click Kirjaudu button strictly by button ID
    const loginBtn = page.locator('#btn-login');
    await expect(loginBtn).toBeVisible();
    await loginBtn.click();
    
    // Assert login modal/overlay is visible by ID
    const loginModal = page.locator('#modal-login');
    await expect(loginModal).toBeVisible();
  });

  test('UP-5: should successfully login and load the news feed when authenticated', async ({ page }) => {
    // Mock the backend outbox response for test speed and isolation
    await page.route('**/ap/outbox*', async route => {
      const json = {
        "@context": "https://www.w3.org/ns/activitystreams",
        "type": "OrderedCollection",
        "totalItems": 1,
        "orderedItems": [
          {
            "id": "https://activitystreams.uutisseuranta.net/ap/outbox/article-1",
            "type": "Create",
            "actor": "https://uutisseuranta.net/sources/yle",
            "object": {
              "id": "https://uutisseuranta.net/articles/1",
              "type": "Article",
              "name": "Testiuutinen",
              "summary": "Tämä on testiuutisen lyhyt kuvaus E2E-testausta varten.",
              "url": "https://yle.fi/uutiset/1",
              "published": "2026-07-27T00:00:00Z",
              "tag": [
                { "type": "Hashtag", "name": "#politiikka" }
              ]
            }
          }
        ]
      };
      await route.fulfill({ json });
    });

    // Google-kirjautumisikkuna (OAuth popup) estää automaattiset testit (Googlen bot-suojaus estää automaatiot).
    // Tätä varten käytetään Firebase Auth Email/Password -kirjautumista testitunnukselle,
    // mikä ohittaa popupit ja on 100 % vakaa. Huom: Vaatii että Email/Password-kirjautumismenetelmä
    // on otettu käyttöön Firebase Consolessa uutisseuranta-projektille.
    // Käytetään mock-tunnusta, jotta testit ajetaan deterministisesti ilman riippuvuutta ulkoisista Firebase-avaimista.
    await page.evaluate(async () => {
      await window.signInForTest('mockuser@test.com', 'mockpassword');
    });

    // Odotetaan, että profiili-painike tulee näkyviin pääsivulla (kertoo onnistuneesta kirjautumisesta)
    const profileBtn = page.locator('#btn-profile');
    await expect(profileBtn).toBeVisible({ timeout: 15000 });

    // Navigoidaan uutisvirtaan
    const newsLink = page.locator('#nav-link-news');
    await expect(newsLink).toBeVisible();
    await newsLink.click();

    // Varmistetaan että uutisvirta latautuu
    const feedGrid = page.locator('#feed-grid');
    await expect(feedGrid).toBeVisible();

    // Varmistetaan ettei uutisvirran latausvirhe-banneria näy
    const errorBanner = page.locator('text=Uutisvirran lataus epäonnistui');
    await expect(errorBanner).not.toBeVisible();
  });

  test('UP-5-regression: should not send Authorization header to outbox when authenticated', async ({ page }) => {
    // Intercept /ap/outbox calls and check headers
    let authHeaderFound = false;
    await page.route('**/ap/outbox*', async route => {
      const headers = route.request().headers();
      if (headers['authorization']) {
        authHeaderFound = true;
      }
      const json = {
        "@context": "https://www.w3.org/ns/activitystreams",
        "type": "OrderedCollection",
        "totalItems": 1,
        "orderedItems": [
          {
            "id": "https://activitystreams.uutisseuranta.net/ap/outbox/article-1",
            "type": "Create",
            "actor": "https://uutisseuranta.net/sources/yle",
            "object": {
              "id": "https://uutisseuranta.net/articles/1",
              "type": "Article",
              "name": "Testiuutinen",
              "summary": "Tämä on testiuutisen lyhyt kuvaus E2E-testausta varten.",
              "url": "https://yle.fi/uutiset/1",
              "published": "2026-07-27T00:00:00Z",
              "tag": [
                { "type": "Hashtag", "name": "#politiikka" }
              ]
            }
          }
        ]
      };
      await route.fulfill({ json });
    });

    await page.evaluate(async () => {
      await window.signInForTest('mockuser@test.com', 'mockpassword');
    });

    const profileBtn = page.locator('#btn-profile');
    await expect(profileBtn).toBeVisible({ timeout: 15000 });

    const newsLink = page.locator('#nav-link-news');
    await expect(newsLink).toBeVisible();
    await newsLink.click();

    const feedGrid = page.locator('#feed-grid');
    await expect(feedGrid).toBeVisible();

    const articles = page.locator('.feed-item');
    await expect(articles.first()).toBeVisible({ timeout: 15000 });

    // Assert that the Authorization header was NOT sent to outbox
    expect(authHeaderFound).toBe(false);
  });

  test('UP-6: should successfully delete profile and clean up local data', async ({ page }) => {
    // Mock the backend API response to avoid actual fetch errors
    await page.route('**/ap/outbox*', async route => {
      const json = {
        "@context": "https://www.w3.org/ns/activitystreams",
        "type": "OrderedCollection",
        "totalItems": 1,
        "orderedItems": [
          {
            "id": "https://activitystreams.uutisseuranta.net/ap/outbox/article-1",
            "type": "Create",
            "actor": "https://uutisseuranta.net/sources/yle",
            "object": {
              "id": "https://uutisseuranta.net/articles/1",
              "type": "Article",
              "name": "Testiuutinen",
              "summary": "Tämä on testiuutisen lyhyt kuvaus E2E-testausta varten.",
              "url": "https://yle.fi/uutiset/1",
              "published": "2026-07-27T00:00:00Z"
            }
          }
        ]
      };
      await route.fulfill({ json });
    });

    // Sign in with the mock test user
    await page.evaluate(async () => {
      await window.signInForTest('mockuser@test.com', 'mockpassword');
      // Set some dummy local storage data to verify cleanup
      localStorage.setItem('reaction_mock-uid-123_test', 'Like');
      localStorage.setItem('prefs_mock-uid-123', '{"tags":[]}');
    });

    // Wait for the auth callback to complete and UI to update
    const profileBtn = page.locator('#btn-profile');
    await expect(profileBtn).toBeVisible({ timeout: 15000 });
    await profileBtn.dispatchEvent('click');

    // Verify profile modal is open
    const profileModal = page.locator('#profile-modal');
    await expect(profileModal).toBeVisible();

    // Click 'Poista tili' button
    const deleteBtn = page.locator('#btn-delete-account');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Click 'Kyllä' on the confirm dialog
    const confirmYesBtn = page.locator('#confirm-yes-btn');
    await expect(confirmYesBtn).toBeVisible();
    await confirmYesBtn.click();

    // Verify toast notification is displayed
    const toast = page.locator('.pwa-toast');
    await expect(toast).toContainText('Tili ja kaikki asetuksesi on poistettu onnistuneesti');

    // Wait for reload and verify that user data is cleaned up from localStorage
    await page.waitForFunction(() => {
      return localStorage.getItem('reaction_mock-uid-123_test') === null;
    });

    // Confirm that profile UIs are reset/hidden
    const loginBtn = page.locator('#btn-login');
    await expect(loginBtn).toBeVisible();
  });

  test('UP-8: should render real articles in the stream without mocks', async ({ page }) => {
    // Navigate to the news view
    const newsLink = page.locator('#nav-link-news');
    await expect(newsLink).toBeVisible();
    await newsLink.click();

    // Wait for the articles container to stop loading
    const feedGrid = page.locator('#feed-grid');
    await expect(feedGrid).toBeVisible();
    
    // Assert that we have either actual article cards loaded or the empty state message
    const articles = page.locator('.feed-item');
    const emptyState = page.locator('.profile-empty');
    await expect(articles.first().or(emptyState)).toBeVisible({ timeout: 20000 });
  });

  const testUserEmail = process.env.TEST_USER_EMAIL;
  const testUserPassword = process.env.TEST_USER_PASSWORD;

  if (testUserEmail && testUserPassword) {
    test.describe('Real Firebase Auth Integration Tests', () => {
      test.describe.configure({ mode: 'serial' });

      test('UP-7a: should login with real test credentials and delete the profile', async ({ page }) => {
        // Mock the backend API response to avoid actual fetch errors
        await page.route('**/ap/outbox*', async route => {
          await route.fulfill({ json: { "@context": "https://www.w3.org/ns/activitystreams", "type": "OrderedCollection", "totalItems": 0, "orderedItems": [] } });
        });

        // Try to sign in and delete the user
        const loginError = await page.evaluate(async ({ email, password }) => {
          try {
            await window.signInForTest(email, password);
            return null;
          } catch (err) {
            return err.code;
          }
        }, { email: testUserEmail, password: testUserPassword });

        if (loginError === 'auth/user-not-found') {
          console.log("User does not exist, skipping deletion step.");
          return;
        } else if (loginError && (loginError.includes('api-key-not-valid') || loginError.includes('invalid-api-key') || loginError.includes('api-key'))) {
          console.warn("Firebase API key is not valid or missing. Skipping real integration test.");
          return;
        } else if (loginError) {
          throw new Error(`Login failed with error: ${loginError}`);
        }

        // Wait for the auth callback to complete and UI to update
        const profileBtn = page.locator('#btn-profile');
        await expect(profileBtn).toBeVisible({ timeout: 15000 });
        await profileBtn.dispatchEvent('click');

        // Click 'Poista tili' button
        const deleteBtn = page.locator('#btn-delete-account');
        await expect(deleteBtn).toBeVisible();
        await deleteBtn.click();

        // Click 'Kyllä' on the confirm dialog
        const confirmYesBtn = page.locator('#confirm-yes-btn');
        await expect(confirmYesBtn).toBeVisible();
        await confirmYesBtn.click();

        // Verify toast notification is displayed
        const toast = page.locator('.pwa-toast');
        await expect(toast).toContainText('Tili ja kaikki asetuksesi on poistettu onnistuneesti');

        // Confirm that profile UIs are reset/hidden
        const loginBtn = page.locator('#btn-login');
        await expect(loginBtn).toBeVisible({ timeout: 10000 });
      });

      test('UP-7b: should register a new account with real test credentials and log in', async ({ page }) => {
        // Mock the backend API response to avoid actual fetch errors
        await page.route('**/ap/outbox*', async route => {
          await route.fulfill({ json: { "@context": "https://www.w3.org/ns/activitystreams", "type": "OrderedCollection", "totalItems": 0, "orderedItems": [] } });
        });

        // Register the new user
        const registerError = await page.evaluate(async ({ email, password }) => {
          try {
            await window.registerForTest(email, password);
            return null;
          } catch (err) {
            return err.code;
          }
        }, { email: testUserEmail, password: testUserPassword });

        if (registerError && (registerError.includes('api-key-not-valid') || registerError.includes('invalid-api-key') || registerError.includes('api-key') || registerError.includes('email-already-in-use') || registerError.includes('email-already-exists'))) {
          console.warn(`Firebase registration skipped/warned: ${registerError}`);
          return;
        } else if (registerError) {
          throw new Error(`Registration failed with error: ${registerError}`);
        }

        // Wait for the auth callback to complete and UI to update
        const profileBtn = page.locator('#btn-profile');
        await expect(profileBtn).toBeVisible({ timeout: 15000 });
        await profileBtn.dispatchEvent('click');

        const profileEmail = page.locator('.profile-email');
        await expect(profileEmail).toContainText(testUserEmail);
      });
    });
  }
  test('UP-8: should enforce maximum layout width of 960px for news feed and feed items', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.route('**/ap/outbox*', async route => {
      const json = {
        "@context": "https://www.w3.org/ns/activitystreams",
        "type": "OrderedCollection",
        "totalItems": 1,
        "orderedItems": [
          {
            "id": "https://activitystreams.uutisseuranta.net/ap/outbox/article-1",
            "type": "Create",
            "actor": "https://uutisseuranta.net/sources/yle",
            "object": {
              "id": "https://uutisseuranta.net/articles/1",
              "type": "Article",
              "name": "Testiuutinen leveyden tarkistukseen",
              "summary": "Tämä on testiuutisen kuvaus.",
              "url": "https://yle.fi/uutiset/1",
              "published": "2026-07-27T00:00:00Z"
            }
          }
        ]
      };
      await route.fulfill({ json });
    });

    const newsLink = page.locator('#nav-link-news');
    await expect(newsLink).toBeVisible();
    await newsLink.click();

    const feedGrid = page.locator('#feed-grid');
    await expect(feedGrid).toBeVisible();

    const feedItem = page.locator('.feed-item').first();
    await expect(feedItem).toBeVisible({ timeout: 15000 });

    const gridBox = await feedGrid.boundingBox();
    const itemBox = await feedItem.boundingBox();

    console.log(`Measured Grid width: ${gridBox.width}px, Item width: ${itemBox.width}px`);

    expect(gridBox.width).toBeLessThanOrEqual(960);
    expect(itemBox.width).toBeLessThanOrEqual(960);

    const feedImage = page.locator('.feed-item__image').first();
    if (await feedImage.isVisible()) {
      const imageBox = await feedImage.boundingBox();
      console.log(`Measured Image width: ${imageBox.width}px`);
      expect(imageBox.width).toBeLessThanOrEqual(960);
    }
  });
});
