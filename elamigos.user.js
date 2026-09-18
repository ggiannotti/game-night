// ==UserScript==
// @name         ElAmigos Modern UI
// @bound-url    https://elamigos.site/#/
// @namespace    elamigos.modern.ui
// @version      1.5.13
// @description  Responsive dark ElAmigos interface with 12 latest releases, configurable language highlighting, pagination, A–Z archive, compact cards, technical details, details modal, and video.
// @author       alfablac
// @downloadURL  https://raw.githubusercontent.com/alfablac/game-night/main/elamigos.user.js
// @updateURL    https://raw.githubusercontent.com/alfablac/game-night/main/elamigos.user.js
// @homepage     https://github.com/alfablac/game-night
// @homepageURL  https://github.com/alfablac/game-night
// @supportURL   https://github.com/alfablac/game-night/issues
// @match        https://elamigos.site/*
// @match        https://www.elamigos.site/*
// @match        https://filecrypt.cc/*
// @match        https://www.filecrypt.cc/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @connect      elamigos.site
// @connect      www.elamigos.site
// @connect      fastpic.org
// @connect      www.keeplinks.org
// @connect      2captcha.com
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-start
// @changelog    Replaces the game info icon with a styled Info badge and muted YouTube button.
// ==/UserScript==

(function () {
    'use strict';

    var isFilecrypt = /^(?:www\.)?filecrypt\.cc$/i.test(location.hostname);

    if (isFilecrypt) {
        installFilecryptPow();
        var eaToken = '';
        try {
            eaToken = new URL(location.href).searchParams.get('__ea_token') || '';
        } catch (error) { /* keep empty token */ }
        if (window.top !== window || window.opener || eaToken) {
            startFilecryptFrame();
        }
        return;
    }

    // Filecrypt only auto-starts when autosolve is true (it is not). start() needs a
    // real click on .pow-captcha__box. A document click listener opens ads. Stop the
    // bubble in the page world so Filecrypt's box listener still runs.
    function installFilecryptPow() {
        function run() {
            if (window.__eaFilecryptPowGuard) return;
            window.__eaFilecryptPowGuard = true;

            try {
                var aclibRef = { runPop: function () {}, run: function () {}, runAutoTag: function () {}, runBanner: function () {} };
                Object.defineProperty(window, 'aclib', {
                    configurable: true,
                    get: function () { return aclibRef; },
                    set: function (value) {
                        aclibRef = value && typeof value === 'object' ? value : aclibRef;
                        aclibRef.runPop = function () {};
                        aclibRef.run = function () {};
                    }
                });
            } catch (error) { /* ignore */ }

            function killAdBoxes() {
                var nodes = document.querySelectorAll('body *');
                var i;
                var area = window.innerWidth * window.innerHeight;
                for (i = 0; i < nodes.length; i++) {
                    var el = nodes[i];
                    if (el.id === 'pow-captcha' || (el.closest && el.closest('#pow-captcha, #cform'))) {
                        continue;
                    }
                    var label = ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')).replace(/\s+/g, ' ').trim();
                    if (label === 'Skip ad' || label === 'Go to website') {
                        var wrap = el;
                        while (wrap && wrap !== document.body) {
                            var wrapStyle = window.getComputedStyle(wrap);
                            if (wrapStyle.position === 'fixed' || wrapStyle.position === 'absolute' || parseInt(wrapStyle.zIndex, 10) >= 100) {
                                wrap.remove();
                                break;
                            }
                            wrap = wrap.parentElement;
                        }
                        continue;
                    }
                    var style = window.getComputedStyle(el);
                    if (style.position !== 'fixed' && style.position !== 'absolute') {
                        continue;
                    }
                    var z = parseInt(style.zIndex, 10);
                    if (!(z >= 1000)) {
                        continue;
                    }
                    var box = el.getBoundingClientRect();
                    if (box.width * box.height < area * 0.12) {
                        continue;
                    }
                    el.remove();
                }
            }
            setInterval(killAdBoxes, 400);

            try {
                if (typeof Worker !== 'undefined' && Worker.prototype && !Worker.prototype.__eaSkipPowPause) {
                    var origPost = Worker.prototype.postMessage;
                    Worker.prototype.postMessage = function (msg) {
                        if (msg && msg.cmd === 'pause') return;
                        return origPost.apply(this, arguments);
                    };
                    Worker.prototype.__eaSkipPowPause = true;
                }
            } catch (error) { /* keep Filecrypt usable if Worker is frozen */ }

            try {
                document.hasFocus = function () { return true; };
            } catch (error) { /* ignore */ }
            try {
                Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return false; } });
                Object.defineProperty(document, 'visibilityState', { configurable: true, get: function () { return 'visible'; } });
            } catch (error) { /* ignore */ }
            window.addEventListener('blur', function (event) {
                event.stopImmediatePropagation();
            }, true);
            window.addEventListener('visibilitychange', function (event) {
                event.stopImmediatePropagation();
            }, true);

            try {
                var origOpen = window.open;
                window.open = function (url) {
                    var href = url == null ? '' : String(url);
                    if (!href || href === 'about:blank') {
                        return null;
                    }
                    try {
                        var host = new URL(href, location.href).hostname;
                        if (!/(^|\.)filecrypt\.cc$/i.test(host)) {
                            return null;
                        }
                    } catch (error) {
                        return null;
                    }
                    return origOpen.apply(this, arguments);
                };
            } catch (error) { /* ignore */ }

            try {
                if (!EventTarget.prototype.__eaPowAdHook) {
                    var origListen = EventTarget.prototype.addEventListener;
                    EventTarget.prototype.addEventListener = function (type, listener, options) {
                        var capture = options === true || (options && options.capture);
                        if ((type === 'click' || type === 'pointerdown' || type === 'mousedown') && capture && (this === document || this === window) && typeof listener === 'function') {
                            return origListen.call(this, type, function () { /* Filecrypt ads */ }, options);
                        }
                        return origListen.call(this, type, listener, options);
                    };
                    EventTarget.prototype.__eaPowAdHook = true;
                }
            } catch (error) { /* EventTarget frozen */ }

            function guardBox() {
                var box = document.querySelector('#pow-captcha .pow-captcha__box');
                if (!box) {
                    guardBox.waits = (guardBox.waits || 0) + 1;
                    if (guardBox.waits <= 80) setTimeout(guardBox, 250);
                    return;
                }
                if (box.__eaStopAds) return;
                box.__eaStopAds = true;
                box.addEventListener('click', function (event) {
                    event.stopPropagation();
                }, false);
            }

            function sigReady() {
                try {
                    return performance.getEntriesByType('resource').some(function (entry) {
                        return /\/js\/s\.js/i.test(entry.name);
                    });
                } catch (error) {
                    return false;
                }
            }

            function clickKey() {
                var retry = '';
                try {
                    retry = new URL(location.href).searchParams.get('ea_retry') || '';
                } catch (error) {
                    retry = '';
                }
                return 'ea-fc-click:' + location.pathname + ':' + retry;
            }

            function clickOnce() {
                var root = document.getElementById('pow-captcha');
                var state = root && root.getAttribute('data-state');
                if (state && state !== 'idle') return;
                var box = root && root.querySelector('.pow-captcha__box');
                if (!box) {
                    clickOnce.waits = (clickOnce.waits || 0) + 1;
                    if (clickOnce.waits <= 80) setTimeout(clickOnce, 250);
                    return;
                }
                if (!sigReady() && (clickOnce.sigWait || 0) < 8) {
                    clickOnce.sigWait = (clickOnce.sigWait || 0) + 1;
                    setTimeout(clickOnce, 250);
                    return;
                }
                try {
                    if (sessionStorage.getItem(clickKey()) === '1') return;
                } catch (error) { /* ignore */ }
                if (window.__eaPowClicked) return;
                window.__eaPowClicked = true;
                try { sessionStorage.setItem(clickKey(), '1'); } catch (error) { /* ignore */ }
                box.click();
            }

            function armForm() {
                var form = document.getElementById('cform');
                if (!form) {
                    armForm.waits = (armForm.waits || 0) + 1;
                    if (armForm.waits <= 80) setTimeout(armForm, 250);
                    return;
                }
                if (form.__eaPowHold) return;
                form.__eaPowHold = true;
                form.addEventListener('submit', function (event) {
                    var data = form.querySelector('input[name="pow_data"]');
                    if (!data || data.value || form.__eaPowHeld) return;
                    form.__eaPowHeld = true;
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    var tries = 0;
                    var timer = setInterval(function () {
                        tries += 1;
                        if ((data.value && data.value.length) || tries > 30) {
                            clearInterval(timer);
                            try { form.requestSubmit(); } catch (err) { form.submit(); }
                        }
                    }, 100);
                }, true);
            }

            guardBox();
            armForm();
            setTimeout(clickOnce, 900);
        }

        try {
            var script = document.createElement('script');
            script.textContent = '(' + run.toString() + ')();';
            (document.documentElement || document.head).appendChild(script);
            script.remove();
        } catch (error) { /* page CSP may block */ }
    }

    var home = /^\/(?:index\.html?)?$/.test(location.pathname);
    var isGame = /^\/data\//.test(location.pathname);

    if (!home && !isGame) {
        return;
    }

    function startFilecryptFrame() {
        function absolute(url) {
            try {
                return new URL(url, location.href).href;
            } catch (error) {
                return '';
            }
        }

        function sleep(milliseconds) {
            return new Promise(function (resolve) {
                setTimeout(resolve, milliseconds);
            });
        }

        function post(message) {
            // Only the elamigos.site overlay should receive resolver results (a non-matching targetOrigin is silently dropped).
            var envelope = { eaFilecrypt: true, payload: message };
            ['https://elamigos.site', 'https://www.elamigos.site'].forEach(function (origin) {
                try { window.parent.postMessage(envelope, origin); } catch (error) { /* ignore */ }
                try {
                    if (window.opener && window.opener !== window) {
                        window.opener.postMessage(envelope, origin);
                    }
                } catch (error) { /* ignore */ }
            });
        }

        function isFilecryptGoURL(value) {
            try {
                var parsed = new URL(value, location.href);
                return /^https?:$/.test(parsed.protocol) && /^(?:www\.)?filecrypt\.cc$/i.test(parsed.hostname) && /^\/Go\//i.test(parsed.pathname);
            } catch (error) {
                return false;
            }
        }

        function findGoUrl() {
            var nodes = document.querySelectorAll('a[href*="/Go/"],form[action*="/Go/"],[data-url*="/Go/"]');
            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                var value = node.getAttribute('href') || node.getAttribute('action') || node.getAttribute('data-url');
                if (value) {
                    value = absolute(value);
                    if (isFilecryptGoURL(value)) {
                        return value;
                    }
                }
            }
            var matcher = /(?:["'])(https?:\/\/[^"']+\/Go\/[A-Za-z0-9._~-]+\.html|\/Go\/[A-Za-z0-9._~-]+\.html)(?:["'])/gi;
            var match;
            while ((match = matcher.exec(document.documentElement.innerHTML))) {
                var candidate = absolute(match[1]);
                if (isFilecryptGoURL(candidate)) {
                    return candidate;
                }
            }
            return '';
        }

        async function linkPage() {
            var token = new URL(location.href).searchParams.get('__ea_token');
            if (!token) {
                return;
            }

            var started = Date.now();
            while (Date.now() - started < 300000) {
                var goURL = findGoUrl();
                if (goURL) {
                    post({ type: 'link-result', token: token, ok: true, goURL: goURL });
                    return;
                }
                await sleep(250);
            }
            post({ type: 'link-result', token: token, ok: false, error: 'No /Go/ URL was found on the Link page' });
        }

        function containerPage() {
            var sent = false;
            var timer = setInterval(function () {
                var rows = [].slice.call(document.querySelectorAll('table tr')).map(function (row) {
                    var cells = row.querySelectorAll('td');
                    var link = row.querySelector('a.button.download[href*="/Link/"]');
                    if (!link || cells.length < 4) {
                        return null;
                    }
                    return {
                        filename: cells[1].getAttribute('title') || cells[1].innerText.trim(),
                        size: cells[2].innerText.trim(),
                        linkURL: absolute(link.getAttribute('href'))
                    };
                }).filter(Boolean);

                if (rows.length && !sent) {
                    sent = true;
                    post({ type: 'container-ready', rows: rows });
                    clearInterval(timer);
                }
            }, 500);
            setTimeout(function () {
                clearInterval(timer);
            }, 300000);
        }

        function watchPow() {
            var el = document.getElementById('pow-captcha');
            if (!el || typeof MutationObserver === 'undefined') return;
            var last = '';
            function emit() {
                var state = el.getAttribute('data-state') || '';
                if (state && state !== last) {
                    last = state;
                    post({ type: 'pow-status', state: state });
                }
            }
            emit();
            new MutationObserver(emit).observe(el, { attributes: true, attributeFilter: ['data-state'] });
        }

        function run() {
            if (!document.body) {
                document.addEventListener('DOMContentLoaded', run, { once: true });
                return;
            }
            watchPow();
            if (/^\/Link\//i.test(location.pathname)) {
                linkPage();
            } else if (/^\/Container\//i.test(location.pathname)) {
                containerPage();
            }
        }

        run();
    }

    var q = function (selector, root) {
        return (root || document).querySelector(selector);
    };

    var qa = function (selector, root) {
        return [].slice.call((root || document).querySelectorAll(selector));
    };

    var txt = function (element) {
        return (element.textContent || '').replace(/\s+/g, ' ').trim();
    };

    var abs = function (url, base) {
        try {
            var parsed = new URL(url, base || location.href);
            return /^https?:$/.test(parsed.protocol) ? parsed.href : '';
        } catch (error) {
            return '';
        }
    };

    var normalize = function (value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    };

    var E = function (tag, attributes, children) {
        var element = document.createElement(tag);
        var attrs = attributes || {};

        Object.keys(attrs).forEach(function (name) {
            if (name === 'text') {
                element.textContent = attrs[name];
            } else if (name.slice(0, 2) === 'on') {
                element.addEventListener(name.slice(2), attrs[name]);
            } else {
                element.setAttribute(name, attrs[name]);
            }
        });

        (children || []).forEach(function (child) {
            if (child) {
                element.append(child.nodeType ? child : document.createTextNode(child));
            }
        });

        return element;
    };

    var css = `
        :root {
            color-scheme: dark;
            --ea-bg: #171f28;
            --ea-surface: #141c25;
            --ea-panel: #1b2632;
            --ea-panel-raised: #243140;
            --ea-border: #2b3a48;
            --ea-border-strong: #3f5a6d;
            --ea-text: #dce6ed;
            --ea-text-strong: #e8f5fa;
            --ea-muted: #9fb5c4;
            --ea-accent: #82d8ff;
            --ea-accent-hover: #2c7894;
        }
        html.ea-on {
            background: var(--ea-bg) !important;
            overflow-y: scroll !important;
            scrollbar-gutter: stable;
        }
        html.ea-on body {
            margin: 0 !important;
            padding: 0 !important;
            background: var(--ea-bg) !important;
            color: var(--ea-text) !important;
        }
        html.ea-on body > *:not(#ea-app) { display: none !important; }
        #ea-app,
        #ea-app * {
            font-family: Inter, Arial, sans-serif !important;
            box-sizing: border-box;
        }
        #ea-app {
            min-height: 100vh;
            background: var(--ea-bg);
            color: var(--ea-text);
            font: 14px/1.5 Inter, system-ui, Segoe UI, sans-serif;
        }
        .ea-head {
            position: sticky;
            top: 0;
            z-index: 4;
            display: flex;
            gap: 14px;
            align-items: center;
            flex-wrap: wrap;
            min-height: 56px;
            margin: 0 auto;
            padding: 9px 16px;
            background: var(--ea-surface);
            border: 1px solid var(--ea-border);
            border-radius: 10px;
            box-shadow: 0 5px 14px #0003;
            width: min(1380px, calc(100% - 32px));
        }
        .ea-brand {
            font-weight: 700;
            color: var(--ea-text-strong);
            text-decoration: none;
        }
        .ea-brand:hover { color: var(--ea-accent); }
        .ea-brand b { color: var(--ea-accent); }
        .ea-search {
            flex: 1;
            min-width: 220px;
            max-width: 560px;
        }
        .ea-input {
            width: 100%;
            padding: 8px 11px;
            border: 1px solid var(--ea-border-strong);
            border-radius: 8px;
            background: var(--ea-panel);
            color: var(--ea-text-strong);
            outline: none;
        }
        .ea-input:focus { border-color: var(--ea-accent); box-shadow: 0 0 0 2px #82d8ff22; }
        .ea-input::placeholder { color: var(--ea-muted); }
        .ea-tabs { display: flex; gap: 4px; }
        .ea-setting {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: var(--ea-muted);
            font-size: 12px;
            white-space: nowrap;
        }
        .ea-setting input { accent-color: var(--ea-accent); }
        .ea-language-input {
            width: 142px;
            padding: 5px 7px;
            border: 1px solid var(--ea-border-strong);
            border-radius: 7px;
            background: var(--ea-panel);
            color: var(--ea-text-strong);
            outline: none;
            font-size: 12px;
        }
        .ea-language-input:focus { border-color: var(--ea-accent); box-shadow: 0 0 0 2px #82d8ff22; }
        .ea-tab {
            padding: 7px 10px;
            color: var(--ea-muted);
            text-decoration: none;
            border-radius: 7px;
        }
        .ea-tab:hover,
        .ea-tab.on {
            background: var(--ea-panel-raised);
            color: #fff;
        }
        .ea-main {
            max-width: 1380px;
            margin: auto;
            padding: 24px 16px 70px;
        }
        .ea-h1 {
            position: relative;
            margin: 0 0 4px;
            color: #fff !important;
            font-size: 22px;
        }
        .ea-main.ea-recent {
            display: grid;
            grid-template-columns: 1fr;
            gap: 14px;
            align-items: stretch;
        }
        .ea-main.ea-recent > .ea-h1 {
            grid-column: 1 / -1;
        }
        .ea-main.ea-recent > .ea-card { margin: 0; }
        @media (min-width: 768px) {
            .ea-main.ea-recent { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .ea-main.ea-recent > .ea-card { height: 100%; }
            .ea-main.ea-recent > .ea-card .ea-panel { grid-template-rows: auto auto; }
        }
        @media (min-width: 1200px) {
            .ea-head { width: min(1500px, calc(100% - 32px)); }
            .ea-main { max-width: 1500px; }
            .ea-main.ea-recent { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .ea-main.ea-recent > .ea-card .ea-panel { grid-template-rows: auto auto; }
        }
        .ea-card {
            margin: 0;
            padding: 14px;
            background: var(--ea-panel);
            border: 1px solid var(--ea-border);
            border-radius: 12px;
            box-shadow: inset 0 1px #ffffff08, 0 5px 14px #0003;
            transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;
        }
        .ea-card:hover {
            border-color: var(--ea-border-strong);
            box-shadow: inset 0 1px #ffffff0d, 0 7px 18px #0005;
        }
        .ea-panel {
            display: grid;
            grid-template-columns: 155px minmax(0, 1fr);
            grid-template-areas:
                "title title"
                "poster info"
                "links links";
            gap: 18px;
        }
        .ea-title { grid-area: title; }
        .ea-poster { grid-area: poster; min-width: 0; }
        .ea-info-column { grid-area: info; min-width: 0; }
        .ea-cover,
        .ea-ph {
            width: 100%;
            aspect-ratio: 3 / 4;
            object-fit: cover;
            border-radius: 9px;
            background: var(--ea-panel-raised);
            border: 1px solid var(--ea-border);
        }
        .ea-cover {
            height: auto;
            aspect-ratio: auto;
            object-fit: contain;
        }
        .ea-ph {
            display: grid;
            place-items: center;
            color: var(--ea-muted);
            font-size: 20px;
            font-weight: 700;
        }
        .ea-title {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
            margin: 0;
            padding: 0;
            color: var(--ea-text-strong);
            font-size: 16px;
            line-height: 1.2;
        }
        .ea-info-actions { position: relative; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
        .ea-btn.ea-info-badge { position: static; border-color: #527b8b; background: #243744; color: #c9edf6; }
        .ea-btn.ea-info-badge:hover,
        .ea-btn.ea-info-badge:focus-visible { border-color: var(--ea-accent); background: #2b5361; color: #fff; }
        .ea-info-badge .ea-tip { top: calc(100% + 6px); left: 0; max-width: 100%; }
        .ea-info-badge:hover .ea-tip,
        .ea-info-badge:focus-visible .ea-tip { visibility: visible; opacity: 1; }
        .ea-btn.ea-youtube-btn { border-color: #70404a; background: #38252b; color: #f0c8c8; }
        .ea-btn.ea-youtube-btn:hover,
        .ea-btn.ea-youtube-btn:focus-visible { border-color: #a56a72; background: #59343d; color: #fff; }
        .ea-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            color: var(--ea-muted);
            font-size: 12px;
        }
        .ea-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin: 7px 0;
        }
        .ea-badge,
        .ea-chip {
            padding: 2px 7px;
            border: 1px solid var(--ea-border-strong);
            border-radius: 999px;
            background: var(--ea-panel-raised);
            color: var(--ea-text);
            font-size: 11px;
        }
        .ea-specs { display: block; margin-top: 13px; }
        .ea-spec {
            min-width: 0;
            margin: 7px 0;
            padding: 0;
            font-size: 12px;
        }
        .ea-spec b {
            display: inline;
            margin-right: 8px;
            color: var(--ea-muted);
            font-weight: 500;
        }
        .ea-spec span {
            display: inline;
            white-space: normal;
            overflow: visible;
            text-overflow: clip;
        }
        .ea-size-value {
            position: relative;
            border-bottom: 1px dotted var(--ea-accent);
            color: var(--ea-text-strong);
            cursor: help;
        }
        .ea-size-tip {
            position: absolute;
            z-index: 8;
            top: calc(100% + 6px);
            left: 0;
            display: block !important;
            visibility: hidden;
            width: max-content;
            max-width: 220px;
            padding: 6px 8px;
            border: 1px solid var(--ea-border-strong);
            border-radius: 7px;
            background: var(--ea-panel-raised);
            color: var(--ea-text-strong);
            opacity: 0;
            font-size: 11px;
            line-height: 1.3;
            white-space: nowrap !important;
            box-shadow: 0 5px 16px #0009;
            pointer-events: none;
        }
        .ea-size-value:hover .ea-size-tip,
        .ea-size-value:focus .ea-size-tip { visibility: visible; opacity: 1; }
        .ea-language-hit {
            color: var(--ea-accent);
            font-weight: 700;
            text-decoration: underline;
            text-decoration-color: var(--ea-accent);
            text-decoration-thickness: 2px;
            text-underline-offset: 2px;
        }
        .ea-dubbing-hit { color: #a5e57b; text-decoration-color: #a5e57b; }
        .ea-links {
            grid-area: links;
            min-width: 0;
        }
        .ea-links-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 8px;
        }
        .ea-sections {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 10px;
            margin-top: 10px;
        }
        .ea-section {
            overflow: hidden;
            min-width: 0;
            border: 1px solid var(--ea-border-strong);
            border-radius: 8px;
            background: var(--ea-surface);
            box-shadow: inset 0 1px #ffffff05;
        }
        .ea-section + .ea-section { margin-top: 10px; }
        .ea-section > summary {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
            min-height: 40px;
            padding: 10px 12px;
            cursor: pointer;
            color: var(--ea-text-strong);
            font-weight: 600;
        }
        .ea-section > summary::marker { color: var(--ea-accent); }
        .ea-section[open] > summary { color: var(--ea-text-strong); }
        .ea-includes-badge {
            display: inline-flex;
            align-items: center;
            max-width: 100%;
            padding: 3px 7px;
            border: 1px solid #a5e57b;
            border-radius: 999px;
            background: #27452d;
            color: #c8f4ad;
            font-size: 11px;
            font-weight: 600;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .ea-section-body { padding: 4px 12px 10px; }
        .ea-host {
            margin: 0;
            padding: 7px 0;
            background: transparent;
            border: 0;
            border-radius: 0;
        }
        .ea-host strong {
            display: block;
            margin-bottom: 3px;
            color: var(--ea-muted);
            font-size: 12px;
        }
        .ea-host a,
        .kl-link {
            display: block;
            margin: 4px 0;
            color: var(--ea-accent);
            font-size: 12px;
            line-height: 1.4;
            word-break: break-all;
        }
        .kl-out {
            display: block;
            margin-top: 8px;
            padding: 0;
        }
        .kl-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 6px;
            color: var(--ea-text);
            font-size: 12px;
        }
        .ea-video-actions { display: flex; gap: 8px; padding: 10px 0; }
        .ea-video-actions a { color: var(--ea-accent); }
        .ea-btn {
            display: inline-flex;
            flex: 0 0 auto;
            align-items: center;
            justify-content: center;
            min-height: 30px;
            padding: 7px 11px;
            border: 1px solid var(--ea-border-strong);
            border-radius: 7px;
            background: var(--ea-panel-raised);
            color: var(--ea-text-strong);
            cursor: pointer;
            text-decoration: none;
            font-size: 12px;
            line-height: 1.2;
            white-space: nowrap;
        }
        .ea-btn:hover { background: var(--ea-accent-hover); border-color: var(--ea-accent); color: #fff; }
        .ea-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 7px 9px;
            border-radius: 7px;
        }
        .ea-row:hover { background: var(--ea-panel); }
        .ea-row-title {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            color: var(--ea-text);
            text-decoration: none;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .ea-row-actions { display: flex; gap: 5px; }
        .ea-date { margin: 18px 0 5px; color: var(--ea-muted); font-size: 12px; font-weight: 700; }
        .ea-archive-layout {
            display: grid;
            grid-template-columns: 92px minmax(0, 1fr);
            gap: 18px;
            align-items: start;
        }
        .ea-letters {
            position: sticky;
            top: 74px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .ea-letter {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            padding: 6px 8px;
            border: 1px solid var(--ea-border-strong);
            border-radius: 6px;
            background: var(--ea-surface);
            color: var(--ea-text);
            cursor: pointer;
            font-size: 12px;
        }
        .ea-letter small { color: var(--ea-muted); }
        .ea-letter:hover,
        .ea-letter.on { border-color: var(--ea-accent); background: var(--ea-accent-hover); color: #fff; }
        .ea-letter.off { opacity: .4; cursor: default; }
        .ea-pager { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: 18px 0; color: var(--ea-muted); }
        .ea-page { padding: 5px 10px; border: 1px solid var(--ea-border-strong); border-radius: 7px; background: var(--ea-surface); color: var(--ea-text-strong); cursor: pointer; }
        .ea-page.on { border-color: var(--ea-accent); background: var(--ea-accent-hover); color: #fff; }
        .ea-info {
            position: relative;
            display: inline-grid;
            place-items: center;
            width: 17px;
            height: 17px;
            border: 1px solid var(--ea-border-strong);
            border-radius: 50%;
            color: var(--ea-accent);
            cursor: help;
            font-size: 11px;
        }
        .ea-tip {
            position: absolute;
            z-index: 8;
            top: 25px;
            left: 0;
            visibility: hidden;
            width: 330px;
            padding: 9px;
            border: 1px solid var(--ea-border-strong);
            border-radius: 8px;
            background: var(--ea-panel-raised);
            color: var(--ea-text-strong);
            opacity: 0;
            font-size: 12px;
            font-weight: 400;
        }
        .ea-info:hover .ea-tip,
        .ea-info:focus .ea-tip { visibility: visible; opacity: 1; }
        .ea-game-tip {
            box-sizing: border-box;
            width: min(360px, calc(100vw - 32px));
            max-width: calc(100vw - 32px);
            font-size: 14px;
            line-height: 1.45;
            overflow-wrap: anywhere;
            white-space: normal;
        }
        .ea-size-highlight {
            display: block;
            margin-bottom: 5px;
            color: var(--ea-accent);
            font-size: 18px;
            font-weight: 700;
        }
        .ea-info-description { display: block; }
        .ea-page-info { position: static; margin-left: .45rem; vertical-align: middle; }
        .ea-page-info .ea-tip { top: 100%; max-width: 100%; }
        .ea-modal { position: fixed; z-index: 20; inset: 0; display: grid; place-items: center; padding: 20px; background: #080b10cc; backdrop-filter: blur(3px); }
        .ea-modal[hidden] { display: none; }
        .ea-box { width: min(1080px, 100%); max-height: 90vh; overflow: auto; border: 1px solid var(--ea-border-strong); border-radius: 12px; background: var(--ea-surface); box-shadow: 0 12px 32px #0008; }
        .ea-video-box { width: min(900px, 100%); max-height: none; overflow: hidden; }
        .ea-modal-head { position: sticky; top: 0; display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--ea-border); background: var(--ea-surface); }
        .ea-modal-head strong { flex: 1; }
        .ea-modal-body {
            padding: 20px;
            font-size: 15px;
        }
        .ea-modal-body .ea-title { font-size: 20px; }
        .ea-modal-body .ea-spec { font-size: 14px; }
        .ea-modal-body .ea-host strong,
        .ea-modal-body .ea-host a,
        .ea-modal-body .kl-link { font-size: 14px; }
        .ea-modal-body .ea-section > summary,
        .ea-modal-body .ea-links-head { font-size: 15px; }
        .ea-modal-body .ea-btn { font-size: 13px; }
        .ea-video { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; border: 0; }
        .ea-empty { padding: 18px; color: var(--ea-muted); }
        .ea-modal[aria-label="Filecrypt resolver"] .ea-box { width: min(640px, 100%); }
        .ea-modal[aria-label="Filecrypt resolver"] .ea-empty { padding: 12px 16px; }
        .ea-fc-results {
            display: block;
            width: 100%;
            min-height: 180px;
            margin: 0;
            padding: 12px 14px;
            border: 0;
            border-top: 1px solid var(--ea-border);
            background: #0c1218;
            color: var(--ea-text-strong);
            font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            resize: vertical;
        }
        .ea-fc-results::placeholder { color: var(--ea-muted); }
        .ea-fc-toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding: 10px 16px 14px;
            border-top: 1px solid var(--ea-border);
        }
        .ea-spin { color: var(--ea-accent); }
        @media (max-width: 850px) {
            .ea-panel { grid-template-columns: 105px 1fr; }
        }
        @media (max-width: 560px) {
            .ea-head { width: calc(100% - 20px); padding: 10px; }
            .ea-main { padding: 16px 10px; }
            .ea-panel {
                grid-template-columns: 1fr;
                grid-template-areas:
                    "title"
                    "poster"
                    "info"
                    "links";
            }
            .ea-cover,
            .ea-ph { max-width: 180px; }
            .ea-sections { grid-template-columns: 1fr; }
            .ea-archive-layout { grid-template-columns: minmax(0, 1fr); }
            .ea-letters { position: static; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
            .ea-letter { justify-content: center; padding: 7px 3px; }
            .ea-letter small { display: none; }
        }
    `;

    if (typeof GM_addStyle === 'function') {
        GM_addStyle(css);
    } else {
        var style = E('style', { text: css });
        (document.head || document.documentElement).append(style);
    }

    var fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    (document.head || document.documentElement).append(fontLink);
    document.documentElement.classList.add('ea-on');

    var cache = {};
    var coverDbPromise = null;
    var recentAlignmentFrame = 0;
    var index = null;
    var app;
    var main;
    var modal;
    var modalBody;
    var modalRequest = 0;
    var modalOpener;

    function coverCacheDb() {
        if (coverDbPromise) {
            return coverDbPromise;
        }
        if (!window.indexedDB) {
            return Promise.reject(new Error('IndexedDB unavailable'));
        }
        coverDbPromise = new Promise(function (resolve, reject) {
            var request;
            try {
                request = indexedDB.open('ea-cover-cache', 1);
            } catch (error) {
                reject(error);
                return;
            }
            request.onupgradeneeded = function () {
                request.result.createObjectStore('covers');
            };
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error || new Error('Could not open cover cache')); };
        });
        return coverDbPromise;
    }

    function coverCacheGet(url) {
        return coverCacheDb().then(function (db) {
            return new Promise(function (resolve, reject) {
                var request = db.transaction('covers', 'readonly').objectStore('covers').get(url);
                request.onsuccess = function () { resolve(request.result || null); };
                request.onerror = function () { reject(request.error || new Error('Could not read cover cache')); };
            });
        });
    }

    function coverCachePut(url, blob) {
        return coverCacheDb().then(function (db) {
            return new Promise(function (resolve, reject) {
                var request = db.transaction('covers', 'readwrite').objectStore('covers').put(blob, url);
                request.onsuccess = resolve;
                request.onerror = function () { reject(request.error || new Error('Could not write cover cache')); };
            });
        });
    }

    function showCachedCover(image, blob) {
        if (!blob || !blob.size || !window.URL || !URL.createObjectURL) {
            return;
        }
        var objectURL = URL.createObjectURL(blob);
        image.src = objectURL;
        image.addEventListener('load', function () { URL.revokeObjectURL(objectURL); }, { once: true });
    }

    function fetchCoverBlob(url) {
        if (typeof GM_xmlhttpRequest === 'function') {
            return new Promise(function (resolve, reject) {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    responseType: 'blob',
                    onload: function (response) {
                        if ((response.status >= 200 && response.status < 300) || response.status === 0) {
                            resolve(response.response);
                        } else {
                            reject(new Error('Cover request failed'));
                        }
                    },
                    onerror: reject,
                    ontimeout: reject
                });
            });
        }

        var target = new URL(url, location.href);
        if (target.origin !== location.origin || !window.fetch) {
            return Promise.reject(new Error('Cross-origin cover request unavailable'));
        }
        return fetch(target.href, { cache: 'force-cache' }).then(function (response) {
            if (!response.ok) {
                throw new Error('Cover request failed');
            }
            return response.blob();
        });
    }

    function cacheCoverImage(image, url) {
        if (!url || !/^https?:/i.test(url) || !window.indexedDB || (!window.fetch && typeof GM_xmlhttpRequest !== 'function')) {
            image.src = url;
            return;
        }
        coverCacheGet(url).then(function (blob) {
            if (blob && blob.size) {
                showCachedCover(image, blob);
                return null;
            }
            return fetchCoverBlob(url).then(function (freshBlob) {
                if (!freshBlob.size) {
                    return;
                }
                showCachedCover(image, freshBlob);
                return coverCachePut(url, freshBlob).catch(function () {
                    // The image is already usable even if persistence fails.
                });
            });
        }).catch(function () {
            image.src = url;
        });
    }

    function parseHome(doc, base) {
        var blocks = [];
        var current = null;
        var archiveMode = false;
        var seen = {};
        var recent = [];
        var archive = [];

        // The archive is wrapped differently from the recent-release list on
        // some versions of the site. Scan the document headings themselves so
        // nested archive containers are included as well.
        qa('h1, h2, h3, h4, h5, h6', doc).forEach(function (element) {
            var tag = element.tagName;
            var text = txt(element);

            if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
                current = { date: text, items: [] };
                blocks.push(current);
            } else if (/full log of updates/i.test(text)) {
                archiveMode = true;
            } else if (/^H[2-6]$/.test(tag)) {
                var anchor = q('a[href*="data/"]', element);
                if (!anchor) {
                    return;
                }

                var href = abs(anchor.getAttribute('href'), base);
                if (!href || seen[href]) {
                    return;
                }

                var clone = element.cloneNode(true);
                qa('a', clone).forEach(function (link) {
                    link.remove();
                });

                var title = txt(clone)
                    .replace(/\[[^\]]*\]/g, '')
                    .replace(/\+?\s*ElAmigos/i, '')
                    .replace(/(?:\s+\+)+\s*$/, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                var entry = { h: href, t: title || text, d: current ? current.date : '', g: text };

                seen[href] = 1;
                if (archiveMode) {
                    archive.push(entry);
                } else if (current) {
                    current.items.push(entry);
                    recent.push(entry);
                }
            }
        });

        return { blocks: blocks, recent: recent, archive: archive, all: recent.concat(archive) };
    }

    function sizeInMB(value) {
        var match = String(value || '').match(/([\d.,]+)\s*(KB|MB|GB|TB)\b/i);
        if (!match) {
            return null;
        }
        var amount = Number(match[1].replace(/,/g, ''));
        if (!Number.isFinite(amount)) {
            return null;
        }
        var unit = match[2].toUpperCase();
        if (unit === 'KB') {
            return amount / 1024;
        }
        if (unit === 'GB') {
            return amount * 1024;
        }
        if (unit === 'TB') {
            return amount * 1024 * 1024;
        }
        return amount;
    }

    function sizesMatch(first, second) {
        var firstMB = sizeInMB(first);
        var secondMB = sizeInMB(second);
        if (firstMB !== null && secondMB !== null) {
            return Math.abs(firstMB - secondMB) < 0.01;
        }
        return normalize(first).replace(/\s/g, '') === normalize(second).replace(/\s/g, '');
    }

    function sizeInGB(value) {
        var megabytes = sizeInMB(value);
        if (megabytes === null) {
            return '';
        }
        var gigabytes = (megabytes / 1024).toFixed(2).replace(/\.?(?:0+)$/, '');
        return '≈ ' + gigabytes + ' GB';
    }

    function includedUpdateLabel(title) {
        var match = String(title || '').match(/\bupdates?\b\s*(.*?)(?:\s*&\s*|\s+\bcrack\b|$)/i);
        return match && match[1] ? 'Includes update ' + match[1].trim() : 'Includes ' + String(title || '').trim();
    }

    function splitGameTitle(value) {
        var title = String(value || '').trim();
        var match = title.match(/^(.*?),\s*([\d.,]+)\s*(MB|GB|TB)$/i);
        if (!match) {
            return { title: title, size: '' };
        }
        return { title: match[1].trim(), size: match[2] + match[3].toUpperCase() };
    }

    function parseGame(doc, url) {
        var elements = qa('h2, h3, h4, a[href]', doc);
        var firstH2 = q('h2', doc);
        var rawTitle = firstH2 ? txt(firstH2) : String(url).split(/[?#]/)[0].split('/').pop();
        var titleInfo = splitGameTitle(rawTitle);
        var title = titleInfo.title;
        var description = '';
        var image = q('img', doc);
        var specs = [];
        var sections = [];
        var current = { title: 'Base game', groups: [] };
        var group = null;
        var seen = {};

        sections.push(current);

        function isHost(text) {
            return /^(DDOWNLOAD|RAPIDGATOR|TURBOBIT|NITROFLARE|MEGA|1FICHIER|UPTOBOX|KATFILE|HEXUPLOAD|MULTIUPLOAD|DOWNLOAD|HOST)$/i.test(text);
        }

        function isSectionHeading(text) {
            return /^(?:update|updates|patch|hotfix|dlc|bonus|soundtrack|crack|fix|addon|add-on)\b/i.test(text)
                || /^[^,]{1,80}\b(?:update|patch|hotfix|dlc)\b/i.test(text);
        }

        function addSection(name) {
            current = { title: name, groups: [] };
            sections.push(current);
            group = null;
        }

        function addGroup(name) {
            group = current.groups.find(function (item) {
                return item.name === name;
            });
            if (!group) {
                group = { name: name, links: [] };
                current.groups.push(group);
            }
            return group;
        }

        function addLink(href, name) {
            var seenKey = current.title + '\u0000' + href;
            if (!href || href === url || seen[seenKey]) {
                return;
            }
            seen[seenKey] = 1;
            if (!group) {
                group = addGroup('Links');
            }
            group.links.push({ h: href, n: name || href });
        }

        function isDownloadLink(href) {
            return /keeplinks|filecrypt|rapidgator|ddownload|turbobit|nitroflare|mega\.|1fichier|uptobox|katfile|hexupload|multiup|directdownload/i.test(href);
        }

        elements.forEach(function (element) {
            var tag = element.tagName;
            var text = txt(element);

            if (tag === 'A') {
                var href = abs(element.getAttribute('href'), url);
                if (isDownloadLink(href)) {
                    addLink(href, text || href);
                }
                return;
            }

            var spec = text.match(/^([^:]+):\s*(.*)$/);
            var isSpec = spec && /^(upload size \/ to download|iso image size|number of compressions|data recovery|languages|dubbing\/audio)$/i.test(spec[1]);
            if (isSpec) {
                specs.push({ k: spec[1], v: spec[2] });
                return;
            }

            if (tag === 'H2' && text === rawTitle) {
                return;
            }
            if (/^download links?$/i.test(text)) {
                return;
            }
            if (/^base game$/i.test(text)) {
                if (current === sections[0] && !current.groups.length) {
                    current.title = text;
                } else {
                    addSection(text);
                }
                return;
            }
            if (isHost(text)) {
                addGroup(text);
                return;
            }
            if ((tag === 'H2' || isSectionHeading(text)) && text) {
                addSection(text);
                return;
            }
            if (!description && text.length > 35 && !/^(upload size|iso image|number of compressions|data recovery|languages|dubbing\/audio)/i.test(text)) {
                description = text;
            }
        });

        var uploadSize = specs.find(function (spec) { return /^upload size \/ to download$/i.test(spec.k); });
        var isoSize = specs.find(function (spec) { return /^iso image size$/i.test(spec.k); });
        if (uploadSize && isoSize && sizesMatch(uploadSize.v, isoSize.v)) {
            specs = specs.filter(function (spec) { return spec !== isoSize; });
        }
        specs = specs.filter(function (spec) {
            return !/^data recovery$/i.test(spec.k) || !/^none$/i.test(String(spec.v).trim());
        });
        specs = specs.filter(function (spec) {
            if (!/^number of compressions$/i.test(spec.k)) {
                return true;
            }
            return !/^(?:only\s+)?(?:1|one)(?:\s+compressions?)?$/i.test(String(spec.v).trim());
        });

        sections = sections.map(function (section) {
            section.groups = section.groups.filter(function (item) {
                return item.links.length;
            });
            return section;
        }).filter(function (section) {
            return section.groups.length;
        });

        var baseSection = sections.find(function (section) { return /^base game$/i.test(section.title); });
        if (baseSection) {
            baseSection.includesUpdates = [];
            var baseLinks = {};
            baseSection.groups.forEach(function (hostGroup) {
                hostGroup.links.forEach(function (link) { baseLinks[link.h] = true; });
            });
            sections = sections.filter(function (section) {
                if (section === baseSection || !/\b(?:update|updates|patch|hotfix)\b/i.test(section.title)) {
                    return true;
                }
                section.groups.forEach(function (hostGroup) {
                    hostGroup.links = hostGroup.links.filter(function (link) {
                        return !baseLinks[link.h];
                    });
                });
                section.groups = section.groups.filter(function (hostGroup) {
                    return hostGroup.links.length;
                });
                if (!section.groups.length) {
                    baseSection.includesUpdates.push(section.title);
                }
                return section.groups.length;
            });
        }

        var links = [];
        sections.forEach(function (section) {
            section.groups.forEach(function (item) {
                item.links.forEach(function (link) {
                    links.push(link);
                });
            });
        });

        var youtube = qa('a[href]', doc).map(function (anchor) {
            return abs(anchor.getAttribute('href'), url);
        }).find(isYouTubeURL);

        return {
            url: url,
            title: title,
            size: titleInfo.size,
            desc: description,
            cover: image ? abs(image.getAttribute('src'), url) : '',
            spec: specs,
            sections: sections,
            links: links,
            yt: youtube
        };
    }

    function fetchText(url) {
        return new Promise(function (resolve, reject) {
            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({
                    url: url,
                    timeout: 30000,
                    onload: function (response) {
                        if (response.status >= 200 && response.status < 300) {
                            resolve(response.responseText);
                        } else {
                            reject(new Error('HTTP ' + response.status + ' for ' + url));
                        }
                    },
                    onerror: reject,
                    ontimeout: function () { reject(new Error('Request timed out for ' + url)); },
                    onabort: function () { reject(new Error('Request aborted for ' + url)); }
                });
            } else {
                var controller = new AbortController();
                var timer = setTimeout(function () { controller.abort(); }, 30000);
                fetch(url, { signal: controller.signal }).then(function (response) {
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status + ' for ' + url);
                    }
                    return response.text();
                }).then(function (text) {
                    clearTimeout(timer);
                    resolve(text);
                }, function (error) {
                    clearTimeout(timer);
                    reject(error);
                });
            }
        });
    }

    function game(url, force) {
        if (!force && cache[url] && Date.now() - cache[url].t < 86400000) {
            return Promise.resolve(cache[url].d);
        }
        return fetchText(url).then(function (text) {
            var data = parseGame(new DOMParser().parseFromString(text, 'text/html'), url);
            cache[url] = { t: Date.now(), d: data };
            return data;
        });
    }

    var indexCacheKey = 'ea-index-v3';
    var indexCacheTtl = 10 * 60 * 1000;
    var indexPromise = null;

    function validIndex(data) {
        return data && ['recent', 'archive', 'all'].every(function (key) {
            return Array.isArray(data[key]) && data[key].every(function (entry) {
                return entry && typeof entry.t === 'string' && typeof entry.h === 'string' && abs(entry.h);
            });
        }) && data.all.length > 0;
    }

    function loadIndex() {
        if (index) {
            return Promise.resolve(index);
        }
        // Share the in-flight request so views rendered before the index
        // arrives neither refetch it nor finish out of order.
        if (indexPromise) {
            return indexPromise;
        }

        // Refresh the homepage index directly; other pages may use a
        // short-lived cache so new releases appear without manual cleanup.
        var saved = null;
        if (!home) {
            try {
                saved = localStorage.getItem(indexCacheKey);
            } catch (error) {
                // Storage may be disabled; fetch a fresh index instead.
            }
        }
        if (saved) {
            try {
                var cached = JSON.parse(saved);
                if (cached && validIndex(cached.data) && typeof cached.savedAt === 'number'
                    && Date.now() >= cached.savedAt && Date.now() - cached.savedAt < indexCacheTtl) {
                    index = cached.data;
                    return Promise.resolve(index);
                }
            } catch (error) {
                // Ignore an invalid cache and fetch a fresh index.
            }
        }

        var indexURL = location.origin + '/?ea_index_refresh=' + Date.now();
        var promise = fetchText(indexURL).then(function (text) {
            return parseHome(new DOMParser().parseFromString(text, 'text/html'), indexURL);
        }).then(function (data) {
            if (data.recent.length || data.archive.length) {
                return data;
            }
            return home ? parseHome(document) : data;
        }).catch(function (error) {
            if (home) {
                return parseHome(document);
            }
            throw error;
        });

        indexPromise = promise.then(function (data) {
            if (!validIndex(data)) {
                throw new Error('No releases found in the index');
            }
            index = data;
            try {
                localStorage.setItem(indexCacheKey, JSON.stringify({ savedAt: Date.now(), data: data }));
            } catch (error) {
                // Storage may be disabled; the in-memory index still works.
            }
            return data;
        }).catch(function (error) {
            indexPromise = null;
            throw error;
        });
        return indexPromise;
    }

    var klKey = String((typeof GM_getValue === 'function' && GM_getValue('ea_kl_key', '')) || '');
    var storedFilecrypt = typeof GM_getValue === 'function' ? GM_getValue('ea_show_filecrypt', false) : false;
    var showFilecrypt = storedFilecrypt === true || storedFilecrypt === 'true';
    var storedTargetLanguage = typeof GM_getValue === 'function' ? GM_getValue('ea_target_language', 'Portuguese-Brazil') : 'Portuguese-Brazil';
    var targetLanguage = String(storedTargetLanguage || '').trim();

    function escapeRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function languageValue(spec) {
        var value = String(spec.v || '');
        var targetWords = targetLanguage.split(/[\s-]+/).filter(Boolean);
        if (!/^(languages|dubbing\/audio)$/i.test(spec.k) || !targetWords.length) {
            return E('span', { text: value });
        }

        var pattern = targetWords.map(escapeRegex).join('[\\s-]+');
        var matcher = new RegExp(pattern, 'gi');
        var fragment = document.createDocumentFragment();
        var last = 0;
        var match;
        var hitClass = /^dubbing\/audio$/i.test(spec.k) ? 'ea-language-hit ea-dubbing-hit' : 'ea-language-hit';
        while ((match = matcher.exec(value))) {
            if (match.index > last) {
                fragment.append(document.createTextNode(value.slice(last, match.index)));
            }
            fragment.append(E('span', { class: hitClass, text: match[0] }));
            last = match.index + match[0].length;
        }
        if (!last) {
            return E('span', { text: value });
        }
        if (last < value.length) {
            fragment.append(document.createTextNode(value.slice(last)));
        }
        return E('span', {}, [fragment]);
    }

    function isFilecryptLink(link) {
        return /filecrypt\.cc/i.test(link.h || link);
    }

    // Strict check for URLs that get framed; isFilecryptLink stays loose because it only toggles visibility.
    function isFilecryptURL(value) {
        try {
            var parsed = new URL(value);
            return /^https?:$/.test(parsed.protocol) && /^(?:www\.)?filecrypt\.cc$/i.test(parsed.hostname);
        } catch (error) {
            return false;
        }
    }

    function isFilecryptGoURL(value) {
        try {
            return isFilecryptURL(value) && /^\/Go\//i.test(new URL(value).pathname);
        } catch (error) {
            return false;
        }
    }

    // Host-anchored, symmetric with isFilecryptURL: a substring test like /keeplinks/i.test(url) would
    // also match e.g. http://192.168.0.1/x?keeplinks=1, sending that host a privileged background request.
    function isKeeplinksURL(value) {
        try {
            var parsed = new URL(value);
            return /^https?:$/.test(parsed.protocol) && /^(?:www\.)?keeplinks\.org$/i.test(parsed.hostname);
        } catch (error) {
            return false;
        }
    }

    function isYouTubeURL(value) {
        try {
            var parsed = new URL(value);
            return /^https?:$/.test(parsed.protocol) && /^(?:www\.|m\.)?(?:youtube\.com|youtu\.be)$/i.test(parsed.hostname);
        } catch (error) {
            return false;
        }
    }

    function bindModalKeys(dialog, onClose) {
        dialog.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onClose();
            } else if (event.key === 'Tab') {
                var focusable = qa('a[href], button, input, textarea, summary, [tabindex]', dialog).filter(function (element) {
                    return !element.disabled && element.tabIndex >= 0 && element.getClientRects().length;
                });
                var first = focusable[0];
                var last = focusable[focusable.length - 1];
                if (!first) {
                    event.preventDefault();
                    dialog.focus();
                    return;
                }
                if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
                    event.preventDefault();
                    (event.shiftKey ? last : first).focus();
                }
            }
        });
    }

    function klHttp(options) {
        return new Promise(function (resolve, reject) {
            GM_xmlhttpRequest({
                url: options.url,
                method: options.method || 'GET',
                headers: options.headers,
                data: options.body,
                responseType: options.bin ? 'arraybuffer' : 'text',
                onload: resolve,
                onerror: reject,
                ontimeout: reject
            });
        });
    }

    function klMenu() {
        var key = prompt('API key da 2Captcha:', klKey);
        if (key !== null) {
            klKey = key.trim();
            if (typeof GM_setValue === 'function') {
                GM_setValue('ea_kl_key', klKey);
            }
        }
    }

    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('Configurar API key 2Captcha', klMenu);
    }

    function klB64(buffer) {
        var bytes = new Uint8Array(buffer);
        var result = '';
        for (var i = 0; i < bytes.length; i += 8192) {
            result += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
        }
        return btoa(result);
    }

    async function klSolve(id, report) {
        for (var i = 0; i < 38; i += 1) {
            if (report) {
                report('Waiting for captcha result (' + (i + 1) + '/38)…');
            }
            await new Promise(function (resolve) { setTimeout(resolve, i ? 4000 : 6000); });
            var response = await klHttp({ url: 'https://2captcha.com/res.php?key=' + encodeURIComponent(klKey) + '&action=get&id=' + encodeURIComponent(id) + '&json=1' });
            var data = JSON.parse(response.responseText);
            if (String(data.status) === '1') {
                return data.request;
            }
            if (data.request !== 'CAPCHA_NOT_READY') {
                throw Error(data.request);
            }
        }
        throw Error('Tempo limite do captcha');
    }

    function copyLinks(links, button) {
        var text = links.map(function (link) { return typeof link === 'string' ? link : link.h; }).join('\n');
        var copied = function () {
            var oldText = button.textContent;
            button.textContent = 'Copiado';
            setTimeout(function () { button.textContent = oldText; }, 1400);
        };
        var failed = function () {
            var oldText = button.textContent;
            button.textContent = 'Copy failed';
            setTimeout(function () { button.textContent = oldText; }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(copied).catch(function () { fallbackCopy(text, copied, failed); });
        } else {
            fallbackCopy(text, copied, failed);
        }
    }

    function fallbackCopy(text, done, fail) {
        var previousActiveElement = document.activeElement;
        var textarea = E('textarea', { text: text, 'aria-hidden': 'true' });
        textarea.setAttribute('tabindex', '-1');
        textarea.style.cssText = 'position:fixed;opacity:0;width:1px;height:1px;left:0;top:0;';
        (app && app.isConnected ? app : document.body).append(textarea);
        textarea.focus();
        textarea.select();
        try {
            if (document.execCommand('copy')) {
                done();
            } else if (fail) {
                fail();
            }
        } finally {
            textarea.remove();
            if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
                previousActiveElement.focus();
            }
        }
    }

    function resolvedLinks(box, links) {
        box.replaceChildren();
        var copy = E('button', { class: 'ea-btn', text: 'Copy all' });
        copy.addEventListener('click', function () { copyLinks(links, copy); });
        var capturedHeader = document.createElement('div');
        capturedHeader.className = 'kl-head';
        var capturedLabel = document.createElement('strong');
        capturedLabel.textContent = 'Captured links: ' + String(links.length);
        capturedHeader.appendChild(capturedLabel);
        capturedHeader.appendChild(copy);
        box.appendChild(capturedHeader);

        var list = document.createElement('div');
        list.className = 'kl-list';
        for (var i = 0; i < links.length; i += 1) {
            var link = document.createElement('a');
            link.className = 'kl-link';
            link.href = links[i];
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = links[i] + ' ↗';
            list.appendChild(link);
        }
        box.appendChild(list);
    }

    async function resolveKL(url, box) {
        try {
            var report = function (message) {
                box.replaceChildren(E('span', { class: 'ea-spin', text: message }));
            };

            if (!isKeeplinksURL(url)) {
                throw Error('Blocked host');
            }

            if (!klKey) {
                report('Opening Keeplinks…');
                klMenu();
                if (!klKey) {
                    throw Error('API key not configured');
                }
            }

            report('Opening Keeplinks…');
            var response = await klHttp({ url: url });
            report('Checking response…');
            var doc = new DOMParser().parseFromString(response.responseText, 'text/html');
            var live = doc.querySelector('.form_box.livelbl');

            if (!live) {
                var form = doc.querySelector('form#frmprotect');
                if (!form) {
                    throw Error('Keeplinks form not found');
                }

                report('Loading form…');
                response = await klHttp({ url: url, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'showpageval=1' });
                doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                form = doc.querySelector('form#frmprotect');
                live = doc.querySelector('.form_box.livelbl');

                if (!live) {
                    var values = {};
                    [].slice.call(form.querySelectorAll('input,select,textarea')).forEach(function (input) {
                        if (input.name) {
                            values[input.name] = input.value || '';
                        }
                    });
                    if (values.hiddenpwd || values.myhiddenpwd) {
                        throw Error('Link protegido por senha');
                    }
                    if (values.captchatype !== 'Cool') {
                        throw Error('Unsupported captcha');
                    }

                    report('Downloading captcha…');
                    var image = await klHttp({ url: 'https://www.keeplinks.org/coolcaptcha/captcha.php?_=' + Date.now(), responseType: 'arraybuffer', bin: true });
                    report('Sending captcha…');
                    var captcha = await klHttp({
                        url: 'https://2captcha.com/in.php',
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            key: klKey,
                            json: '1',
                            method: 'base64',
                            body: klB64(image.response)
                        }).toString()
                    });
                    var captchaData = JSON.parse(captcha.responseText);
                    if (String(captchaData.status) !== '1') {
                        throw Error(captchaData.request);
                    }

                    values.captcha_cool = await klSolve(captchaData.request, report);
                    report('Submitting result…');
                    response = await klHttp({
                        url: url,
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams(values).toString()
                    });
                    doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                    live = doc.querySelector('.form_box.livelbl');
                }
            }

            if (!live) {
                throw Error('Links not found');
            }

            report('Extracting links…');
            var links = [];
            [].slice.call(live.querySelectorAll('a[href]')).forEach(function (anchor) {
                var href = abs(anchor.getAttribute('href'), url);
                if (href && links.indexOf(href) < 0) {
                    links.push(href);
                }
            });
            if (!links.length) {
                throw Error('Links not found');
            }
            resolvedLinks(box, links);
        } catch (error) {
            box.replaceChildren(
                E('span', { text: 'Keeplinks: ' + error.message + ' ' }),
                E('button', {
                    class: 'ea-btn',
                    text: 'Try again',
                    onclick: function () {
                        resolveKL(url, box);
                    }
                })
            );
        }
    }

    function openFilecryptOverlay(containerURL) {
        var overlayOpener = document.activeElement;
        var overlay = E('div', { class: 'ea-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Filecrypt resolver', tabindex: '-1' });
        var box = E('div', { class: 'ea-box' });
        var header = E('div', { class: 'ea-modal-head' });
        var title = E('strong', { text: 'Filecrypt resolver' });
        var close = E('button', { class: 'ea-btn', type: 'button', text: 'Close' });
        var status = E('div', { class: 'ea-empty', text: 'Opening Filecrypt…' });
        var output = E('textarea', { class: 'ea-fc-results', readonly: '', placeholder: 'Resolved /Go/ URLs will appear here', 'aria-label': 'Resolved Filecrypt links' });
        var copyBtn = E('button', { class: 'ea-btn', type: 'button', text: 'Copy links' });
        var jdBtn = E('button', { class: 'ea-btn', type: 'button', text: 'Send to JDownloader' });
        var toolbar = E('div', { class: 'ea-fc-toolbar' }, [copyBtn, jdBtn]);
        var state = { rows: [], index: 0, pending: null, powState: '', workingSince: 0, stallReload: false };
        var popup = null;

        function goUrls() {
            return (output.value.match(/https:\/\/(?:www\.)?filecrypt\.cc\/Go\/\S+/gi) || []);
        }

        function child() {
            return popup && !popup.closed ? popup : null;
        }

        function offerOpenSeparately() {
            if (status.querySelector('a.ea-btn')) {
                return;
            }
            status.append(E('a', { class: 'ea-btn', href: containerURL, target: '_blank', rel: 'opener', text: 'Open Filecrypt separately' }));
        }

        function closeOverlay() {
            window.removeEventListener('message', onMessage);
            clearInterval(stallTimer);
            if (child()) {
                try { popup.close(); } catch (error) { /* ignore */ }
            }
            overlay.remove();
            if (overlayOpener && overlayOpener.isConnected) {
                overlayOpener.focus();
            }
        }

        function processNext() {
            if (state.index >= state.rows.length) {
                status.textContent = 'Finished: ' + state.rows.length + ' item(s)';
                if (child()) {
                    try { popup.close(); } catch (error) { /* ignore */ }
                }
                return;
            }
            var row = state.rows[state.index];
            if (!row || !isFilecryptURL(row.linkURL)) {
                output.value += (row && row.filename ? row.filename : 'unknown') + '\nERROR: invalid link\n\n';
                output.scrollTop = output.scrollHeight;
                state.index += 1;
                setTimeout(processNext, 0);
                return;
            }
            var win = child();
            if (!win) {
                status.textContent = 'Filecrypt tab was closed. Open it again to resolve links.';
                offerOpenSeparately();
                return;
            }
            var token = String(Date.now()) + '-' + Math.random().toString(36).slice(2);
            var linkURL = new URL(row.linkURL);
            linkURL.searchParams.set('__ea_token', token);
            state.pending = { token: token, row: row };
            status.textContent = 'Resolving ' + (state.index + 1) + '/' + state.rows.length + ': ' + row.filename;
            win.location.href = linkURL.href;
        }

        function onMessage(event) {
            if (!/^https:\/\/(?:www\.)?filecrypt\.cc$/i.test(event.origin)) {
                return;
            }
            var message = event.data || {};
            var payload = message.payload || {};
            if (!message.eaFilecrypt) {
                return;
            }
            if (event.source && (!popup || popup.closed)) {
                popup = event.source;
            }
            if (child() && event.source !== popup) {
                return;
            }
            if (payload.type === 'pow-status') {
                var previous = state.powState;
                if (payload.state) {
                    state.powState = payload.state;
                }
                if ((payload.state === 'working' || payload.state === 'idle') && previous === 'done') {
                    status.textContent = 'Filecrypt rejected the proof and issued a new captcha.';
                    return;
                }
                if (payload.state === 'idle' && previous !== 'done') {
                    state.workingSince = 0;
                }
                if (payload.state === 'working') {
                    if (!state.workingSince) {
                        state.workingSince = Date.now();
                    }
                    status.textContent = 'Solving Filecrypt proof-of-work…';
                    if (child()) {
                        try { popup.focus(); } catch (error) { /* ignore */ }
                    }
                } else if (payload.state === 'done') {
                    state.workingSince = 0;
                    status.textContent = 'Proof-of-work finished. Waiting for the download table…';
                } else if (payload.state === 'fail') {
                    status.textContent = 'Filecrypt proof-of-work failed.';
                }
                return;
            }
            if (payload.type === 'container-ready') {
                state.rows = Array.isArray(payload.rows) ? payload.rows : [];
                if (!state.rows.length) {
                    status.textContent = 'No Filecrypt links found.';
                    return;
                }
                status.textContent = 'Verification complete. Resolving ' + state.rows.length + ' link(s)…';
                processNext();
                return;
            }
            if (payload.type !== 'link-result' || !state.pending || payload.token !== state.pending.token) {
                return;
            }
            var row = state.pending.row;
            if (payload.ok && isFilecryptGoURL(payload.goURL)) {
                output.value += row.filename + '\n' + payload.goURL + '\n\n';
            } else {
                output.value += row.filename + '\nERROR: ' + (payload.ok ? 'invalid link' : payload.error) + '\n\n';
            }
            output.scrollTop = output.scrollHeight;
            state.pending = null;
            state.index += 1;
            setTimeout(processNext, 500);
        }

        try {
            popup = window.open(containerURL, 'ea-filecrypt');
        } catch (error) {
            popup = null;
        }

        header.append(title, close);
        close.addEventListener('click', closeOverlay);
        copyBtn.addEventListener('click', function () {
            copyLinks(goUrls(), copyBtn);
        });
        jdBtn.addEventListener('click', function () {
            var urls = goUrls();
            if (!urls.length) {
                return;
            }
            var restore = jdBtn.textContent;
            var done = function (ok) {
                jdBtn.textContent = ok ? 'Sent to JDownloader' : 'JDownloader offline';
                setTimeout(function () { jdBtn.textContent = restore; }, 1800);
            };
            if (typeof GM_xmlhttpRequest !== 'function') {
                done(false);
                return;
            }
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'http://127.0.0.1:9666/flash/add',
                data: 'urls=' + encodeURIComponent(urls.join('\r\n')),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                onload: function (response) { done(response.status >= 200 && response.status < 300); },
                onerror: function () { done(false); }
            });
        });
        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) {
                closeOverlay();
            }
        });
        box.append(header, status, output, toolbar);
        overlay.append(box);
        bindModalKeys(overlay, closeOverlay);
        window.addEventListener('message', onMessage);
        var stallTimer = setInterval(function () {
            if (!overlay.isConnected) {
                clearInterval(stallTimer);
                return;
            }
            if (state.powState !== 'working' || state.stallReload || !child() || !state.workingSince) {
                return;
            }
            if (Date.now() - state.workingSince < 180000) {
                return;
            }
            state.stallReload = true;
            status.textContent = 'Proof-of-work stalled. Retrying in the Filecrypt tab…';
            try {
                var retry = new URL(containerURL);
                retry.searchParams.set('ea_retry', String(Date.now()));
                popup.location.href = retry.href;
            } catch (error) { /* ignore */ }
        }, 5000);
        app.append(overlay);
        if (!popup) {
            overlay.focus();
            status.textContent = 'Popup blocked. Open Filecrypt in a tab (first-party cookies).';
            offerOpenSeparately();
        } else {
            status.textContent = 'Opened Filecrypt in a tab. Solving proof-of-work…';
            try { popup.focus(); } catch (error) { /* ignore */ }
        }
    }

    function panel(data, entry) {
        var panelElement = E('div', { class: 'ea-panel' });
        var left = E('div', { class: 'ea-poster' });
        var middle = E('div', { class: 'ea-info-column' });
        var linksElement = E('div', { class: 'ea-links' });

        if (data.cover) {
            var cover = E('img', { class: 'ea-cover', alt: '', loading: 'lazy', decoding: 'async' });
            cacheCoverImage(cover, data.cover);
            left.append(cover);
        } else {
            left.append(E('div', { class: 'ea-ph', text: (data.title || '?').slice(0, 2) }));
        }
        var heading = E('h2', { class: 'ea-title' }, [data.title]);
        var infoActions = E('div', { class: 'ea-info-actions' });
        if (data.desc || data.size) {
            var infoTip = E('span', { class: 'ea-tip ea-game-tip' });
            if (data.size) {
                infoTip.append(E('strong', { class: 'ea-size-highlight', text: data.size }));
            }
            if (data.desc) {
                infoTip.append(E('span', { class: 'ea-info-description', text: data.desc }));
            }
            infoActions.append(E('button', { class: 'ea-btn ea-info-badge', type: 'button', text: 'Info' }, [infoTip]));
        }
        if (data.yt) {
            infoActions.append(E('button', {
                class: 'ea-btn ea-youtube-btn',
                type: 'button',
                text: '▶ YouTube',
                title: 'Open YouTube video',
                onclick: function () {
                    video(data.yt);
                }
            }));
        }
        if (infoActions.childNodes.length) {
            middle.append(infoActions);
        }
        if (entry && entry.g) {
            middle.append(E('div', { class: 'ea-badges' }, entry.g.match(/\[[^\]]+\]|Update[^\s]*/gi) || []));
        }
        if (data.spec.length) {
            var specElement = E('div', { class: 'ea-specs' });
            data.spec.forEach(function (spec) {
                var convertedSize = sizeInGB(spec.v);
                var value = convertedSize
                    ? E('span', { class: 'ea-size-value', tabindex: '0', title: 'Show in GB' }, [spec.v, E('span', { class: 'ea-size-tip', text: convertedSize })])
                    : languageValue(spec);
                specElement.append(E('div', { class: 'ea-spec' }, [E('b', { text: spec.k }), value]));
            });
            middle.append(specElement);
        }

        var visibleLinks = data.links.filter(function (link) {
            return showFilecrypt || !isFilecryptLink(link);
        });
        var copyAll = E('button', { class: 'ea-btn', text: 'Copy all' });
        copyAll.addEventListener('click', function () { copyLinks(visibleLinks, copyAll); });
        linksElement.append(E('div', { class: 'ea-links-head' }, [E('strong', { text: 'Links' }), copyAll]));

        (data.sections || []).forEach(function (section) {
            var sectionElement = E('details', { class: 'ea-section' });
            sectionElement.open = true;
            var summary = E('summary', { text: section.title });
            (section.includesUpdates || []).forEach(function (updateTitle) {
                summary.append(E('span', {
                    class: 'ea-includes-badge',
                    text: includedUpdateLabel(updateTitle),
                    title: updateTitle
                }));
            });
            sectionElement.append(summary);
            var sectionBody = E('div', { class: 'ea-section-body' });

            var visibleGroups = section.groups.map(function (hostGroup) {
                return {
                    name: hostGroup.name,
                    links: hostGroup.links.filter(function (link) {
                        return showFilecrypt || !isFilecryptLink(link);
                    })
                };
            }).filter(function (hostGroup) {
                return hostGroup.links.length;
            });
            if (!visibleGroups.length) {
                return;
            }

            visibleGroups.forEach(function (hostGroup) {
                var host = E('div', { class: 'ea-host' }, [E('strong', { text: hostGroup.name })]);
                hostGroup.links.forEach(function (link) {
                    host.append(E('a', { href: link.h, target: '_blank', rel: 'noopener', text: link.h }));
                    if (isFilecryptURL(link.h)) {
                        host.append(E('button', {
                            class: 'ea-btn',
                            type: 'button',
                            text: 'Resolve Filecrypt',
                            onclick: function () {
                                openFilecryptOverlay(link.h);
                            }
                        }));
                    }
                    if (isKeeplinksURL(link.h)) {
                        var output = E('div', { class: 'kl-out' });
                        host.append(E('button', { class: 'ea-btn', text: 'Resolve Keeplinks', onclick: function () { resolveKL(link.h, output); } }), output);
                    }
                });
                sectionBody.append(host);
            });

            sectionElement.append(sectionBody);
            linksElement.append(sectionElement);
        });

        panelElement.append(heading, left, middle, linksElement);
        return panelElement;
    }

    function recentColumnCount() {
        return window.innerWidth >= 1200 ? 3 : window.innerWidth >= 768 ? 2 : 1;
    }

    function alignRecentRows() {
        recentAlignmentFrame = 0;
        if (!main || !main.classList.contains('ea-recent')) {
            return;
        }

        var cards = qa('.ea-card', main);
        cards.forEach(function (cardElement) {
            var cardPanel = q('.ea-panel', cardElement);
            if (cardPanel) {
                cardPanel.style.removeProperty('grid-template-rows');
            }
        });

        var columns = recentColumnCount();
        if (columns === 1) {
            return;
        }
        for (var start = 0; start < cards.length; start += columns) {
            var row = cards.slice(start, start + columns);
            var titleHeight = 0;
            var metadataHeight = 0;
            row.forEach(function (cardElement) {
                var cardPanel = q('.ea-panel', cardElement);
                var titleElement = cardPanel && q('.ea-title', cardPanel);
                var linksElement = cardPanel && q('.ea-links', cardPanel);
                if (cardPanel && titleElement && linksElement) {
                    var panelBox = cardPanel.getBoundingClientRect();
                    var titleBox = titleElement.getBoundingClientRect();
                    var linksBox = linksElement.getBoundingClientRect();
                    var rowGap = parseFloat(getComputedStyle(cardPanel).rowGap) || 0;
                    titleHeight = Math.max(titleHeight, titleBox.height);
                    metadataHeight = Math.max(metadataHeight, linksBox.top - panelBox.top - titleBox.height - (rowGap * 2));
                }
            });
            if (titleHeight && metadataHeight >= 0) {
                row.forEach(function (cardElement) {
                    var cardPanel = q('.ea-panel', cardElement);
                    if (cardPanel) {
                        cardPanel.style.gridTemplateRows = titleHeight + 'px ' + metadataHeight + 'px auto';
                    }
                });
            }
        }
    }

    function scheduleRecentAlignment() {
        if (recentAlignmentFrame || !window.requestAnimationFrame) {
            if (!window.requestAnimationFrame) {
                alignRecentRows();
            }
            return;
        }
        recentAlignmentFrame = window.requestAnimationFrame(alignRecentRows);
    }

    function card(entry) {
        var cardElement = E('article', { class: 'ea-card' });
        cardElement.append(E('div', { class: 'ea-empty', text: 'Loading ' + entry.t + '…' }));
        game(entry.h).then(function (data) {
            cardElement.replaceChildren(panel(data, entry));
            qa('img', cardElement).forEach(function (image) {
                image.addEventListener('load', scheduleRecentAlignment);
            });
            scheduleRecentAlignment();
        }).catch(function () {
            cardElement.replaceChildren(E('div', { class: 'ea-empty', text: 'Could not load ' + entry.t }));
            scheduleRecentAlignment();
        });
        return cardElement;
    }

    function row(entry) {
        return E('div', { class: 'ea-row' }, [
            E('a', { class: 'ea-row-title', href: entry.h, text: entry.t, onclick: function (event) { event.preventDefault(); openGame(entry.h, entry.t); } }),
            E('a', { class: 'ea-btn', href: entry.h, target: '_blank', rel: 'noopener', text: '↗' })
        ]);
    }

    function pager(page, pages, callback) {
        var pagerElement = E('div', { class: 'ea-pager' });
        for (var i = 1; i <= pages; i += 1) {
            if (i < 3 || i > pages - 2 || Math.abs(i - page) <= 1) {
                pagerElement.append(E('button', { class: 'ea-page' + (i === page ? ' on' : ''), text: i, onclick: function () { callback(+this.textContent); } }));
            }
        }
        return pagerElement;
    }

    function pageHeading(title, info) {
        return E('h1', { class: 'ea-h1' }, [
            title,
            E('span', { class: 'ea-info ea-page-info', tabindex: '0', text: 'i', title: info }, [E('span', { class: 'ea-tip', text: info })])
        ]);
    }

    function viewRecent() {
        return loadIndex().then(function (data) {
            main.classList.add('ea-recent');
            main.replaceChildren(pageHeading('Latest releases', '12 latest releases'));
            data.recent.slice(0, 12).forEach(function (entry) { main.append(card(entry)); });
            scheduleRecentAlignment();
        });
    }

    function viewAll(page) {
        return loadIndex().then(function (data) {
            main.classList.remove('ea-recent');
            var pageSize = 25;
            var total = data.recent.length;
            var pages = Math.max(1, Math.ceil(total / pageSize));
            page = Math.max(1, Math.min(page || 1, pages));
            main.replaceChildren(pageHeading('Releases', total + ' releases in chronological order'));
            var start = (page - 1) * pageSize;
            data.recent.slice(start, start + pageSize).forEach(function (entry) { main.append(row(entry)); });
            main.append(pager(page, pages, function (number) { location.hash = '#/all?p=' + number; }));
        });
    }

    function archiveKey(entry) {
        var first = normalize(entry.t).charAt(0).toUpperCase();
        return /^[A-Z]$/.test(first) ? first : '0-9';
    }

    function viewArchive(query, letter) {
        return loadIndex().then(function (data) {
            main.classList.remove('ea-recent');
            var entries = data.all;
            if (query) {
                var normalizedQuery = normalize(query);
                entries = entries.filter(function (entry) { return normalize(entry.t + ' ' + entry.g).indexOf(normalizedQuery) >= 0; });
            }
            entries = entries.slice().sort(function (a, b) {
                return normalize(a.t).localeCompare(normalize(b.t));
            });

            var letters = ['0-9'];
            for (var code = 65; code <= 90; code += 1) {
                letters.push(String.fromCharCode(code));
            }

            var counts = {};
            entries.forEach(function (entry) {
                var key = archiveKey(entry);
                counts[key] = (counts[key] || 0) + 1;
            });

            var selected = letter ? String(letter).toUpperCase() : (query ? '' : '0-9');
            if (selected && selected !== '0-9' && !/^[A-Z]$/.test(selected)) {
                selected = 'A';
            }

            var visibleEntries = selected
                ? entries.filter(function (entry) { return archiveKey(entry) === selected; })
                : entries;

            main.replaceChildren(
                pageHeading('A–Z archive', entries.length + ' results' + (selected ? ' · ' + visibleEntries.length + ' in ' + selected : ''))
            );

            var letterNav = E('aside', { class: 'ea-letters', 'aria-label': 'Filtrar arquivo por letra' });
            letters.forEach(function (key) {
                var count = counts[key] || 0;
                var button = E('button', {
                    class: 'ea-letter' + (key === selected ? ' on' : '') + (!count ? ' off' : ''),
                    type: 'button',
                    title: count ? count + ' results' : 'No results'
                }, [
                    E('span', { text: key }),
                    E('small', { text: String(count) })
                ]);
                if (count) {
                    button.addEventListener('click', function () {
                        location.hash = '#/archive?l=' + encodeURIComponent(key) + (query ? '&q=' + encodeURIComponent(query) : '');
                    });
                } else {
                    button.disabled = true;
                }
                letterNav.append(button);
            });

            var results = E('section', { class: 'ea-archive-results' });
            if (!visibleEntries.length) {
                results.append(E('div', { class: 'ea-empty', text: 'No results for this filter.' }));
            } else {
                visibleEntries.forEach(function (entry) { results.append(row(entry)); });
            }
            main.append(E('div', { class: 'ea-archive-layout' }, [letterNav, results]));
        });
    }

    function parseHash() {
        var hash = location.hash || '#/';
        var match = hash.match(/^#\/([^?]*)(?:\?(.*))?/);
        var params = new URLSearchParams(match && match[2] || '');
        return { name: match && match[1] || '', p: +params.get('p') || 1, q: params.get('q') || '', l: params.get('l') || '' };
    }

    function closeGameModal() {
        modalRequest += 1;
        modal.hidden = true;
        if (modalOpener && modalOpener.isConnected) {
            modalOpener.focus();
        }
    }

    function showGameModal(content) {
        modalBody.replaceChildren(content);
        modal.hidden = false;
        q('.ea-modal-head button', modal).focus();
    }

    function openGame(url, title) {
        var request = ++modalRequest;
        modalOpener = document.activeElement;
        game(url).then(function (data) {
            if (request === modalRequest) {
                showGameModal(panel(data, null));
            }
        }).catch(function () {
            if (request === modalRequest) {
                showGameModal(E('div', { class: 'ea-empty', text: 'Could not load ' + (title || url) }));
            }
        });
    }

    function video(url) {
        if (!isYouTubeURL(url)) {
            return;
        }
        var id;
        try {
            var videoUrl = new URL(url);
            var path = videoUrl.pathname;
            id = videoUrl.searchParams.get('v') || (path.match(/\/(?:embed|shorts)\/([^/?]+)/) || [])[1] || (/^(?:www\.)?youtu\.be$/i.test(videoUrl.hostname) && path.slice(1).split('/')[0]) || '';
        } catch (error) {
            return;
        }
        if (!/^[\w-]{6,32}$/.test(id)) {
            return;
        }

        var opener = document.activeElement;
        var videoModal = E('div', { class: 'ea-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Video', tabindex: '-1' });
        function closeVideo() {
            videoModal.remove();
            if (opener && opener.isConnected) {
                opener.focus();
            }
        }
        videoModal.append(E('div', { class: 'ea-box ea-video-box' }, [
            E('div', { class: 'ea-modal-head' }, [
                E('strong', { text: 'Video' }),
                E('button', { class: 'ea-btn', type: 'button', text: 'Close', onclick: closeVideo })
            ]),
            E('iframe', {
                class: 'ea-video',
                title: 'YouTube video player',
                src: 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0',
                allow: 'autoplay; fullscreen; picture-in-picture',
                allowfullscreen: '',
                referrerpolicy: 'strict-origin-when-cross-origin'
            }),
            E('div', { class: 'ea-video-actions' }, [E('a', { href: url, target: '_blank', rel: 'noopener', text: 'Open on YouTube ↗' })])
        ]));
        videoModal.addEventListener('click', function (event) {
            if (event.target === videoModal) {
                closeVideo();
            }
        });
        bindModalKeys(videoModal, closeVideo);
        app.append(videoModal);
        q('.ea-modal-head button', videoModal).focus();
    }

    function route() {
        var routeData = parseHash();
        var view;
        if (routeData.name === 'all') {
            view = viewAll(routeData.p);
        } else if (routeData.name === 'archive') {
            view = viewArchive(routeData.q, routeData.l);
        } else {
            view = viewRecent();
        }
        view.catch(function (error) {
            console.error('[ElAmigos Modern UI]', error);
            if (index) {
                return; // index is loaded, so a newer route has rendered, or this was a render error: leave main as baseline does
            }
            main.classList.remove('ea-recent');
            main.replaceChildren(E('div', { class: 'ea-empty' }, [
                'Could not load the release index. ',
                E('button', { class: 'ea-btn', type: 'button', text: 'Try again', onclick: route })
            ]));
        });
        qa('.ea-tab').forEach(function (tab) {
            var activeRoute = routeData.name === 'all' || routeData.name === 'archive' ? routeData.name : '';
            tab.classList.toggle('on', tab.getAttribute('href') === '#/' + activeRoute);
        });
    }

    function mount() {
        app = E('div', { id: 'ea-app' });
        var header = E('header', { class: 'ea-head' }, [E('a', { class: 'ea-brand', href: '#/', text: 'ElAmigos ' }, [E('b', { text: 'Modern' })])]);
        var search = E('input', {
            class: 'ea-input',
            placeholder: 'Search the archive…',
            'aria-label': 'Search the archive',
            onkeydown: function (event) {
                if (event.key === 'Enter') {
                    location.hash = '#/archive?q=' + encodeURIComponent(event.target.value);
                }
            }
        });
        header.append(E('div', { class: 'ea-search' }, [search]));

        var languageInput = E('input', {
            class: 'ea-language-input',
            type: 'text',
            value: targetLanguage,
            placeholder: 'Portuguese-Brazil',
            'aria-label': 'Language to highlight',
            onkeydown: function (event) {
                if (event.key === 'Enter') {
                    event.target.blur();
                }
            }
        });
        languageInput.addEventListener('change', function () {
            targetLanguage = languageInput.value.trim();
            if (typeof GM_setValue === 'function') {
                GM_setValue('ea_target_language', targetLanguage);
            }
            route();
        });
        header.append(E('label', { class: 'ea-setting ea-language-setting' }, ['Highlight language:', languageInput]));

        var filecryptToggle = E('input', { type: 'checkbox' });
        filecryptToggle.checked = showFilecrypt;
        filecryptToggle.addEventListener('change', function () {
            showFilecrypt = filecryptToggle.checked;
            if (typeof GM_setValue === 'function') {
                GM_setValue('ea_show_filecrypt', showFilecrypt);
            }
            route();
        });
        header.append(E('label', { class: 'ea-setting' }, [filecryptToggle, 'Show Filecrypt']));

        var nav = E('nav', { class: 'ea-tabs' });
        [['/', 'Recent'], ['/all', 'Releases'], ['/archive', 'A–Z archive']].forEach(function (item) {
            nav.append(E('a', { class: 'ea-tab', href: '#' + item[0], text: item[1] }));
        });
        header.append(nav);

        main = E('main', { class: 'ea-main' });
        modal = E('div', { class: 'ea-modal', hidden: '', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Game details',
            onclick: function (event) { if (event.target === modal) { closeGameModal(); } }
        });
        bindModalKeys(modal, closeGameModal);
        var modalBox = E('div', { class: 'ea-box' });
        var modalHeader = E('div', { class: 'ea-modal-head' });
        modalHeader.append(E('button', { class: 'ea-btn', text: 'Close', onclick: closeGameModal }));
        modalBody = E('div', { class: 'ea-modal-body' });
        modalBox.append(modalHeader, modalBody);
        modal.append(modalBox);
        app.append(header, main, modal);
        document.body.append(app);
        window.addEventListener('hashchange', route);
        window.addEventListener('resize', scheduleRecentAlignment);
        route();
    }

    function start() {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', start, { once: true });
            return;
        }
        try {
            mount();
        } catch (error) {
            document.documentElement.classList.remove('ea-on');
            console.error('[ElAmigos Modern UI]', error);
        }
    }

    start();
}());
