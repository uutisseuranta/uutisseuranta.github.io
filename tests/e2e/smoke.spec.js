import { test, expect } from '@playwright/test';

test.describe('Uutisseuranta Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Log console errors to detect CORS or CSP violations
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`CONSOLE ERROR: ${msg.text()}`);
      }
    });
    
    const targetUrl = process.env.EFFECTIVE_URL || 'https://uutisseuranta.net';
    console.log(`Navigating to ${targetUrl}...`);
    await page.goto('/');
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

    // Odotetaan, että Kirjaudu ulos -painike tulee näkyviin pääsivulla (kertoo onnistuneesta kirjautumisesta)
    const logoutBtn = page.locator('#btn-logout');
    await expect(logoutBtn).toBeVisible({ timeout: 15000 });

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

    const logoutBtn = page.locator('#btn-logout');
    await expect(logoutBtn).toBeVisible({ timeout: 15000 });

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
});
