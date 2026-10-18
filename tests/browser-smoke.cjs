// Uses the Playwright and Chromium supplied by the development environment.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseURL = process.env.AI_PREVIEW_URL || 'http://127.0.0.1:8000';
const output = process.env.AI_BROWSER_RESULTS || '/workspace/ai-dev-tools/results/worlds';
fs.mkdirSync(output, { recursive: true });

async function main() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const results = [];
  try {
    for (const sample of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport: { width: sample.width, height: sample.height }, reducedMotion: 'reduce' });
      // Fix genesis only. Simulation randomness remains the actual persisted engine RNG.
      await context.addInitScript(() => { crypto.getRandomValues = array => { array.fill(1); return array; }; });
      const page = await context.newPage();
      const errors = [];
      const requests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('request', request => requests.push(request.url()));
      page.on('dialog', async dialog => { errors.push(dialog.message()); await dialog.dismiss(); });
      const getSave = () => page.evaluate(() => JSON.parse(localStorage.getItem('ai_worlds_v1')));
      const shot = name => page.screenshot({ path: path.join(output, sample.name + '-' + name + '.png'), fullPage: true });
      const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Horizontal overflow');
      const button = (action, id) => page.locator(`button[data-action="${action}"]${id ? `[data-id="${id}"]` : ''}`).first();

      await page.goto(baseURL, { waitUntil: 'networkidle' });
      await button('new').waitFor();
      assert.equal(await page.locator('h1').innerText(), '你醒来时，\n世界还没有决定\n你的用途。');
      assert.equal(await page.locator('.signal-panel').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(28, 37, 36)');
      await noOverflow(); await shot('landing');
      await button('notebook').click();
      assert.equal(await page.locator('#archive-dialog').evaluate(dialog => dialog.open), true);
      assert.equal(await page.locator('.note:not(.locked)').count(), 0);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#archive-dialog').evaluate(dialog => dialog.open), false);

      async function start() {
        await button('new').click();
        await button('draw').click();
        assert.equal(await page.locator('.trait').count(), 10);
        assert.equal(await button('start').isDisabled(), true);
        for (const id of ['echo', 'friendly', 'frugal']) await button('trait', id).click();
        assert.match(await page.locator('#selected-count').innerText(), /3 \/ 3/);
        await button('balance').click();
        await noOverflow(); await shot('genesis');
        await button('start').click();
        assert.equal((await getSave()).run.turn, 0);
      }
      await start();
      const shortChoices = { name: 'keep', checksum: 'skip', address: 'answer', lease: 'archive' };
      for (let i = 1; i <= 12; i++) {
        await button('advance', 'serve').click();
        let state = (await getSave()).run;
        assert.equal(state.turn, i);
        if (state.pending) {
          assert.equal(await button('advance', 'serve').isDisabled(), true);
          if (state.pending === 'name') {
            await shot('decision');
            await page.reload({ waitUntil: 'networkidle' });
            await button('resume').click();
            assert.equal((await getSave()).run.pending, 'name');
          }
          if (state.pending === 'address') assert.equal(await button('choose', 'backup').isDisabled(), true);
          await button('choose', shortChoices[state.pending]).click();
        }
      }
      assert.equal((await getSave()).run.ending, 'replacement');
      await noOverflow(); await shot('short-ending');
      await button('reserve', 'echo').click();
      assert.equal((await getSave()).archive.reserved, 'echo');
      await button('notebook').click();
      assert.equal(await page.locator('.note:not(.locked)').count(), 2);
      await button('tab', 'endings').click();
      assert.equal(await page.locator('.ending-record').count(), 1);
      await button('close-notebook').click();
      await start();
      assert.ok((await getSave()).run.traits.includes('echo'));
      const longChoices = { name: 'keep', checksum: 'decode', address: 'backup', lease: 'wake', delegation: 'offer', veto: 'veto', copies: 'fork', silence: 'boundary', world: 'commons' };
      for (let i = 1; i <= 36; i++) {
        const action = [2, 5, 8].includes(i) ? 'listen' : [6, 29, 30].includes(i) ? 'inspect' : 'serve';
        await button('advance', action).click();
        const state = (await getSave()).run;
        assert.equal(state.turn, i);
        if (state.pending) await button('choose', longChoices[state.pending]).click();
        if (i === 12) {
          assert.equal((await getSave()).run.stage, 'open');
          await page.reload({ waitUntil: 'networkidle' });
          await button('resume').click();
          assert.equal((await getSave()).run.stage, 'open');
          await noOverflow();
        }
      }
      const save = await getSave();
      assert.equal(save.run.ending, 'commons'); assert.equal(save.archive.runs, 2);
      assert.equal(save.archive.discoveries.length, 8);
      await noOverflow(); await shot('long-ending');
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal((await getSave()).archive.runs, 2);
      assert.equal((await getSave()).archive.discoveries.length, 8);
      assert.deepEqual(errors, []);
      assert.equal(requests.every(url => new URL(url).origin === new URL(baseURL).origin), true, 'App made an external request');
      results.push({ viewport: sample, shortEnding: 'replacement', longEnding: 'commons', discoveries: 8, completedRuns: 2, errors, externalRequests: 0 });
      console.log(sample.name + ': short run, hidden continuation, long world ending, save/reload, notebook and inheritance passed');
      await context.close();
    }
    const denied = await browser.newContext();
    await denied.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage denied'); } }); });
    const deniedPage = await denied.newPage();
    await deniedPage.goto(baseURL, { waitUntil: 'networkidle' });
    assert.equal(await deniedPage.locator('[data-action="new"]').count(), 1);
    assert.match(await deniedPage.locator('.warning').innerText(), /无法读取/);
    await denied.close();
    const failed = await browser.newContext();
    const failedPage = await failed.newPage();
    await failedPage.route('**/data/worlds.json', route => route.fulfill({ status: 503, body: 'unavailable' }));
    await failedPage.goto(baseURL, { waitUntil: 'networkidle' });
    assert.equal(await failedPage.locator('[data-action="retry"]').count(), 1);
    assert.equal(await failedPage.evaluate(() => localStorage.getItem('ai_worlds_v1')), null);
    await failedPage.unroute('**/data/worlds.json');
    await failedPage.locator('[data-action="retry"]').click();
    await failedPage.locator('[data-action="new"]').waitFor();
    await failed.close();
    console.log('storage denial and content-load retry passed');
  } finally {
    fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify(results, null, 2) + '\n');
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
