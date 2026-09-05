import { chromium } from 'playwright';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(__dirname, '../dist');
const SETTINGS_KEY = 'extensionSettings';
const STATS_KEY = 'extensionStatistics';

const ACTIONS = [
  'close-new-stay-current',
  'close-old-stay-current',
  'close-new-switch-existing',
  'close-old-switch-new',
];

const results = [];
function pass(name, detail = '') {
  results.push({ ok: true, name, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ ok: false, name, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function getSettings(page) {
  return page.evaluate(async (key) => {
    const raw = (await chrome.storage.sync.get(key))[key];
    return typeof raw === 'string' ? JSON.parse(raw) : null;
  }, SETTINGS_KEY);
}

async function setSettings(page, patch) {
  await page.evaluate(
    async ({ key, patch }) => {
      const raw = (await chrome.storage.sync.get(key))[key];
      const current = typeof raw === 'string' ? JSON.parse(raw) : {};
      const next = {
        ...current,
        ...patch,
        globalSettings: {
          ...(current.globalSettings || {}),
          ...(patch.globalSettings || {}),
        },
      };
      await chrome.storage.sync.set({ [key]: JSON.stringify(next) });
    },
    { key: SETTINGS_KEY, patch }
  );
}

async function resetDefaults(page) {
  await page.evaluate(
    async ({ settingsKey, statsKey }) => {
      await chrome.storage.sync.set({
        [settingsKey]: JSON.stringify({
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
          exceptions: [],
          domainExceptions: [],
          siteRules: [],
        }),
        [statsKey]: JSON.stringify({ tabsClosedCount: 0 }),
      });
    },
    { settingsKey: SETTINGS_KEY, statsKey: STATS_KEY }
  );
}

async function waitForTabCount(context, expected, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pages = context.pages().filter((p) => p.url().startsWith('http'));
    if (pages.length === expected) {
      return pages;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  const pages = context.pages().filter((p) => p.url().startsWith('http'));
  throw new Error(`Expected ${expected} http tabs, got ${pages.length}: ${pages.map((p) => p.url()).join(' | ')}`);
}

async function closeHttpTabs(context, keep = []) {
  for (const page of context.pages()) {
    if (!page.url().startsWith('http')) continue;
    if (keep.includes(page)) continue;
    await page.close().catch(() => {});
  }
}

async function clickToggleByLabel(page, label) {
  const sw = page.getByRole('switch', { name: label });
  await sw.click();
  return sw;
}

async function clickRadioByLabel(page, label) {
  await page.getByRole('radio', { name: label }).click();
}

async function main() {
  const userDataDir = path.join(os.tmpdir(), `pde-e2e-${Date.now()}`);
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: false,
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const extId = new URL(sw.url()).host;
  pass('extension service worker started', extId);

  const optionsUrl = `chrome-extension://${extId}/options.html`;
  const options = await context.newPage();
  await options.goto(optionsUrl);
  await options.waitForSelector('text=Extension Status', { timeout: 15000 });
  pass('options page loads');

  await resetDefaults(options);
  await options.reload();
  await options.waitForSelector('text=Extension Status');

  // --- UI: Extension Status toggles ---
  {
    await clickToggleByLabel(options, 'Enable extension');
    await options.waitForTimeout(300);
    let s = await getSettings(options);
    if (s.enabled === false) pass('UI disable extension');
    else fail('UI disable extension', JSON.stringify(s.enabled));

    await clickToggleByLabel(options, 'Enable extension');
    await options.waitForTimeout(300);
    s = await getSettings(options);
    if (s.enabled === true) pass('UI enable extension');
    else fail('UI enable extension', JSON.stringify(s.enabled));

    await clickToggleByLabel(options, 'All windows');
    await options.waitForTimeout(300);
    s = await getSettings(options);
    if (s.globalSettings.duplicateScope === 'current-window') pass('UI current-window scope');
    else fail('UI current-window scope', s.globalSettings.duplicateScope);

    await clickToggleByLabel(options, 'All windows');
    await options.waitForTimeout(300);
    s = await getSettings(options);
    if (s.globalSettings.duplicateScope === 'all-windows') pass('UI all-windows scope');
    else fail('UI all-windows scope', s.globalSettings.duplicateScope);

    await clickRadioByLabel(options, 'Listed sites only');
    await options.waitForTimeout(300);
    s = await getSettings(options);
    if (s.preventionScope === 'listed-only') pass('UI prevention listed-only');
    else fail('UI prevention listed-only', s.preventionScope);

    await clickRadioByLabel(options, 'All websites');
    await options.waitForTimeout(300);
    s = await getSettings(options);
    if (s.preventionScope === 'everywhere') pass('UI prevention everywhere');
    else fail('UI prevention everywhere', s.preventionScope);
  }

  // --- UI: Global duplicate actions + ignore params ---
  {
    for (const action of ACTIONS) {
      const labels = {
        'close-new-stay-current': 'Close new duplicate tab and stay on current tab',
        'close-old-stay-current': 'Close old duplicate and stay on current tab',
        'close-new-switch-existing': 'Close new duplicate tab and switch to existing tab',
        'close-old-switch-new': 'Close old duplicate and switch to new tab',
      };
      await clickRadioByLabel(options, labels[action]);
      await options.waitForTimeout(250);
      const s = await getSettings(options);
      if (s.globalSettings.duplicateAction === action) pass(`UI action ${action}`);
      else fail(`UI action ${action}`, s.globalSettings.duplicateAction);
    }

    await clickToggleByLabel(options, 'Ignore URL parameters');
    await options.waitForTimeout(300);
    let s = await getSettings(options);
    if (s.globalSettings.ignoreParameters === true) pass('UI ignore parameters on');
    else fail('UI ignore parameters on', String(s.globalSettings.ignoreParameters));

    await clickToggleByLabel(options, 'Ignore URL parameters');
    await options.waitForTimeout(300);
    s = await getSettings(options);
    if (s.globalSettings.ignoreParameters === false) pass('UI ignore parameters off');
    else fail('UI ignore parameters off', String(s.globalSettings.ignoreParameters));
  }

  // --- UI: Site list add domain/page (exceptions mode) ---
  {
    await resetDefaults(options);
    await options.reload();
    await options.waitForSelector('text=Exceptions', { timeout: 15000 });

    const domainInput = options.getByPlaceholder('example.com');
    await options.getByRole('button', { name: 'Domain', exact: true }).click();
    await domainInput.fill('example.com');
    await options.getByRole('button', { name: 'Add Exception' }).click();
    await options.waitForTimeout(400);
    let s = await getSettings(options);
    if (s.domainExceptions.some((d) => d.includes('example.com'))) pass('UI add domain exception');
    else fail('UI add domain exception', JSON.stringify(s.domainExceptions));

    await options.getByRole('button', { name: 'Page', exact: true }).click();
    await options.getByPlaceholder('example.com/page').fill('example.com/docs');
    await options.getByRole('button', { name: 'Add Exception' }).click();
    await options.waitForTimeout(400);
    s = await getSettings(options);
    if (s.exceptions.some((e) => e.includes('example.com/docs'))) pass('UI add page exception');
    else fail('UI add page exception', JSON.stringify(s.exceptions));
  }

  // --- UI: Site-specific rules ---
  {
    await options.getByRole('button', { name: '+ Add New Rule' }).click();
    await options.getByPlaceholder('example.com').last().fill('docs.example.com');
    await options.getByRole('button', { name: 'Add Rule', exact: true }).click();
    await options.waitForTimeout(400);
    const s = await getSettings(options);
    const rule = s.siteRules.find((r) => r.domain === 'docs.example.com');
    if (rule) pass('UI add site rule', JSON.stringify(rule));
    else fail('UI add site rule', JSON.stringify(s.siteRules));
  }

  // --- Functional: duplicate actions (storage-driven, real tabs) ---
  const base = 'https://example.com/';
  const withParam = 'https://example.com/?sadasd';

  async function testDuplicateAction(action) {
    await resetDefaults(options);
    await setSettings(options, {
      enabled: true,
      preventionScope: 'everywhere',
      globalSettings: {
        duplicateAction: action,
        ignoreParameters: false,
        duplicateScope: 'all-windows',
      },
      exceptions: [],
      domainExceptions: [],
      siteRules: [],
    });
    await closeHttpTabs(context);
    await options.waitForTimeout(400);

    const first = await context.newPage();
    await first.goto(base, { waitUntil: 'domcontentloaded' });
    await options.waitForTimeout(500);

    const second = await context.newPage();
    await second.goto(base, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await options.waitForTimeout(1200);

    const httpPages = context.pages().filter((p) => {
      try {
        return p.url().startsWith('https://example.com');
      } catch {
        return false;
      }
    });

    if (httpPages.length === 1) pass(`dup action ${action} closes to 1 tab`);
    else fail(`dup action ${action} closes to 1 tab`, `got ${httpPages.length}`);

    await closeHttpTabs(context);
  }

  for (const action of ACTIONS) {
    await testDuplicateAction(action);
  }

  // --- ignoreParameters off: different query stays ---
  {
    await resetDefaults(options);
    await setSettings(options, {
      globalSettings: {
        duplicateAction: 'close-new-stay-current',
        ignoreParameters: false,
        duplicateScope: 'all-windows',
      },
    });
    await closeHttpTabs(context);
    const a = await context.newPage();
    await a.goto(base, { waitUntil: 'domcontentloaded' });
    const b = await context.newPage();
    await b.goto(withParam, { waitUntil: 'domcontentloaded' });
    await options.waitForTimeout(1000);
    const httpPages = context.pages().filter((p) => {
      try {
        return p.url().startsWith('https://example.com');
      } catch {
        return false;
      }
    });
    if (httpPages.length === 2) pass('ignoreParams off keeps ?sadasd distinct');
    else fail('ignoreParams off keeps ?sadasd distinct', `got ${httpPages.length}`);
    await closeHttpTabs(context);
  }

  // --- ignoreParameters on: query treated as same ---
  {
    await setSettings(options, {
      globalSettings: {
        duplicateAction: 'close-new-stay-current',
        ignoreParameters: true,
        duplicateScope: 'all-windows',
      },
    });
    await closeHttpTabs(context);
    const a = await context.newPage();
    await a.goto(base, { waitUntil: 'domcontentloaded' });
    await options.waitForTimeout(400);
    const b = await context.newPage();
    await b.goto(withParam, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await options.waitForTimeout(1200);
    const httpPages = context.pages().filter((p) => {
      try {
        return p.url().startsWith('https://example.com');
      } catch {
        return false;
      }
    });
    if (httpPages.length === 1) pass('ignoreParams on merges ?sadasd');
    else fail('ignoreParams on merges ?sadasd', `got ${httpPages.length}`);
    await closeHttpTabs(context);
  }

  // --- disabled: duplicates allowed ---
  {
    await setSettings(options, { enabled: false });
    await closeHttpTabs(context);
    const a = await context.newPage();
    await a.goto(base, { waitUntil: 'domcontentloaded' });
    const b = await context.newPage();
    await b.goto(base, { waitUntil: 'domcontentloaded' });
    await options.waitForTimeout(1000);
    const httpPages = context.pages().filter((p) => {
      try {
        return p.url().startsWith('https://example.com');
      } catch {
        return false;
      }
    });
    if (httpPages.length === 2) pass('disabled allows duplicates');
    else fail('disabled allows duplicates', `got ${httpPages.length}`);
    await closeHttpTabs(context);
  }

  // --- domain exception ---
  {
    await setSettings(options, {
      enabled: true,
      preventionScope: 'everywhere',
      domainExceptions: ['https://example.com'],
      exceptions: [],
      globalSettings: {
        duplicateAction: 'close-new-stay-current',
        ignoreParameters: false,
        duplicateScope: 'all-windows',
      },
    });
    await closeHttpTabs(context);
    const a = await context.newPage();
    await a.goto(base, { waitUntil: 'domcontentloaded' });
    const b = await context.newPage();
    await b.goto(base, { waitUntil: 'domcontentloaded' });
    await options.waitForTimeout(1000);
    const httpPages = context.pages().filter((p) => {
      try {
        return p.url().startsWith('https://example.com');
      } catch {
        return false;
      }
    });
    if (httpPages.length === 2) pass('domain exception allows duplicates');
    else fail('domain exception allows duplicates', `got ${httpPages.length}`);
    await closeHttpTabs(context);
  }

  // --- listed-only without list: no prevention ---
  {
    await setSettings(options, {
      enabled: true,
      preventionScope: 'listed-only',
      targetDomains: [],
      targetPages: [],
      domainExceptions: [],
      exceptions: [],
      globalSettings: {
        duplicateAction: 'close-new-stay-current',
        ignoreParameters: false,
        duplicateScope: 'all-windows',
      },
    });
    await closeHttpTabs(context);
    const a = await context.newPage();
    await a.goto(base, { waitUntil: 'domcontentloaded' });
    const b = await context.newPage();
    await b.goto(base, { waitUntil: 'domcontentloaded' });
    await options.waitForTimeout(1000);
    const httpPages = context.pages().filter((p) => {
      try {
        return p.url().startsWith('https://example.com');
      } catch {
        return false;
      }
    });
    if (httpPages.length === 2) pass('listed-only empty list allows duplicates');
    else fail('listed-only empty list allows duplicates', `got ${httpPages.length}`);
    await closeHttpTabs(context);
  }

  // --- listed-only with domain: prevents ---
  {
    await setSettings(options, {
      enabled: true,
      preventionScope: 'listed-only',
      targetDomains: ['https://example.com'],
      targetPages: [],
      globalSettings: {
        duplicateAction: 'close-new-stay-current',
        ignoreParameters: false,
        duplicateScope: 'all-windows',
      },
    });
    await closeHttpTabs(context);
    const a = await context.newPage();
    await a.goto(base, { waitUntil: 'domcontentloaded' });
    await options.waitForTimeout(400);
    const b = await context.newPage();
    await b.goto(base, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await options.waitForTimeout(1200);
    const httpPages = context.pages().filter((p) => {
      try {
        return p.url().startsWith('https://example.com');
      } catch {
        return false;
      }
    });
    if (httpPages.length === 1) pass('listed-only with domain prevents');
    else fail('listed-only with domain prevents', `got ${httpPages.length}`);
    await closeHttpTabs(context);
  }

  // --- site rule ignoreParameters override ---
  {
    await setSettings(options, {
      enabled: true,
      preventionScope: 'everywhere',
      domainExceptions: [],
      exceptions: [],
      globalSettings: {
        duplicateAction: 'close-new-stay-current',
        ignoreParameters: false,
        duplicateScope: 'all-windows',
      },
      siteRules: [
        {
          domain: 'example.com',
          duplicateAction: 'close-new-stay-current',
          ignoreParameters: true,
        },
      ],
    });
    await closeHttpTabs(context);
    const a = await context.newPage();
    await a.goto(base, { waitUntil: 'domcontentloaded' });
    await options.waitForTimeout(400);
    const b = await context.newPage();
    await b.goto(withParam, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await options.waitForTimeout(1200);
    const httpPages = context.pages().filter((p) => {
      try {
        return p.url().startsWith('https://example.com');
      } catch {
        return false;
      }
    });
    if (httpPages.length === 1) pass('site rule ignoreParameters overrides global off');
    else fail('site rule ignoreParameters overrides global off', `got ${httpPages.length}`);
    await closeHttpTabs(context);
  }

  // --- site rule with mismatched casing (known bug check) ---
  {
    await setSettings(options, {
      enabled: true,
      preventionScope: 'everywhere',
      globalSettings: {
        duplicateAction: 'close-new-stay-current',
        ignoreParameters: false,
        duplicateScope: 'all-windows',
      },
      siteRules: [
        {
          domain: 'Example.COM',
          duplicateAction: 'close-old-switch-new',
          ignoreParameters: true,
        },
      ],
    });
    await closeHttpTabs(context);
    const a = await context.newPage();
    await a.goto(base, { waitUntil: 'domcontentloaded' });
    await options.waitForTimeout(400);
    const b = await context.newPage();
    await b.goto(withParam, { waitUntil: 'domcontentloaded' });
    await options.waitForTimeout(1000);
    const httpPages = context.pages().filter((p) => {
      try {
        return p.url().startsWith('https://example.com');
      } catch {
        return false;
      }
    });
    // With broken case match, ignoreParams site rule won't apply → 2 tabs expected
    if (httpPages.length === 2) {
      fail('site rule domain case mismatch (Example.COM vs example.com)', 'rule ignored; 2 tabs kept');
    } else if (httpPages.length === 1) {
      pass('site rule domain case mismatch unexpectedly matched');
    } else {
      fail('site rule domain case mismatch', `got ${httpPages.length}`);
    }
    await closeHttpTabs(context);
  }

  // --- popup loads ---
  {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extId}/popup.html`);
    await popup.waitForSelector('text=Extension Status', { timeout: 10000 });
    pass('popup page loads');
    await popup.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n==== SUMMARY ====');
  console.log(`Total: ${results.length}  Pass: ${results.length - failed.length}  Fail: ${failed.length}`);
  if (failed.length) {
    console.log('Failures:');
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  }

  await context.close();
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
