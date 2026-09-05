import { tabDetectionService } from './tabDetection';

const LINK_MENU_ID = 'open-tab-allow-duplicate';
const LINK_MENU_TITLE = 'Open in new tab (allow duplicate)';
const TAB_MENU_ID = 'duplicate-tab-allow-duplicate';
const TAB_MENU_TITLE = 'Duplicate tab (allow duplicate)';

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function createContextMenu(): void {
  chrome.contextMenus.create(
    {
      id: LINK_MENU_ID,
      title: LINK_MENU_TITLE,
      contexts: ['link'],
    },
    () => {
      void chrome.runtime.lastError;
    }
  );
  chrome.contextMenus.create(
    {
      id: TAB_MENU_ID,
      title: TAB_MENU_TITLE,
      contexts: ['page'],
    },
    () => {
      void chrome.runtime.lastError;
    }
  );
}

export function initializeContextMenu(): void {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
      createContextMenu();
    });
  });

  createContextMenu();

  chrome.contextMenus.onClicked.addListener((info, tab): void | Promise<void> => {
    if (info.menuItemId === LINK_MENU_ID) {
      if (!info.linkUrl || !isHttpUrl(info.linkUrl)) {
        return;
      }
      return tabDetectionService.openTabAllowingDuplicate(info.linkUrl);
    }
    if (info.menuItemId === TAB_MENU_ID && tab?.id !== undefined) {
      return tabDetectionService.duplicateTabAllowingDuplicate(tab.id);
    }
  });
}
