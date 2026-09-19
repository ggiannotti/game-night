import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';

const source = await readFile(new URL('../elamigos.user.js', import.meta.url), 'utf8');
const indexHTML = '<h2>18.09.2026</h2><h3>Alpha + ElAmigos <a href="data/alpha.html">download</a></h3>'
    + '<h3>Beta + ElAmigos <a href="data/beta.html">download</a></h3>';
const gameHTML = title => '<h2>' + title + '</h2><h3>DOWNLOAD</h3><a href="https://example.test/directdownload/game">Download</a>';
let browser;

before(async () => {
    browser = await chromium.launch({ args: ['--host-resolver-rules=MAP * ~NOTFOUND'] });
});
after(async () => { await browser?.close(); });

function installMocks({ savedCache, blockStorage, useFetch }) {
    window.__requests = [];
    window.__errors = [];
    window.addEventListener('unhandledrejection', event => window.__errors.push(String(event.reason)));
    if (savedCache) localStorage.setItem('ea-index-v3', JSON.stringify(savedCache));
    if (blockStorage) {
        Storage.prototype.getItem = () => { throw new DOMException('Storage disabled', 'SecurityError'); };
    }
    window.GM_addStyle = css => {
        const style = document.createElement('style');
        style.textContent = css;
        document.documentElement.append(style);
    };
    window.GM_getValue = (key, fallback) => fallback;
    window.GM_registerMenuCommand = () => {};
    if (!useFetch) {
        window.GM_xmlhttpRequest = options => {
            window.__requests.push(options);
            if (options.url && /filecrypt\.cc\/Go\//i.test(options.url)) {
                const id = String(options.url.split('/Go/')[1] || 'file').replace(/\.html$/i, '');
                queueMicrotask(() => options.onload && options.onload({
                    status: 302,
                    finalUrl: 'https://ddownload.com/' + id,
                    responseText: ''
                }));
            }
        };
    }
}

async function open(t, { url = 'https://elamigos.site/#/all', html = indexHTML, savedCache, blockStorage, useFetch, fetchStatus = 200, fetchBody = indexHTML, fetchHang = false, useClock = false, viewport } = {}) {
    const context = await browser.newContext({ serviceWorkers: 'block', ...(viewport ? { viewport } : {}) });
    t.after(() => context.close());
    await context.route('**/*', async route => {
        const request = route.request();
        if (request.isNavigationRequest() && request.url().startsWith('https://elamigos.site/')) {
            return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body>' + html + '</body></html>' });
        }
        if (request.isNavigationRequest() && /^https:\/\/(?:www\.)?filecrypt\.cc\//i.test(request.url())) {
            return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Filecrypt</title><body></body></html>' });
        }
        if (useFetch && request.url().includes('ea_index_refresh=')) {
            if (fetchHang) return;
            return route.fulfill({ status: fetchStatus, contentType: 'text/html', body: fetchBody });
        }
        return route.abort();
    });
    const setup = '(' + installMocks.toString() + ')(' + JSON.stringify({ savedCache, blockStorage, useFetch }) + ');\n';
    // Userscript managers inject once the document root exists, before body parsing.
    // Keep the shipped script intact inside the same lifecycle wrapper.
    await context.addInitScript({ content: '(() => { const run = () => {\n' + setup + source
        + '\n}; if (document.documentElement) run(); else { const observer = new MutationObserver(() => {'
        + ' if (document.documentElement) { observer.disconnect(); run(); } }); observer.observe(document, { childList: true }); } })();' });
    const page = await context.newPage();
    page.setDefaultTimeout(2500);
    if (fetchHang || useClock) await page.clock.install();
    await page.goto(url);
    await page.locator('#ea-app').waitFor();
    return page;
}

async function respond(page, match, body = indexHTML, status = 200) {
    await page.waitForFunction(match => window.__requests.some(request => request.url.includes(match)), match);
    await page.evaluate(({ match, body, status }) => {
        const request = window.__requests.find(request => request.url.includes(match));
        request.onload({ status, responseText: body });
        request.settled = true;
    }, { match, body, status });
}

for (const width of [320, 390, 1366]) {
    test(`ElAmigos home, tooltips, archive and pagination fit ${width}px`, async t => {
        const title = 'Suikoden I and II HD Remaster Gate Rune and Dunan Unification Wars';
        const longIndex = '<h2>18.09.2026</h2>' + Array.from({ length: 30 }, (_, i) =>
            '<h3>' + title + ' ' + i + ' + ElAmigos <a href="data/game-' + i + '.html">download</a></h3>').join('');
        const page = await open(t, { url: 'https://elamigos.site/#/', viewport: { width, height: 844 } });
        await respond(page, 'ea_index_refresh=', longIndex);
        await page.evaluate(body => window.__requests.filter(request => request.url.includes('/data/')).forEach(request =>
            request.onload({ status: 200, responseText: body })), '<h2>' + title + ', 1GB</h2>'
            + '<h3>This is a long description of the repack and all of the included updates.</h3>'
            + '<h3>DOWNLOAD</h3><a href="https://www.keeplinks.org/p16/6aa950322ed47">Download</a>');
        await page.waitForFunction(() => document.querySelectorAll('.ea-card .ea-panel').length === 12);
        const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
        const overflow = await page.locator('#ea-app *').evaluateAll(elements => elements.map(element => ({
            className: element.className, right: element.getBoundingClientRect().right,
            visibility: getComputedStyle(element).visibility
        })).filter(element => element.right > innerWidth).slice(0, 6));
        assert.equal(await fits(), true, 'home must not create horizontal scrolling: ' + JSON.stringify(overflow));
        for (const selector of ['.ea-page-info', '.ea-info-badge']) {
            await page.locator(selector).first().focus();
            assert.equal(await page.locator(selector + ' .ea-tip').first().isVisible(), true);
            const tip = await page.locator(selector + ' .ea-tip').first().boundingBox();
            assert.ok(tip.x >= 0 && tip.x + tip.width <= width, `${selector} tooltip must fit: ${JSON.stringify(tip)}`);
            assert.equal(await fits(), true, 'a visible tooltip must not expand the viewport');
        }
        await page.locator('.ea-tab[href="#/all"]').click();
        await page.getByRole('button', { name: '2', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.ea-page.on')?.textContent === '2');
        assert.equal(await page.locator('.ea-row-title').count(), 5);
        assert.equal(await fits(), true, 'release pagination must fit');
        await page.locator('.ea-tab[href="#/archive"]').click();
        await page.locator('.ea-letter').filter({ hasText: /^S30$/ }).click();
        await page.waitForFunction(() => document.querySelectorAll('.ea-row-title').length === 30);
        const archiveBounds = await page.locator('.ea-archive-layout, .ea-archive-results, .ea-row').evaluateAll(elements =>
            elements.slice(0, 3).map(element => ({ className: element.className, width: element.getBoundingClientRect().width,
                right: element.getBoundingClientRect().right, columns: getComputedStyle(element).gridTemplateColumns })));
        assert.equal(await fits(), true, 'long archive titles must fit: ' + JSON.stringify(archiveBounds));
    });
}

test('Recent selects only its own navigation tab', async t => {
    const page = await open(t, { url: 'https://elamigos.site/#/' });
    await respond(page, 'ea_index_refresh=');
    assert.deepEqual(await page.locator('.ea-tab.on').allTextContents(), ['Recent']);
});

test('archive search spans all initial letters and resolves index URLs from /data pages', async t => {
    const page = await open(t, { url: 'https://elamigos.site/data/other.html#/archive?q=beta', blockStorage: true });
    await respond(page, 'ea_index_refresh=');
    assert.deepEqual(await page.locator('.ea-row-title').allTextContents(), ['Beta']);
    assert.equal(await page.locator('.ea-row-title').getAttribute('href'), 'https://elamigos.site/data/beta.html');
    // The "open externally" row link is target=_blank; it must not run with opener access.
    assert.equal(await page.locator('.ea-row a[target="_blank"]').first().getAttribute('rel'), 'noopener');
});

test('nested archive headings and trailing update markers are parsed', async t => {
    const page = await open(t, { url: 'https://elamigos.site/#/archive?q=gamma' });
    await respond(page, 'ea_index_refresh=', indexHTML
        + '<div><h2>Full log of updates</h2><section><h3>Gamma + ElAmigos [Update 1] + <a href="data/gamma.html">download</a></h3></section></div>');
    assert.deepEqual(await page.locator('.ea-row-title').allTextContents(), ['Gamma']);
});

test('a trailing "+" that is part of the game name survives update-marker stripping', async t => {
    const page = await open(t, { url: 'https://elamigos.site/#/archive?q=' + encodeURIComponent('mega mix') });
    await respond(page, 'ea_index_refresh=', indexHTML
        + '<h3>Hatsune Miku Project DIVA Mega Mix+ + ElAmigos <a href="data/megamix.html">download</a></h3>');
    assert.deepEqual(await page.locator('.ea-row-title').allTextContents(), ['Hatsune Miku Project DIVA Mega Mix+']);
});

test('pending navigation shares one index request and renders the latest route', async t => {
    const page = await open(t);
    await page.locator('.ea-input').fill('beta');
    await page.locator('.ea-input').press('Enter');
    // Updating location.hash is synchronous; its hashchange handler is not.
    // Wait until the pending Archive view has subscribed to the shared request.
    await page.waitForFunction(() => document.querySelector('.ea-tab.on')?.textContent === 'A–Z archive');
    assert.equal(await page.evaluate(() => window.__requests.length), 1);
    await respond(page, 'ea_index_refresh=');
    assert.deepEqual(await page.locator('.ea-row-title').allTextContents(), ['Beta']);
    assert.deepEqual(await page.locator('.ea-tab.on').allTextContents(), ['A–Z archive']);
});

test('a malformed fresh cache is discarded before rendering', async t => {
    const page = await open(t, {
        url: 'https://elamigos.site/data/other.html#/all',
        savedCache: { savedAt: Date.now(), data: { recent: [null], archive: [], all: [null] } }
    });
    await respond(page, 'ea_index_refresh=');
    assert.deepEqual(await page.locator('.ea-row-title').allTextContents(), ['Alpha', 'Beta']);
    assert.deepEqual(await page.evaluate(() => window.__errors), []);
});

test('empty successful index responses show a retry without poisoning storage', async t => {
    const page = await open(t, { url: 'https://elamigos.site/data/other.html#/all', html: '<h2>Other game</h2>' });
    await respond(page, 'ea_index_refresh=', '<h1>Verify your browser</h1>');
    assert.match(await page.locator('.ea-main').textContent(), /Could not load the release index/);
    assert.equal(await page.evaluate(() => localStorage.getItem('ea-index-v3')), null);
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.waitForFunction(() => window.__requests.length === 2);
    await page.evaluate(body => window.__requests[1].onload({ status: 200, responseText: body }), indexHTML);
    assert.deepEqual(await page.locator('.ea-row-title').allTextContents(), ['Alpha', 'Beta']);
});

test('a GM timeout rejects the index request and permits retry', async t => {
    const page = await open(t, { url: 'https://elamigos.site/data/other.html#/all' });
    const timeout = await page.evaluate(() => {
        const request = window.__requests[0];
        request.ontimeout?.({ status: 0 });
        return request.timeout;
    });
    assert.ok(timeout > 0, 'GM requests must have a finite timeout');
    assert.match(await page.locator('.ea-main').textContent(), /Could not load the release index/);
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__requests.length), 2);
});

test('fetch fallback rejects HTTP error pages', async t => {
    const page = await open(t, { url: 'https://elamigos.site/data/other.html#/all', useFetch: true, fetchStatus: 503 });
    await page.getByRole('button', { name: 'Try again', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('ea-index-v3')), null);
    assert.deepEqual(await page.evaluate(() => window.__errors), []);
});

test('fetch fallback times out stalled requests', async t => {
    const page = await open(t, { url: 'https://elamigos.site/data/other.html#/all', useFetch: true, fetchHang: true });
    await page.clock.fastForward(30001);
    await page.getByRole('button', { name: 'Try again', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('ea-index-v3')), null);
    assert.deepEqual(await page.evaluate(() => window.__errors), []);
});

test('download links cannot preserve executable URL schemes', async t => {
    const page = await open(t);
    await respond(page, 'ea_index_refresh=');
    await page.getByRole('link', { name: 'Alpha', exact: true }).click();
    await respond(page, '/data/alpha.html', gameHTML('Alpha') + '<a href="javascript:alert(\'filecrypt\')">Untrusted link</a>');
    assert.equal(await page.locator('.ea-modal-body a[href^="javascript:"]').count(), 0);
    assert.equal(await page.locator('.ea-modal-body a[href="https://example.test/directdownload/game"]').count(), 1);
});

test('ElAmigos treats "keeplinks" only as a hostname for the Resolve Keeplinks button', async t => {
    const page = await open(t);
    await respond(page, 'ea_index_refresh=');
    await page.getByRole('link', { name: 'Alpha', exact: true }).click();
    await respond(page, '/data/alpha.html', gameHTML('Alpha')
        + '<a href="https://www.keeplinks.org/p16/real">Real Keeplinks</a>'
        + '<a href="http://192.168.0.1/x?keeplinks=1">Fake LAN</a>');
    assert.equal(await page.getByRole('button', { name: 'Resolve Keeplinks' }).count(), 1);
});

test('a stale game response cannot replace the last requested game', async t => {
    const page = await open(t);
    await respond(page, 'ea_index_refresh=');
    await page.getByRole('link', { name: 'Alpha', exact: true }).click();
    await page.getByRole('link', { name: 'Beta', exact: true }).click();
    await respond(page, '/data/beta.html', gameHTML('Beta'));
    await respond(page, '/data/alpha.html', gameHTML('Alpha'));
    assert.equal(await page.locator('.ea-modal-body .ea-title').textContent(), 'Beta');
});

test('closing a modal prevents an older response from reopening it', async t => {
    const page = await open(t);
    await respond(page, 'ea_index_refresh=');
    await page.getByRole('link', { name: 'Alpha', exact: true }).click();
    await page.getByRole('link', { name: 'Beta', exact: true }).click();
    await respond(page, '/data/beta.html', gameHTML('Beta'));
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await respond(page, '/data/alpha.html', gameHTML('Alpha'));
    assert.equal(await page.locator('.ea-modal').isHidden(), true);
});

test('Escape closes game details and restores keyboard focus', async t => {
    const page = await open(t);
    await respond(page, 'ea_index_refresh=');
    const opener = page.getByRole('link', { name: 'Alpha', exact: true });
    await opener.focus();
    await opener.press('Enter');
    await respond(page, '/data/alpha.html', gameHTML('Alpha'));
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Close');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.ea-modal').isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Alpha');
});

test('keyboard Tab stays inside the game details modal', async t => {
    const page = await open(t);
    await respond(page, 'ea_index_refresh=');
    await page.getByRole('link', { name: 'Alpha', exact: true }).click();
    await respond(page, '/data/alpha.html', gameHTML('Alpha'));
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.href), 'https://example.test/directdownload/game');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Close');
});

test('failed game requests show a closeable error without unhandled rejection', async t => {
    const page = await open(t);
    await respond(page, 'ea_index_refresh=');
    await page.getByRole('link', { name: 'Alpha', exact: true }).click();
    await respond(page, '/data/alpha.html', 'Unavailable', 503);
    assert.equal(await page.locator('.ea-modal-body').textContent(), 'Could not load Alpha');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(await page.locator('.ea-modal').isHidden(), true);
    assert.deepEqual(await page.evaluate(() => window.__errors), []);
});

test('Filecrypt resolver is offered only for the exact allowed hostname', async t => {
    const page = await open(t);
    await respond(page, 'ea_index_refresh=');
    await page.getByRole('link', { name: 'Alpha', exact: true }).click();
    await respond(page, '/data/alpha.html', gameHTML('Alpha')
        + '<a href="https://filecrypt.cc.evil.test/Container/a.html">Forged host</a>'
        + '<a href="https://evil.test/?filecrypt.cc">Forged query</a>'
        + '<a href="https://filecrypt.cc/Container/a.html">Filecrypt</a>');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Show Filecrypt' }).check();
    await page.getByRole('link', { name: 'Alpha', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Resolve Filecrypt' }).count(), 1);
});

test('Filecrypt messages check origin and frame source, and tolerate malformed rows offline', async t => {
    const page = await open(t);
    await respond(page, 'ea_index_refresh=');
    await page.getByRole('checkbox', { name: 'Show Filecrypt' }).check();
    await page.getByRole('link', { name: 'Alpha', exact: true }).click();
    await respond(page, '/data/alpha.html', gameHTML('Alpha') + '<a href="https://filecrypt.cc/Container/a.html">Filecrypt</a>');
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Resolve Filecrypt' }).click();
    const popup = await popupPromise;
    await page.evaluate(() => {
        const data = { eaFilecrypt: true, payload: { type: 'container-ready', rows: [{ filename: 'Untrusted', linkURL: 'https://filecrypt.cc/Link/a.html' }] } };
        window.dispatchEvent(new MessageEvent('message', { origin: 'https://evil.test', source: window, data }));
        window.dispatchEvent(new MessageEvent('message', { origin: 'https://filecrypt.cc', source: window, data }));
    });
    assert.equal(await page.locator('.ea-fc-results').inputValue(), '');
    await popup.evaluate(() => {
        window.opener.postMessage({
            eaFilecrypt: true,
            payload: { type: 'container-ready', rows: [null, { filename: 'Invalid', linkURL: 'javascript:alert(1)' }] }
        }, '*');
    });
    await page.waitForFunction(() => document.querySelector('.ea-fc-results').value.includes('Invalid\nERROR: invalid link'));
    assert.equal(await page.locator('iframe[title="Filecrypt verification"]').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.__errors), []);
});

test('archive search is a named text field', async t => {
    const page = await open(t);
    await respond(page, 'ea_index_refresh=');
    await page.getByRole('textbox', { name: /search the archive/i }).fill('beta');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => location.hash.includes('q=beta'));
});

test('clipboard fallback copies from a visible textarea inside the app', async t => {
    const page = await open(t);
    await respond(page, 'ea_index_refresh=');
    await page.getByRole('link', { name: 'Alpha', exact: true }).click();
    await respond(page, '/data/alpha.html', gameHTML('Alpha'));
    await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: () => Promise.reject(new Error('denied')) }
        });
        const original = Element.prototype.append;
        Element.prototype.append = function (...nodes) {
            const result = original.apply(this, nodes);
            nodes.forEach(node => {
                if (node && node.tagName === 'TEXTAREA') {
                    window.__copyFallback = {
                        parentId: this.id,
                        display: getComputedStyle(node).display,
                        value: node.value || node.textContent
                    };
                }
            });
            return result;
        };
    });
    await page.getByRole('button', { name: 'Copy all' }).click();
    const fallback = await page.waitForFunction(() => window.__copyFallback);
    const snapshot = await fallback.jsonValue();
    assert.equal(snapshot.parentId, 'ea-app');
    assert.notEqual(snapshot.display, 'none');
    assert.match(snapshot.value, /https:\/\/example\.test\/directdownload\/game/);
    const copyButton = page.getByRole('button', { name: 'Copiado' });
    assert.equal(await copyButton.count(), 1);
    assert.equal(await copyButton.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.ea-modal').isHidden(), true);
});

test('YouTube overlay is a dialog that Escape closes without dismissing game details', async t => {
    const page = await open(t);
    await respond(page, 'ea_index_refresh=');
    await page.getByRole('link', { name: 'Alpha', exact: true }).click();
    await respond(page, '/data/alpha.html', gameHTML('Alpha')
        + '<a href="https://www.youtube.com/watch?v=dQw4w9wgGcQ">Trailer</a>'
        + '<a href="https://youtube.com.evil.test/watch?v=dQw4w9wgGcQ">Phishing</a>');
    const youtube = page.getByRole('button', { name: '▶ YouTube' });
    await youtube.focus();
    await youtube.click();
    const video = page.locator('.ea-modal[aria-label="Video"]');
    await video.waitFor();
    assert.equal(await video.getAttribute('role'), 'dialog');
    assert.equal(await video.getAttribute('aria-modal'), 'true');
    assert.equal(await page.locator('.ea-video').getAttribute('title'), 'YouTube video player');
    assert.match(await page.locator('.ea-video').getAttribute('src'), /youtube-nocookie\.com\/embed\/dQw4w9wgGcQ/);
    assert.equal(await video.evaluate(element => element.contains(document.activeElement)), true);
    assert.equal(await page.locator('.ea-modal[aria-label="Game details"]').isHidden(), false);
    await page.keyboard.press('Escape');
    assert.equal(await video.count(), 0);
    assert.equal(await page.locator('.ea-modal[aria-label="Game details"]').isHidden(), false);
    assert.equal(await youtube.evaluate(element => element === document.activeElement), true);
});

test('Filecrypt overlay keeps Escape and rejects off-site /Go/ URLs', async t => {
    const page = await open(t);
    await respond(page, 'ea_index_refresh=');
    await page.getByRole('checkbox', { name: 'Show Filecrypt' }).check();
    await page.getByRole('link', { name: 'Alpha', exact: true }).click();
    await respond(page, '/data/alpha.html', gameHTML('Alpha') + '<a href="https://filecrypt.cc/Container/a.html">Filecrypt</a>');
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Resolve Filecrypt' }).click();
    const overlay = page.locator('.ea-modal[aria-label="Filecrypt resolver"]');
    await overlay.waitFor();
    const popup = await popupPromise;
    assert.equal(await page.locator('iframe[title="Filecrypt verification"]').count(), 0);
    await popup.evaluate(() => {
        window.opener.postMessage({ eaFilecrypt: true, payload: { type: 'container-ready', rows: [{ filename: 'Pack', linkURL: 'https://filecrypt.cc/Link/a.html' }] } }, '*');
    });
    await popup.waitForURL(/__ea_token=/, { timeout: 5_000 });
    await page.waitForFunction(() => /Resolving 1\/1/.test(document.querySelector('.ea-empty')?.innerText || ''));
    await popup.evaluate(() => {
        const token = new URL(location.href).searchParams.get('__ea_token');
        window.opener.postMessage({ eaFilecrypt: true, payload: { type: 'link-result', token, ok: true, goURL: 'https://evil.test/Go/x.html' } }, '*');
    });
    await page.waitForFunction(() => document.querySelector('.ea-fc-results').value.includes('ERROR'));
    assert.equal(await page.evaluate(() => document.querySelector('.ea-fc-results').value.includes('evil.test')), false);
    await overlay.focus();
    await page.keyboard.press('Escape');
    assert.equal(await overlay.count(), 0);
    assert.equal(await page.locator('.ea-modal[aria-label="Game details"]').isHidden(), false);
});

test('Filecrypt Link page skips an off-site /Go/ candidate before the real one', async t => {
    const page = await open(t);
    await respond(page, 'ea_index_refresh=');
    await page.getByRole('checkbox', { name: 'Show Filecrypt' }).check();
    await page.getByRole('link', { name: 'Alpha', exact: true }).click();
    await respond(page, '/data/alpha.html', gameHTML('Alpha') + '<a href="https://filecrypt.cc/Container/a.html">Filecrypt</a>');
    await page.context().route('https://filecrypt.cc/Link/real.html**', route => route.fulfill({
        contentType: 'text/html',
        body: '<html><body>'
            + '<a href="https://ads.example/Go/x.html">Ad</a>'
            + '<a href="/Go/real.html">Real</a>'
            + '</body></html>'
    }));
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Resolve Filecrypt' }).click();
    await page.locator('.ea-modal[aria-label="Filecrypt resolver"]').waitFor();
    const popup = await popupPromise;
    await popup.evaluate(() => {
        window.opener.postMessage({
            eaFilecrypt: true,
            payload: { type: 'container-ready', rows: [{ filename: 'Pack', linkURL: 'https://filecrypt.cc/Link/real.html' }] }
        }, '*');
    });
    await page.waitForFunction(() => document.querySelector('.ea-fc-results').value.includes('Pack\n'));
    const output = await page.locator('.ea-fc-results').inputValue();
    assert.match(output, /https:\/\/ddownload\.com\/real/);
    assert.doesNotMatch(output, /ads\.example/);
    assert.doesNotMatch(output, /filecrypt\.cc\/Go\//);
});

async function openFilecryptOverlay(t, { useClock = false } = {}) {
    const page = await open(t, { useClock });
    await respond(page, 'ea_index_refresh=');
    await page.getByRole('checkbox', { name: 'Show Filecrypt' }).check();
    await page.getByRole('link', { name: 'Alpha', exact: true }).click();
    await respond(page, '/data/alpha.html', gameHTML('Alpha') + '<a href="https://filecrypt.cc/Container/a.html">Filecrypt</a>');
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Resolve Filecrypt' }).click();
    const overlay = page.locator('.ea-modal[aria-label="Filecrypt resolver"]');
    await overlay.waitFor();
    const popup = await popupPromise;
    assert.equal(await overlay.getByRole('button', { name: 'Copy links' }).count(), 1);
    assert.equal(await overlay.getByRole('button', { name: 'Send to JDownloader' }).count(), 1);
    return { page, overlay, popup };
}

async function postPowStatus(popup, state) {
    await popup.evaluate(state => {
        window.opener.postMessage({ eaFilecrypt: true, payload: { type: 'pow-status', state } }, '*');
    }, state);
}

test('Filecrypt overlay treats a new captcha after Confirmed as failure', async t => {
    const { overlay, popup } = await openFilecryptOverlay(t);
    await postPowStatus(popup, 'done');
    assert.match(await overlay.locator('.ea-empty').innerText(), /Waiting for the download table/);
    await postPowStatus(popup, 'working');
    assert.match(await overlay.locator('.ea-empty').innerText(), /rejected the proof/);
});

test('Filecrypt overlay treats idle after Confirmed as a rejected proof', async t => {
    const { overlay, popup } = await openFilecryptOverlay(t);
    await postPowStatus(popup, 'done');
    await postPowStatus(popup, 'idle');
    assert.match(await overlay.locator('.ea-empty').innerText(), /rejected the proof/);
});

async function openFilecrypt(t, html) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    t.after(() => context.close());
    const body = html.startsWith('<!doctype') || html.startsWith('<!')
        ? html
        : '<!doctype html><html><head></head><body>' + html + '</body></html>';
    await context.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith('blob:') || url.startsWith('data:')) return route.continue();
        if (route.request().isNavigationRequest() && /^https:\/\/(?:www\.)?filecrypt\.cc\//i.test(url)) {
            return route.fulfill({ contentType: 'text/html', body });
        }
        return route.abort();
    });
    const setup = '(' + installMocks.toString() + ')(' + JSON.stringify({}) + ');\n';
    await context.addInitScript({ content: '(() => { const run = () => {\n' + setup + source
        + '\n}; if (document.documentElement) run(); else { const observer = new MutationObserver(() => {'
        + ' if (document.documentElement) { observer.disconnect(); run(); } }); observer.observe(document, { childList: true }); } })();' });
    const page = await context.newPage();
    page.setDefaultTimeout(5_000);
    await page.goto('https://filecrypt.cc/Container/a.html');
    return page;
}

test('Filecrypt PoW helpers inject into the page world', () => {
    assert.match(source, /stopPropagation/);
    assert.match(source, /script\.textContent = '\(' \+ run\.toString\(\) \+ '\)\(\);'/);
    assert.match(source, /window\.open\(containerURL, 'ea-filecrypt'\)/);
    assert.match(source, /__eaSkipPowPause/);
    assert.match(source, /__eaPowClicked/);
    assert.match(source, /Proof-of-work stalled/);
    assert.match(source, /180000/);
    assert.match(source, /Filecrypt ads/);
    assert.match(source, /document\.hasFocus = function \(\) \{ return true; \}/);
    assert.match(source, /runPop/);
    assert.match(source, /killAdBoxes/);
    assert.match(source, /Skip ad/);
    assert.match(source, /ea-fc-click:/);
    assert.match(source, /ea_retry/);
    assert.match(source, /pow_data/);
    assert.match(source, /sigReady/);
    assert.match(source, /127\.0\.0\.1:9666\/flash\/add/);
    assert.doesNotMatch(source, /location\.href = goURL/);
});

test('Filecrypt PoW box click reaches the widget but not document ads listeners', async t => {
    const page = await openFilecrypt(t, `
        <div class="pow-captcha" id="pow-captcha" data-state="idle">
            <div class="pow-captcha__box" role="checkbox">I am a human</div>
        </div>
        <script>
            window.__box = 0;
            window.__doc = 0;
            document.querySelector('.pow-captcha__box').addEventListener('click', function () {
                window.__box += 1;
                document.getElementById('pow-captcha').setAttribute('data-state', 'working');
            });
            document.addEventListener('click', function () { window.__doc += 1; });
        </script>
    `);
    await page.waitForFunction(() => window.__box >= 1);
    assert.equal(await page.evaluate(() => window.__box), 1);
    assert.equal(await page.evaluate(() => window.__doc), 0);
});

test('userscript metadata names the author and project URLs', () => {
    assert.match(source, /@author\s+alfablac/);
    assert.match(source, /@homepage\s+https:\/\/github\.com\/alfablac\/game-night/);
    assert.match(source, /@homepageURL\s+https:\/\/github\.com\/alfablac\/game-night/);
    assert.match(source, /@supportURL\s+https:\/\/github\.com\/alfablac\/game-night\/issues/);
});

test('source contains no stray control characters', () => {
    // Only \n (and \t/\r, if the file ever grows them) are legitimate control characters;
    // anything else (e.g. a literal NUL slipped into a regex) is a bug, not intentional content.
    // eslint-disable-next-line no-control-regex
    assert.doesNotMatch(source, /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
});
