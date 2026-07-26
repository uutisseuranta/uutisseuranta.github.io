import puppeteer from 'puppeteer';

async function runTest() {
  const targetUrl = process.env.EFFECTIVE_URL || 'https://uutisseuranta.net';
  console.log(`Starting Puppeteer headless Chrome test against: ${targetUrl}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  const consoleErrors = [];

  // Capture JS runtime errors
  page.on('pageerror', (exception) => {
    console.error(`PAGE ERROR (Uncaught Exception): ${exception.stack || exception.message}`);
    consoleErrors.push(exception);
  });

  // Capture CSP & regular console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`CONSOLE ERROR: ${msg.text()}`);
      consoleErrors.push(new Error(msg.text()));
    }
  });

  try {
    // 1. Navigate to page and verify uutisvirta (news feed)
    console.log("Navigating to page...");
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    console.log("Waiting for news feed state...");
    // Wait for either the article cards (loaded state) or the failure error container
    await page.waitForSelector('.article-card, .error-container', { timeout: 10000 }).catch(() => {
      throw new Error("Timeout waiting for feed container state.");
    });

    // Check if feed failed to load
    const errorTextPresent = await page.evaluate(() => {
      return document.body.innerText.includes('Uutisvirran lataus epäonnistui');
    });

    if (errorTextPresent) {
      throw new Error("News feed failed to load (Found 'Uutisvirran lataus epäonnistui' on page).");
    }

    // Verify we have articles loaded
    const articleCount = await page.evaluate(() => {
      return document.querySelectorAll('.article-card').length;
    });
    console.log(`Verified feed. Found ${articleCount} article(s) on the page.`);
    if (articleCount === 0) {
      throw new Error("No articles found on the page (empty feed).");
    }

    // 2. Test Theme Toggle functionality
    console.log("Testing theme toggle...");
    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'light');
    console.log(`Initial theme: ${initialTheme}`);

    // Find and click the theme toggle button (id: theme-toggle or class: header__theme-btn)
    const themeBtnSelector = '#theme-toggle, .header__theme-btn, [aria-label*="teema"], [aria-label*="theme"]';
    await page.waitForSelector(themeBtnSelector, { timeout: 3000 });
    await page.click(themeBtnSelector);

    // Give it a tiny moment to process and verify the change
    await new Promise(resolve => setTimeout(resolve, 500));
    const toggledTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    console.log(`Toggled theme: ${toggledTheme}`);

    if (toggledTheme === initialTheme) {
      throw new Error(`Theme toggle failed! Theme stayed '${initialTheme}' after click.`);
    }
    console.log("✓ Theme toggle verified successfully!");

    // 3. Test Login Modal trigger
    console.log("Testing login button click...");
    const loginBtnSelector = '#btn-login, .nav__login-btn, [aria-label*="kirjaudu"], :text("Kirjaudu")';
    
    // We can evaluate to find the button if standard selectors are loose
    const loginBtnExists = await page.evaluate(() => {
      const btn = document.getElementById('btn-login') || document.querySelector('.nav__login-btn');
      return !!btn;
    });

    if (!loginBtnExists) {
      throw new Error("Login button not found on the page.");
    }

    // Click login button
    await page.evaluate(() => {
      const btn = document.getElementById('btn-login') || document.querySelector('.nav__login-btn');
      btn.click();
    });

    // Verify modal overlay is active
    await new Promise(resolve => setTimeout(resolve, 500));
    const isModalVisible = await page.evaluate(() => {
      const modal = document.getElementById('modal-login');
      if (!modal) return false;
      const style = window.getComputedStyle(modal);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });

    if (!isModalVisible) {
      throw new Error("Login modal failed to appear after clicking the login button.");
    }
    console.log("✓ Login modal trigger verified successfully!");

    // 4. Check for any captured console or CSP errors
    if (consoleErrors.length > 0) {
      throw new Error(`Encountered ${consoleErrors.length} console/CSP errors during execution.`);
    }

    console.log("✓ Puppeteer headless Chrome regression test passed successfully!");
    await browser.close();
    process.exit(0);

  } catch (error) {
    console.error(`❌ REGRESSION TEST FAILED: ${error.message}`);
    await browser.close();
    process.exit(1);
  }
}

runTest();
