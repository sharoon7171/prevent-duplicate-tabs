# Prevent Duplicate Tabs

Chrome extension that closes or switches when the same URL opens again—so you stop duplicate tabs and cut tab clutter. Manifest V3 service worker, settings on-device, no content scripts or host permissions.

**[Chrome Web Store](https://chromewebstore.google.com/detail/prevent-duplicate-tabs/jjnoehggdfcblljkkeijmooameiaiani)** · **[Privacy](docs/privacy-policy.html)**

---

## Features

- Detects duplicate tab URLs and applies your chosen action right away
- Four actions: close new or old; stay put or switch (and focus that window)
- Scope: all sites with exceptions, or listed sites only
- Match across all windows or the current window; optionally ignore URL parameters
- Per-domain rules for action and parameter matching
- Context menu: open or duplicate a tab while allowing that duplicate
- Toolbar popup for quick controls; options page for lists and rules
- Local counts for open tabs and duplicates prevented

---

## Install

**Store:** add [Prevent Duplicate Tabs](https://chromewebstore.google.com/detail/prevent-duplicate-tabs/jjnoehggdfcblljkkeijmooameiaiani) from the Chrome Web Store.

**Unpacked:** `npm install && npm run build`, then in `chrome://extensions` enable Developer mode → Load unpacked → select `dist/`.

---

## Usage

1. Open the popup from the toolbar.
2. Enable the extension, set prevention scope and all-windows vs current window.
3. Choose the default action under Global Settings.
4. On **Options**, manage exceptions or monitored sites and optional site-specific rules.
5. Use the context menu when you intentionally want a second copy of a page.

Enabling the extension or changing scope and lists also scans tabs you already have open.

---

## Privacy

No analytics and no remote browsing pipeline—only Chrome `storage`, `tabs`, `windows`, and `contextMenus` for settings, URL checks, close/switch, window focus, and allow-duplicate menus. Details: [`docs/privacy-policy.html`](docs/privacy-policy.html).

| Permission | Use |
| --- | --- |
| `tabs` | Read URLs; close, activate, or open tabs |
| `storage` | Settings and statistics |
| `windows` | Focus windows; remove empty ones after close |
| `contextMenus` | Allow-duplicate actions |

---

## Development

TypeScript, React 19, Vite 8, Tailwind CSS 4, Manifest V3 background in `src/service-worker/`.

```bash
npm install
npm run build      # → dist/
npm run dev        # watch popup, options, background
npm run type-check
npm run build:zip  # versioned package
```

| Path | Role |
| --- | --- |
| `src/popup/`, `src/options/` | UI entries |
| `src/service-worker/` | Duplicate detection, context menus |
| `src/components/`, `src/services/`, `src/utils/`, `src/types/` | UI, storage, URL helpers, settings types |
| `public/` | Manifest and HTML shells |
| `docs/` | Store copy, privacy policy, screenshots |

Screenshots: `npm run screenshot` (or `:options` / `:popup`).
