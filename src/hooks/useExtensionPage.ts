import { useEffect, useState } from 'react';

import { storageService } from '@/services/storage';
import type { ExtensionSettings } from '@/types/settings';
import { getActiveTabInfo, type ActiveTabInfo } from '@/utils/activeTab';

async function getCurrentTabsCount(): Promise<number> {
  try {
    const tabs = await chrome.tabs.query({});
    return tabs.length;
  } catch (error) {
    console.error('Error getting tabs count:', error);
    return 0;
  }
}

export function useExtensionPage() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [currentTabsCount, setCurrentTabsCount] = useState<number>(0);
  const [tabsClosedCount, setTabsClosedCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<ActiveTabInfo | null>(null);
  const [activeTabResolved, setActiveTabResolved] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    storageService.initializeChangeListener();

    let cancelled = false;

    const refreshTabCount = (): void => {
      void getCurrentTabsCount().then((count) => {
        if (!cancelled) {
          setCurrentTabsCount(count);
        }
      });
    };

    const loadAppData = async (): Promise<void> => {
      const { settings: loadedSettings, statistics } = await storageService.getAppData();
      if (cancelled) {
        return;
      }
      setSettings(loadedSettings);
      setTabsClosedCount(statistics.tabsClosedCount);
      setIsLoading(false);
    };

    void loadAppData();
    refreshTabCount();

    void getActiveTabInfo().then((tab) => {
      if (!cancelled) {
        setActiveTab(tab);
        setActiveTabResolved(true);
      }
    });

    const unsubscribeSettings = storageService.subscribe((updatedSettings) => {
      setSettings(updatedSettings);
    });

    const unsubscribeStatistics = storageService.subscribeStatistics((statistics) => {
      setTabsClosedCount(statistics.tabsClosedCount);
    });

    const onTabCreated = (): void => {
      refreshTabCount();
    };

    const onTabRemoved = (): void => {
      refreshTabCount();
    };

    chrome.tabs.onCreated.addListener(onTabCreated);
    chrome.tabs.onRemoved.addListener(onTabRemoved);

    return (): void => {
      cancelled = true;
      unsubscribeSettings();
      unsubscribeStatistics();
      chrome.tabs.onCreated.removeListener(onTabCreated);
      chrome.tabs.onRemoved.removeListener(onTabRemoved);
    };
  }, []);

  return {
    settings,
    currentTabsCount,
    tabsClosedCount,
    activeTab,
    activeTabResolved,
    isLoading,
  };
}
