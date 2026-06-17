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

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extPath = path.join(rootDir, 'dist');
const outPath = path.join(rootDir, 'docs', 'screenshot-options.png');

const DEMO_SETTINGS = {
  enabled: true,
  preventionScope: 'everywhere',
  targetPages: [],
  targetDomains: [],
  targetPageSkips: [],
  globalSettings: {
    duplicateAction: 'close-new-stay-current',
    ignoreParameters: false,
    duplicateScope: 'all-windows',
  },
  exceptions: [
    'https://github.com',
    'https://stackoverflow.com/questions/123',
    'https://docs.google.com/document/d/abc',
  ],
  domainExceptions: ['youtube.com', 'twitter.com'],
  siteRules: [
    { domain: 'youtube.com', duplicateAction: 'close-old-switch-new', ignoreParameters: true },
    { domain: 'twitter.com', duplicateAction: 'close-new-stay-current', ignoreParameters: false },
    { domain: 'reddit.com', duplicateAction: 'close-new-switch-existing', ignoreParameters: true },
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
  const extId = await getExtId(context);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`chrome-extension://${extId}/options.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await injectDemoStorage(page, DEMO_SETTINGS, DEMO_STATS);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await closeOtherPages(context, page);
  await prepareBrowserWindow(page);
  await captureBrowserWindow(page, outPath);
  console.log('Screenshot saved to', outPath);
} finally {
  await context.close();
}
