#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  captureBrowserWindow,
  closeOtherPages,
  getExtId,
  injectDemoStorage,
  launchExtensionBrowser,
  prepareBrowserWindow,
  requireMacOS,
} from './screenshot-browser.mjs';

const PAGE_URL = 'https://example.com/';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extPath = path.join(rootDir, 'dist');
const outPath = path.join(rootDir, 'docs', 'screenshot-popup.png');

const DEMO_SETTINGS = {
  enabled: true,
  preventionScope: 'everywhere',
  targetPages: [],
  targetDomains: [],
  targetPageSkips: [],
  globalSettings: {
    duplicateAction: 'close-new-switch-existing',
    ignoreParameters: true,
    duplicateScope: 'all-windows',
  },
  exceptions: [PAGE_URL],
  domainExceptions: ['example.com'],
  siteRules: [
    {
      domain: 'example.com',
      duplicateAction: 'close-old-stay-current',
      ignoreParameters: false,
    },
  ],
};
const DEMO_STATS = { tabsClosedCount: 2847 };

if (!fs.existsSync(extPath)) {
  console.error('Run npm run build first. dist/ not found.');
  process.exit(1);
}
requireMacOS();
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const context = await launchExtensionBrowser(extPath);

try {
  await context.addInitScript(({ mockUrl }) => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) return;
    const orig = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = function (queryInfo, callback) {
      const q = queryInfo || {};
      if (q.active === true && q.currentWindow === true) {
        const tabs = [{ url: mockUrl }];
        if (typeof callback === 'function') {
          Promise.resolve().then(() => callback(tabs));
          return;
        }
        return Promise.resolve(tabs);
      }
      return orig(q, callback);
    };
  }, { mockUrl: PAGE_URL });

  const extId = await getExtId(context);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`chrome-extension://${extId}/popup.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await injectDemoStorage(page, DEMO_SETTINGS, DEMO_STATS);
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await closeOtherPages(context, page);
  await prepareBrowserWindow(page);

  const [sw] = context.serviceWorkers();
  const popupResult = await sw.evaluate(() =>
    chrome.action.openPopup().then(() => 'ok').catch((error) => String(error?.message || error))
  );
  if (popupResult !== 'ok') {
    throw new Error(`Could not open extension popup: ${popupResult}`);
  }

  await captureBrowserWindow(page, outPath);
  console.log('Screenshot saved to', outPath);
} finally {
  await context.close();
}
