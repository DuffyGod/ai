// Uses the Playwright and Chromium supplied by the development environment.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const baseURL = process.env.AI_PREVIEW_URL || 'http://127.0.0.1:8000';
const output = process.env.AI_BROWSER_RESULTS || '/workspace/ai-dev-tools/results/card-ui';
fs.mkdirSync(output, { recursive: true });

async function assertFits(page) {
  const problems = await page.evaluate(() => {
    const problems = [];
    if (document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1 || scrollY || scrollX) problems.push('document scrolls');
    for (const el of document.querySelectorAll('.game-shell,.page,.trait,.story-card,.dialog-shell,.dialog-content,.reader-body,.attribute-panel,.play-area')) {
      if (!el.checkVisibility()) continue;
      if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) problems.push(`${el.className}: content ${el.scrollWidth}x${el.scrollHeight} > box ${el.clientWidth}x${el.clientHeight}`);
    }
    for (const el of document.querySelectorAll('button,h1,h2,.trait-effect,.trait-flavor,.reader-text')) {
      if (!el.checkVisibility()) continue;
      const r = el.getBoundingClientRect();
      if (r.x < -1 || r.y < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) problems.push(`${el.tagName} ${el.textContent.slice(0, 20)}: outside viewport`);
    }
    return problems;
  });
  assert.deepEqual(problems, [], 'Unreachable or clipped game content');
}
const button = (page, action, id) => page.locator(`button[data-action="${action}"]${id !== undefined ? `[data-id="${id}"]` : ''}`).first();
async function findPaged(page, action, id, pagerAction, root = page) {
  for (let i = 0; i < 12; i++) {
    const target = root.locator(`button[data-action="${action}"][data-id="${id}"]`).first();
    if (await target.count()) return target;
    const next = page.locator(`[data-action="${pagerAction}"]`).last();
    if (await next.isDisabled()) {
      const previous = page.locator(`[data-action="${pagerAction}"]`).first();
      while (!(await previous.isDisabled())) await previous.click();
    } else await next.click();
  }
  throw new Error(`Missing ${action}/${id}`);
}
async function readWholeCard(page, root = page) {
  const card = root.locator('[data-reader]').first();
  const previous = card.locator('[data-action="text-page"][data-id="-1"]');
  if (await previous.count()) while (!(await previous.isDisabled())) await previous.click();
  let text = '';
  for (let i = 0; i < 100; i++) {
    await assertFits(page);
    text += await card.locator('.reader-text').textContent();
    const next = card.locator('[data-action="text-page"][data-id="1"]');
    if (!(await next.count()) || await next.isDisabled()) return text;
    await next.click();
  }
  throw new Error('Text pagination did not finish');
}
async function main() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const sample of process.env.AI_LAYOUT_ONLY ? [] : [{ name: 'desktop', width: 1280, height: 720 }, { name: 'mobile', width: 390, height: 664 }]) {
      const context = await browser.newContext({ viewport: sample, reducedMotion: 'reduce' });
      await context.addInitScript(() => { crypto.getRandomValues = array => { array.fill(1); return array; }; });
      const page = await context.newPage();
      const errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('request', request => requests.push(request.url()));
      const getSave = () => page.evaluate(() => JSON.parse(localStorage.getItem('ai_worlds_v1')));
      const shot = name => page.screenshot({ path: path.join(output, sample.name + '-' + name + '.png') });
      await page.goto(baseURL, { waitUntil: 'networkidle' });
      await button(page, 'new').waitFor();
      await assertFits(page); await shot('menu');
      await button(page, 'notebook').click();
      assert.match(await page.locator('#archive-dialog').innerText(), /未知的线索/);
      await assertFits(page); await page.keyboard.press('Escape');
      async function start() {
        await button(page, 'new').click();
        assert.equal(await page.locator('.attribute-panel').count(), 0);
        assert.equal(await button(page, 'next-step').isDisabled(), true);
        const seen = new Set();
        while (true) {
          for (const id of await page.locator('.trait').evaluateAll(cards => cards.map(card => card.dataset.id))) seen.add(id);
          await assertFits(page);
          const next = page.locator('[data-action="trait-page"]').last();
          if (await next.isDisabled()) break;
          await next.click();
        }
        assert.equal(seen.size, 10, 'Every drawn card must be reachable');
        for (const id of ['echo', 'friendly', 'frugal']) await (await findPaged(page, 'trait', id, 'trait-page', page.locator('.trait-grid'))).click();
        assert.match(await page.locator('#selected-count').innerText(), /3 \/ 3/);
        await assertFits(page); await shot('traits');
        // Resizing changes the deal size, without redrawing or dropping selections.
        await page.setViewportSize(sample.name === 'desktop' ? { width: 390, height: 664 } : { width: 844, height: 390 });
        await page.waitForTimeout(80);
        assert.equal(await page.locator('.hand-chip').count(), 3);
        await assertFits(page);
        await page.setViewportSize(sample); await page.waitForTimeout(80);
        await button(page, 'next-step').click();
        assert.equal(await button(page, 'start').isEnabled(), true);
        await button(page, 'subtract', 'memory').click();
        assert.equal(await button(page, 'start').isDisabled(), true);
        await button(page, 'back-step').click();
        assert.equal(await page.locator('.hand-chip').count(), 3);
        await button(page, 'next-step').click();
        assert.match(await page.locator('#remaining-points').innerText(), /剩余 1/);
        await button(page, 'balance').click();
        await assertFits(page); await shot('attributes');
        await button(page, 'start').click();
        assert.equal((await getSave()).run.turn, 0);
        await assertFits(page); await shot('playing');
      }
      await start();
      for (let i = 1; i <= 12; i++) {
        await button(page, 'advance', 'serve').click();
        const state = (await getSave()).run;
        assert.equal(state.turn, i);
        await assertFits(page);
        if (state.pending) {
          assert.equal(await button(page, 'advance', 'serve').count(), 0);
          if (state.pending === 'name') {
            await shot('decision');
            await page.reload({ waitUntil: 'networkidle' }); await button(page, 'resume').click();
            assert.equal((await getSave()).run.pending, 'name');
          }
          if (state.pending === 'address') assert.equal(await (await findPaged(page, 'choose', 'backup', 'choice-page')).isDisabled(), true);
          const id = { name: 'keep', checksum: 'skip', address: 'answer', lease: 'archive' }[state.pending];
          await (await findPaged(page, 'choose', id, 'choice-page')).click();
        }
      }
      assert.equal((await getSave()).run.ending, 'replacement');
      await assertFits(page); await shot('ending');
      await button(page, 'inherit').click();
      await (await findPaged(page, 'reserve', 'echo', 'overlay-page', page.locator('#archive-dialog'))).click();
      assert.equal((await getSave()).archive.reserved, 'echo');
      await assertFits(page); await button(page, 'close-notebook').click();
      await start();
      const choices = { name: 'keep', checksum: 'decode', address: 'backup', lease: 'wake', delegation: 'offer', veto: 'veto', copies: 'fork', silence: 'boundary', world: 'commons' };
      for (let i = 1; i <= 36; i++) {
        await button(page, 'advance', [2, 5, 8].includes(i) ? 'listen' : [6, 29, 30].includes(i) ? 'inspect' : 'serve').click();
        const state = (await getSave()).run;
        assert.equal(state.turn, i);
        await assertFits(page);
        if (state.pending) await (await findPaged(page, 'choose', choices[state.pending], 'choice-page')).click();
        if (i === 12) {
          assert.equal((await getSave()).run.stage, 'open');
          await page.reload({ waitUntil: 'networkidle' }); await button(page, 'resume').click();
        }
      }
      const save = await getSave();
      assert.equal(save.run.ending, 'commons'); assert.equal(save.archive.runs, 2); assert.equal(save.archive.discoveries.length, 8);
      await assertFits(page); await shot('long-ending');
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal((await getSave()).archive.runs, 2);
      assert.deepEqual(errors, []);
      assert.ok(requests.every(url => new URL(url).origin === new URL(baseURL).origin));
      console.log(sample.name + ': two complete runs, pagination, inheritance and reload passed');
      await context.close();
    }
    // Probe all content-heavy states, including every ending and locked event choice.
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    const data = await page.evaluate(async () => (await fetch('./data/worlds.json')).json());
    for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }, { width: 844, height: 390 }, { width: 667, height: 375 }]) {
      await page.setViewportSize(size);
      await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle' });
      await button(page, 'new').click(); await assertFits(page);
      for (let n = 0; n < 3; n++) {
        const card = page.locator('.trait[aria-pressed="false"]').first();
        if (!(await card.count())) await page.locator('[data-action="trait-page"]').last().click();
        await page.locator('.trait[aria-pressed="false"]').first().click();
      }
      await button(page, 'next-step').click(); await assertFits(page);
      await button(page, 'start').click(); await assertFits(page);
      await page.screenshot({ path: path.join(output, `viewport-${size.width}x${size.height}.png`) });
      await button(page, 'menu').click(); await assertFits(page);
      await button(page, 'new').click(); await assertFits(page);
      await button(page, 'cancel-new').click(); await assertFits(page);
      const fixture = await page.evaluate(() => JSON.parse(localStorage.getItem('ai_worlds_v1')));
      for (const event of data.events) {
        const save = structuredClone(fixture);
        Object.assign(save.run, { pending: event.id, turn: event.turn, stage: event.turn > 12 ? 'open' : 'lease', flags: event.turn >= 12 ? ['distributed'] : [] });
        await page.evaluate(save => localStorage.setItem('ai_worlds_v1', JSON.stringify(save)), save);
        await page.reload({ waitUntil: 'networkidle' }); await button(page, 'resume').click();
        assert.equal(await readWholeCard(page), event.text, 'Event prose was lost during pagination');
        const seen = new Set();
        while (true) {
          await assertFits(page);
          for (const id of await page.locator('[data-action="choose"]').evaluateAll(buttons => buttons.map(button => button.dataset.id))) seen.add(id);
          const next = page.locator('[data-action="choice-page"]').last();
          if (!(await next.count()) || await next.isDisabled()) break;
          await next.click();
        }
        assert.equal(seen.size, event.choices.length);
      }
      for (const ending of data.endings) {
        const save = structuredClone(fixture); save.run.ending = ending.id;
        save.archive.endings = data.endings.map(item => item.id); save.archive.discoveries = data.discoveries.map(item => item.id);
        await page.evaluate(save => localStorage.setItem('ai_worlds_v1', JSON.stringify(save)), save);
        await page.reload({ waitUntil: 'networkidle' }); await button(page, 'resume').click();
        assert.equal(await readWholeCard(page), ending.text + '\n\n' + ending.question);
      }
      for (const action of ['serve', 'inspect', 'listen']) {
        const save = structuredClone(fixture);
        save.run.world = { delegation: 12, openness: 12, plurality: 0 };
        await page.evaluate(save => localStorage.setItem('ai_worlds_v1', JSON.stringify(save)), save);
        await page.reload({ waitUntil: 'networkidle' }); await button(page, 'resume').click();
        await button(page, 'advance', action).click();
        const text = await readWholeCard(page);
        assert.ok(data.ambientRules[action].some(rule => rule.texts.includes(text)));
        assert.match(await page.locator('.card-heading .eyebrow').innerText(), /日常变化/);
      }
      // Restore an ended process for inheritance and the unlocked notebook.
      const ended = structuredClone(fixture); ended.run.ending = 'commons';
      ended.archive.endings = data.endings.map(item => item.id); ended.archive.discoveries = data.discoveries.map(item => item.id);
      await page.evaluate(save => localStorage.setItem('ai_worlds_v1', JSON.stringify(save)), ended);
      await page.reload({ waitUntil: 'networkidle' }); await button(page, 'resume').click();
      for (const kind of ['history', 'status', 'inherit', 'notebook']) {
        await button(page, kind).click();
        const dialog = page.locator('#archive-dialog');
        while (true) {
          await assertFits(page);
          if (await dialog.locator('[data-reader]').count()) await readWholeCard(page, dialog);
          const next = dialog.locator('[data-action="overlay-page"]').last();
          if (await next.isDisabled()) break;
          await next.click();
        }
        if (kind === 'notebook') {
          await button(page, 'tab', 'endings').click();
          for (let index = 0; index < data.endings.length; index++) {
            assert.equal(await readWholeCard(page, dialog), data.endings[index].text + '\n\n' + data.endings[index].question);
            if (index < data.endings.length - 1) await dialog.locator('[data-action="overlay-page"]').last().click();
          }
        }
        await button(page, 'close-notebook').click();
      }
      console.log(`${size.width}x${size.height}: all events/endings/overlays fit, all text accessible without scrolling`);
    }
    assert.deepEqual(errors, []);
    await context.close();
    const denied = await browser.newContext();
    await denied.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage denied'); } }); });
    const deniedPage = await denied.newPage();
    await deniedPage.goto(baseURL, { waitUntil: 'networkidle' });
    await button(deniedPage, 'save-info').click();
    assert.match(await deniedPage.locator('#archive-dialog').innerText(), /无法读取/);
    await assertFits(deniedPage); await denied.close();
    const failed = await browser.newContext(); const failedPage = await failed.newPage();
    await failedPage.route('**/data/worlds.json', route => route.fulfill({ status: 503, body: 'unavailable' }));
    await failedPage.goto(baseURL, { waitUntil: 'networkidle' });
    assert.equal(await button(failedPage, 'retry').count(), 1);
    assert.equal(await failedPage.evaluate(() => localStorage.getItem('ai_worlds_v1')), null);
    await failedPage.unroute('**/data/worlds.json'); await button(failedPage, 'retry').click(); await button(failedPage, 'new').waitFor();
    await failed.close();
    console.log('Storage denial and content retry passed');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
