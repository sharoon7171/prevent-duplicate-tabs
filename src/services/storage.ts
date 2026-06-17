import type { ExtensionSettings, StatisticsData } from '@/types/settings';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, DEFAULT_STATISTICS, STATISTICS_STORAGE_KEY } from '@/types/settings';
import type { ReviewPromptState } from '@/types/reviewPrompt';
import {
  DEFAULT_REVIEW_PROMPT_STATE,
  REVIEW_PROMPT_STORAGE_KEY,
} from '@/types/reviewPrompt';

type StorageListener = (settings: ExtensionSettings) => void;
type StatisticsListener = (statistics: StatisticsData) => void;
type ReviewPromptListener = (state: ReviewPromptState) => void;

type SettingsUpdate = Partial<Omit<ExtensionSettings, 'globalSettings'>> & {
  globalSettings?: Partial<ExtensionSettings['globalSettings']>;
};

interface AppData {
  settings: ExtensionSettings;
  statistics: StatisticsData;
}

class StorageService {
  private listeners: Set<StorageListener> = new Set();
  private statisticsListeners: Set<StatisticsListener> = new Set();
  private reviewPromptListeners: Set<ReviewPromptListener> = new Set();
  private changeListenerInitialized: boolean = false;

  async getSettings(): Promise<ExtensionSettings> {
    try {
      const result = await chrome.storage.sync.get(SETTINGS_STORAGE_KEY);
      const stored = result[SETTINGS_STORAGE_KEY];
      return typeof stored === 'string' ? this.parseSettings(stored) : { ...DEFAULT_SETTINGS };
    } catch (error) {
      console.error('Error reading settings:', error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  async getAppData(): Promise<AppData> {
    try {
      const result = await chrome.storage.sync.get([SETTINGS_STORAGE_KEY, STATISTICS_STORAGE_KEY]);
      const storedSettings = result[SETTINGS_STORAGE_KEY];
      const storedStatistics = result[STATISTICS_STORAGE_KEY];

      const settings =
        typeof storedSettings === 'string'
          ? this.parseSettings(storedSettings)
          : { ...DEFAULT_SETTINGS };
      const statistics =
        typeof storedStatistics === 'string'
          ? this.parseStatistics(storedStatistics)
          : { ...DEFAULT_STATISTICS };

      return { settings, statistics };
    } catch (error) {
      console.error('Error reading app data:', error);
      return {
        settings: { ...DEFAULT_SETTINGS },
        statistics: { ...DEFAULT_STATISTICS },
      };
    }
  }

  async updateSettings(settings: SettingsUpdate): Promise<void> {
    try {
      const current = await this.getSettings();
      const updated: ExtensionSettings = {
        ...current,
        ...settings,
        globalSettings: {
          ...current.globalSettings,
          ...settings.globalSettings,
        },
      };

      await chrome.storage.sync.set({ [SETTINGS_STORAGE_KEY]: JSON.stringify(updated) });
      this.notifyListeners(updated);
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  subscribe(listener: StorageListener): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(settings: ExtensionSettings): void {
    this.listeners.forEach((listener) => {
      try {
        listener(settings);
      } catch (error) {
        console.error('Error notifying listener:', error);
      }
    });
  }

  private parseSettings(stored: string): ExtensionSettings {
    try {
      const parsed = JSON.parse(stored) as Partial<ExtensionSettings>;
      return {
        enabled: parsed.enabled ?? DEFAULT_SETTINGS.enabled,
        preventionScope: parsed.preventionScope ?? DEFAULT_SETTINGS.preventionScope,
        targetPages: parsed.targetPages ?? DEFAULT_SETTINGS.targetPages,
        targetDomains: parsed.targetDomains ?? DEFAULT_SETTINGS.targetDomains,
        targetPageSkips: parsed.targetPageSkips ?? DEFAULT_SETTINGS.targetPageSkips,
        globalSettings: {
          duplicateAction: parsed.globalSettings?.duplicateAction ?? DEFAULT_SETTINGS.globalSettings.duplicateAction,
          ignoreParameters: parsed.globalSettings?.ignoreParameters ?? DEFAULT_SETTINGS.globalSettings.ignoreParameters,
          duplicateScope: parsed.globalSettings?.duplicateScope ?? DEFAULT_SETTINGS.globalSettings.duplicateScope,
        },
        exceptions: parsed.exceptions ?? DEFAULT_SETTINGS.exceptions,
        domainExceptions: parsed.domainExceptions ?? DEFAULT_SETTINGS.domainExceptions,
        siteRules: parsed.siteRules ?? DEFAULT_SETTINGS.siteRules,
      };
    } catch (error) {
      console.error('Error parsing settings:', error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  initializeChangeListener(): void {
    if (this.changeListenerInitialized) {
      return;
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[REVIEW_PROMPT_STORAGE_KEY]) {
        const newValue = changes[REVIEW_PROMPT_STORAGE_KEY].newValue;
        if (typeof newValue === 'string') {
          this.notifyReviewPromptListeners(this.parseReviewPrompt(newValue));
        }
      }
      if (areaName !== 'sync') {
        return;
      }
      if (changes[SETTINGS_STORAGE_KEY]) {
        const newValue = changes[SETTINGS_STORAGE_KEY].newValue;
        if (typeof newValue === 'string') {
          this.notifyListeners(this.parseSettings(newValue));
        }
      }
      if (changes[STATISTICS_STORAGE_KEY]) {
        const newValue = changes[STATISTICS_STORAGE_KEY].newValue;
        if (typeof newValue === 'string') {
          this.notifyStatisticsListeners(this.parseStatistics(newValue));
        }
      }
    });

    this.changeListenerInitialized = true;
  }

  async getStatistics(): Promise<StatisticsData> {
    try {
      const result = await chrome.storage.sync.get(STATISTICS_STORAGE_KEY);
      const stored = result[STATISTICS_STORAGE_KEY];
      return typeof stored === 'string' ? this.parseStatistics(stored) : { ...DEFAULT_STATISTICS };
    } catch (error) {
      console.error('Error reading statistics:', error);
      return { ...DEFAULT_STATISTICS };
    }
  }

  async incrementTabsClosedCount(): Promise<void> {
    try {
      const current = await this.getStatistics();
      const updated: StatisticsData = {
        tabsClosedCount: current.tabsClosedCount + 1,
      };

      await chrome.storage.sync.set({ [STATISTICS_STORAGE_KEY]: JSON.stringify(updated) });
      this.notifyStatisticsListeners(updated);
    } catch (error) {
      console.error('Error incrementing tabs closed count:', error);
      throw error;
    }
  }

  subscribeStatistics(listener: StatisticsListener): () => void {
    this.statisticsListeners.add(listener);
    return (): void => {
      this.statisticsListeners.delete(listener);
    };
  }

  private notifyStatisticsListeners(statistics: StatisticsData): void {
    this.statisticsListeners.forEach((listener) => {
      try {
        listener(statistics);
      } catch (error) {
        console.error('Error notifying statistics listener:', error);
      }
    });
  }

  private parseStatistics(stored: string): StatisticsData {
    try {
      const parsed = JSON.parse(stored) as Partial<StatisticsData>;
      return {
        tabsClosedCount: parsed.tabsClosedCount ?? DEFAULT_STATISTICS.tabsClosedCount,
      };
    } catch (error) {
      console.error('Error parsing statistics:', error);
      return { ...DEFAULT_STATISTICS };
    }
  }

  async getReviewPromptState(): Promise<ReviewPromptState> {
    try {
      const localResult = await chrome.storage.local.get(REVIEW_PROMPT_STORAGE_KEY);
      const rawLocal = localResult[REVIEW_PROMPT_STORAGE_KEY];
      let parsed: ReviewPromptState =
        typeof rawLocal === 'string'
          ? this.parseReviewPrompt(rawLocal)
          : { ...DEFAULT_REVIEW_PROMPT_STATE };
      if (parsed.firstSeenAt === 0) {
        parsed = { ...parsed, firstSeenAt: Date.now() };
        await chrome.storage.local.set({
          [REVIEW_PROMPT_STORAGE_KEY]: JSON.stringify(parsed),
        });
        this.notifyReviewPromptListeners(parsed);
      }
      return parsed;
    } catch (error) {
      console.error('Error reading review prompt state:', error);
      return { ...DEFAULT_REVIEW_PROMPT_STATE, firstSeenAt: Date.now() };
    }
  }

  async dismissReviewPrompt(): Promise<ReviewPromptState> {
    try {
      const current = await this.getReviewPromptState();
      const updated: ReviewPromptState = {
        ...current,
        dismissed: true,
        snoozeUntil: null,
      };
      await chrome.storage.local.set({
        [REVIEW_PROMPT_STORAGE_KEY]: JSON.stringify(updated),
      });
      this.notifyReviewPromptListeners(updated);
      return updated;
    } catch (error) {
      console.error('Error dismissing review prompt:', error);
      throw error;
    }
  }

  async snoozeReviewPromptUntil(snoozeUntil: number): Promise<ReviewPromptState> {
    try {
      const current = await this.getReviewPromptState();
      const updated: ReviewPromptState = { ...current, snoozeUntil };
      await chrome.storage.local.set({
        [REVIEW_PROMPT_STORAGE_KEY]: JSON.stringify(updated),
      });
      this.notifyReviewPromptListeners(updated);
      return updated;
    } catch (error) {
      console.error('Error snoozing review prompt:', error);
      throw error;
    }
  }

  subscribeReviewPrompt(listener: ReviewPromptListener): () => void {
    this.reviewPromptListeners.add(listener);
    return (): void => {
      this.reviewPromptListeners.delete(listener);
    };
  }

  private notifyReviewPromptListeners(state: ReviewPromptState): void {
    this.reviewPromptListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error notifying review prompt listener:', error);
      }
    });
  }

  private parseReviewPrompt(stored: string): ReviewPromptState {
    try {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      const firstSeenAt =
        typeof parsed.firstSeenAt === 'number'
          ? parsed.firstSeenAt
          : DEFAULT_REVIEW_PROMPT_STATE.firstSeenAt;
      let dismissed = false;
      if (typeof parsed.dismissed === 'boolean') {
        dismissed = parsed.dismissed;
      } else if (
        parsed.permanentlyDismissed === true ||
        parsed.markedReviewed === true
      ) {
        dismissed = true;
      }
      const snoozeUntil =
        typeof parsed.snoozeUntil === 'number' ? parsed.snoozeUntil : null;
      return { firstSeenAt, dismissed, snoozeUntil };
    } catch (error) {
      console.error('Error parsing review prompt state:', error);
      return { ...DEFAULT_REVIEW_PROMPT_STATE };
    }
  }
}

export const storageService = new StorageService();
