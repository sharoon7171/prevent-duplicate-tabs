import type { ExtensionSettings, DuplicateAction } from '@/types/settings';
import { storageService } from '@/services/storage';
import {
  normalizeUrl,
  isUrlAllowedForDuplicateCheck,
  isUrlMonitoredInListedMode,
  extractDomain,
  normalizeSiteDomain,
} from '@/utils/urlNormalization';

class TabDetectionService {
  private currentSettings: ExtensionSettings | null = null;
  private readonly ready: Promise<void>;
  private resolveReady: (() => void) | null = null;
  private processingTabs: Set<number> = new Set();
  private dirtyTabs: Set<number> = new Set();
  private bypassTabIds: Set<number> = new Set();
  private bypassCreateCount = 0;
  private pendingNativeDuplicateOpener = new Map<number, number>();
  private scanTimeout: ReturnType<typeof setTimeout> | null = null;
  private isScanning = false;
  private scanQueued = false;
  private listenersRegistered = false;

  constructor() {
    this.ready = new Promise<void>((resolve) => {
      this.resolveReady = resolve;
    });
    this.registerListeners();
  }

  async initialize(): Promise<void> {
    try {
      this.currentSettings = await storageService.getSettings();
    } finally {
      this.resolveReady?.();
      this.resolveReady = null;
    }
    this.scheduleScan();
  }

  private registerListeners(): void {
    if (this.listenersRegistered) {
      return;
    }
    this.listenersRegistered = true;

    storageService.subscribe((settings) => {
      const previous = this.currentSettings;
      this.currentSettings = settings;
      if (settings.enabled && this.shouldScanAfterSettingsChange(previous, settings)) {
        this.scheduleScan();
      }
    });
    storageService.initializeChangeListener();

    chrome.tabs.onCreated.addListener((tab) => {
      this.applyBypassForNewTab(tab.id);
      return this.onTabCreated(tab);
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      this.bypassTabIds.delete(tabId);
      this.pendingNativeDuplicateOpener.delete(tabId);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab): void | Promise<void> => {
      if (changeInfo.url || (changeInfo.status === 'complete' && tab.url)) {
        return this.processTab(tab, tabId);
      }
    });
  }

  private async onTabCreated(tab: chrome.tabs.Tab): Promise<void> {
    await this.ready;
    await this.evaluateNativeTabDuplicate(tab);
    if (tab.id === undefined) {
      return;
    }
    await this.processTab(tab, tab.id);
  }

  private shouldScanAfterSettingsChange(
    previous: ExtensionSettings | null,
    next: ExtensionSettings
  ): boolean {
    if (!next.enabled) {
      return false;
    }
    if (!previous?.enabled) {
      return true;
    }
    return this.settingsFingerprint(previous) !== this.settingsFingerprint(next);
  }

  private settingsFingerprint(settings: ExtensionSettings): string {
    return JSON.stringify({
      preventionScope: settings.preventionScope,
      exceptions: settings.exceptions,
      domainExceptions: settings.domainExceptions,
      targetPages: settings.targetPages,
      targetDomains: settings.targetDomains,
      targetPageSkips: settings.targetPageSkips,
      globalSettings: settings.globalSettings,
      siteRules: settings.siteRules,
    });
  }

  private scheduleScan(): void {
    if (!this.currentSettings?.enabled) {
      return;
    }
    if (this.isScanning) {
      this.scanQueued = true;
      return;
    }
    if (this.scanTimeout !== null) {
      clearTimeout(this.scanTimeout);
    }
    this.scanTimeout = setTimeout(() => {
      this.scanTimeout = null;
      void this.scanExistingTabs();
    }, 300);
  }

  private shouldCheckTabUrl(url: string | undefined): boolean {
    if (!this.currentSettings?.enabled || !url) {
      return false;
    }

    if (this.currentSettings.preventionScope === 'listed-only') {
      return isUrlMonitoredInListedMode(
        url,
        this.currentSettings.targetPages,
        this.currentSettings.targetDomains,
        this.currentSettings.targetPageSkips
      );
    }

    return !isUrlAllowedForDuplicateCheck(
      url,
      this.currentSettings.exceptions,
      this.currentSettings.domainExceptions
    );
  }

  private getTabDuplicateSettingsForTab(tab: chrome.tabs.Tab): {
    normalizedUrl: string;
    duplicateAction: DuplicateAction;
    ignoreParameters: boolean;
    scopeWindowId?: number;
  } | null {
    if (!this.currentSettings || !tab.url || !this.shouldCheckTabUrl(tab.url)) {
      return null;
    }

    const domain = extractDomain(tab.url);
    const siteRule = domain
      ? this.currentSettings.siteRules.find((rule) => normalizeSiteDomain(rule.domain) === domain)
      : undefined;

    const ignoreParameters = siteRule?.ignoreParameters ?? this.currentSettings.globalSettings.ignoreParameters;
    const normalizedUrl = normalizeUrl(tab.url, ignoreParameters);
    if (!normalizedUrl) {
      return null;
    }

    const duplicateScope = this.currentSettings.globalSettings.duplicateScope;
    const scopeWindowId =
      duplicateScope === 'current-window' && tab.windowId !== undefined ? tab.windowId : undefined;

    return {
      normalizedUrl,
      duplicateAction: siteRule?.duplicateAction ?? this.currentSettings.globalSettings.duplicateAction,
      ignoreParameters,
      ...(scopeWindowId !== undefined ? { scopeWindowId } : {}),
    };
  }

  private duplicateGroupKey(normalizedUrl: string, scopeWindowId?: number): string {
    if (scopeWindowId !== undefined) {
      return `${scopeWindowId}:${normalizedUrl}`;
    }
    return normalizedUrl;
  }

  private async scanExistingTabs(): Promise<void> {
    await this.ready;
    if (!this.currentSettings?.enabled) {
      return;
    }
    if (this.isScanning) {
      this.scanQueued = true;
      return;
    }

    this.isScanning = true;
    this.scanQueued = false;

    try {
      const allTabs = await chrome.tabs.query({});
      const groups = new Map<string, { duplicateAction: DuplicateAction; tabs: chrome.tabs.Tab[] }>();

      for (const tab of allTabs) {
        if (tab.id === undefined || this.isBypassTab(tab.id)) {
          continue;
        }

        const settings = this.getTabDuplicateSettingsForTab(tab);
        if (!settings) {
          continue;
        }

        const key = this.duplicateGroupKey(settings.normalizedUrl, settings.scopeWindowId);
        const existing = groups.get(key);
        if (existing) {
          existing.tabs.push(tab);
          continue;
        }
        groups.set(key, { duplicateAction: settings.duplicateAction, tabs: [tab] });
      }

      for (const { duplicateAction, tabs } of groups.values()) {
        if (tabs.length < 2) {
          continue;
        }
        await this.resolveDuplicateGroup(tabs, duplicateAction);
      }
    } catch (error) {
      console.error('Error scanning existing tabs:', error);
    } finally {
      this.isScanning = false;
      if (this.scanQueued) {
        this.scanQueued = false;
        this.scheduleScan();
      }
    }
  }

  private pickSurvivorTab(tabs: chrome.tabs.Tab[], action: DuplicateAction): chrome.tabs.Tab {
    const sorted = [...tabs].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    const oldest = sorted[0];
    const newest = sorted[sorted.length - 1];
    if (!oldest || !newest) {
      return tabs[0] as chrome.tabs.Tab;
    }
    const active = sorted.find((tab) => tab.active);

    switch (action) {
      case 'close-old-stay-current':
        return active ?? newest;
      case 'close-old-switch-new':
        return newest;
      case 'close-new-switch-existing':
        return oldest;
      case 'close-new-stay-current':
      default:
        return active ?? oldest;
    }
  }

  private async resolveDuplicateGroup(tabs: chrome.tabs.Tab[], action: DuplicateAction): Promise<void> {
    const survivor = this.pickSurvivorTab(tabs, action);
    const survivorId = survivor.id;
    if (survivorId === undefined) {
      return;
    }

    for (const tab of tabs) {
      if (tab.id === undefined || tab.id === survivorId) {
        continue;
      }
      await this.closeTabAndMaybeWindow(tab.id);
    }

    if (action === 'close-new-switch-existing' || action === 'close-old-switch-new') {
      const refreshed = await chrome.tabs.get(survivorId).catch(() => null);
      if (refreshed?.windowId !== undefined) {
        await chrome.windows.update(refreshed.windowId, { focused: true }).catch(() => {});
      }
      await chrome.tabs.update(survivorId, { active: true });
    }
  }

  private async closeTabAndMaybeWindow(tabId: number): Promise<void> {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) {
      return;
    }
    const windowId = tab.windowId;
    await chrome.tabs.remove(tabId);
    await storageService.incrementTabsClosedCount();
    if (windowId !== undefined) {
      const remaining = await chrome.tabs.query({ windowId });
      if (remaining.length === 0) {
        await chrome.windows.remove(windowId).catch(() => {});
      }
    }
  }

  async duplicateTabAllowingDuplicate(tabId: number): Promise<void> {
    try {
      const duplicated = await chrome.tabs.duplicate(tabId);
      if (duplicated?.id !== undefined) {
        this.bypassTabIds.add(duplicated.id);
      }
    } catch (error) {
      console.error('Error duplicating tab:', error);
    }
  }

  async openTabAllowingDuplicate(url: string): Promise<void> {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return;
      }
    } catch {
      return;
    }

    this.bypassCreateCount += 1;
    try {
      await chrome.tabs.create({ url, active: true });
    } catch (error) {
      this.bypassCreateCount = Math.max(0, this.bypassCreateCount - 1);
      console.error('Error opening tab:', error);
    }
  }

  private applyBypassForNewTab(tabId: number | undefined): void {
    if (tabId === undefined || this.bypassCreateCount <= 0) {
      return;
    }
    this.bypassCreateCount -= 1;
    this.bypassTabIds.add(tabId);
  }

  private isBypassTab(tabId: number | undefined): boolean {
    return tabId !== undefined && this.bypassTabIds.has(tabId);
  }

  private tabUrl(tab: chrome.tabs.Tab): string | undefined {
    return tab.url ?? tab.pendingUrl;
  }

  private matchesNativeDuplicatePlacement(newTab: chrome.tabs.Tab, opener: chrome.tabs.Tab): boolean {
    return (
      newTab.windowId === opener.windowId &&
      newTab.index === opener.index + 1 &&
      newTab.active === true
    );
  }

  private async evaluateNativeTabDuplicate(tab: chrome.tabs.Tab): Promise<void> {
    if (tab.id === undefined || tab.openerTabId === undefined) {
      return;
    }

    const opener = await chrome.tabs.get(tab.openerTabId).catch(() => null);
    if (!opener) {
      return;
    }

    if (!this.matchesNativeDuplicatePlacement(tab, opener)) {
      return;
    }

    const openerUrl = this.tabUrl(opener);
    const createdUrl = this.tabUrl(tab);
    if (openerUrl && createdUrl && openerUrl === createdUrl) {
      this.bypassTabIds.add(tab.id);
      return;
    }

    this.pendingNativeDuplicateOpener.set(tab.id, tab.openerTabId);
  }

  private async resolvePendingNativeTabDuplicate(tab: chrome.tabs.Tab): Promise<void> {
    if (tab.id === undefined) {
      return;
    }

    const openerId = this.pendingNativeDuplicateOpener.get(tab.id);
    if (openerId === undefined) {
      return;
    }

    const opener = await chrome.tabs.get(openerId).catch(() => null);
    if (!opener) {
      this.pendingNativeDuplicateOpener.delete(tab.id);
      return;
    }

    if (!this.matchesNativeDuplicatePlacement(tab, opener)) {
      this.pendingNativeDuplicateOpener.delete(tab.id);
      return;
    }

    const openerUrl = this.tabUrl(opener);
    const createdUrl = this.tabUrl(tab);
    if (!openerUrl || !createdUrl) {
      return;
    }

    this.pendingNativeDuplicateOpener.delete(tab.id);
    if (openerUrl === createdUrl) {
      this.bypassTabIds.add(tab.id);
    }
  }

  private async processTab(tab: chrome.tabs.Tab, tabId: number): Promise<void> {
    await this.ready;

    if (this.processingTabs.has(tabId)) {
      this.dirtyTabs.add(tabId);
      return;
    }

    this.processingTabs.add(tabId);

    try {
      let current = tab;
      for (;;) {
        this.dirtyTabs.delete(tabId);
        await this.processTabOnce(current, tabId);
        if (!this.dirtyTabs.has(tabId)) {
          break;
        }
        const refreshed = await chrome.tabs.get(tabId).catch(() => null);
        if (!refreshed) {
          this.dirtyTabs.delete(tabId);
          return;
        }
        current = refreshed;
      }
    } finally {
      this.processingTabs.delete(tabId);
    }

    if (!this.dirtyTabs.has(tabId)) {
      return;
    }
    this.dirtyTabs.delete(tabId);
    const again = await chrome.tabs.get(tabId).catch(() => null);
    if (again) {
      await this.processTab(again, tabId);
    }
  }

  private async processTabOnce(tab: chrome.tabs.Tab, tabId: number): Promise<void> {
    await this.resolvePendingNativeTabDuplicate(tab);
    if (this.isBypassTab(tabId)) {
      return;
    }
    if (!this.currentSettings?.enabled) {
      return;
    }
    if (!tab.url || !this.shouldCheckTabUrl(tab.url)) {
      return;
    }

    const tabSettings = this.getTabDuplicateSettingsForTab(tab);
    if (!tabSettings) {
      return;
    }

    const duplicateTabs = await this.findDuplicateTabs(
      tab.url,
      tabId,
      tabSettings.ignoreParameters,
      tabSettings.scopeWindowId
    );

    const existingTab = duplicateTabs[0];
    if (!existingTab) {
      return;
    }
    await this.handleDuplicate(tabId, existingTab, tabSettings.duplicateAction);
  }

  private async findDuplicateTabs(
    url: string,
    excludeTabId: number,
    ignoreParameters: boolean,
    scopeWindowId?: number
  ): Promise<chrome.tabs.Tab[]> {
    try {
      const queryOptions = scopeWindowId !== undefined ? { windowId: scopeWindowId } : {};
      const allTabs = await chrome.tabs.query(queryOptions);
      const normalizedUrl = normalizeUrl(url, ignoreParameters);

      if (!normalizedUrl) {
        return [];
      }

      return allTabs
        .filter((candidate) => {
          if (candidate.id === excludeTabId) {
            return false;
          }
          if (!candidate.url) {
            return false;
          }
          return normalizeUrl(candidate.url, ignoreParameters) === normalizedUrl;
        })
        .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    } catch (error) {
      console.error('Error finding duplicate tabs:', error);
      return [];
    }
  }

  private async handleDuplicate(
    newTabId: number,
    existingTab: chrome.tabs.Tab,
    action: DuplicateAction
  ): Promise<void> {
    const existingTabId = existingTab.id;
    if (existingTabId === undefined) {
      return;
    }

    try {
      switch (action) {
        case 'close-new-stay-current':
          await this.closeTabAndMaybeWindow(newTabId);
          break;

        case 'close-old-stay-current': {
          const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const currentTabId = currentTabs[0]?.id;

          await this.closeTabAndMaybeWindow(existingTabId);

          if (currentTabId === existingTabId && newTabId) {
            await chrome.tabs.update(newTabId, { active: true });
          }
          break;
        }

        case 'close-new-switch-existing':
          await this.closeTabAndMaybeWindow(newTabId);
          if (existingTab.windowId !== undefined) {
            await chrome.windows.update(existingTab.windowId, { focused: true }).catch(() => {});
          }
          await chrome.tabs.update(existingTabId, { active: true });
          break;

        case 'close-old-switch-new':
          await this.closeTabAndMaybeWindow(existingTabId);
          const newTab = await chrome.tabs.get(newTabId).catch(() => null);
          if (newTab?.windowId !== undefined) {
            await chrome.windows.update(newTab.windowId, { focused: true }).catch(() => {});
          }
          await chrome.tabs.update(newTabId, { active: true });
          break;

        default:
          console.warn('Unknown duplicate action:', action);
      }
    } catch (error) {
      console.error('Error handling duplicate:', error);
    }
  }
}

export const tabDetectionService = new TabDetectionService();
