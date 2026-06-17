import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import { CurrentDomainSettings } from '@/components/CurrentDomainSettings';
import { ExtensionStatus } from '@/components/ExtensionStatus';
import { Footer } from '@/components/Footer';
import { GlobalSettings } from '@/components/GlobalSettings';
import { Header } from '@/components/Header';
import { Loading } from '@/components/Loading';
import { ReviewPrompt } from '@/components/ReviewPrompt';
import { useExtensionPage } from '@/hooks/useExtensionPage';
import { optionsMainStack, optionsPairedCard, optionsPairedGrid } from '@/ui-classes/layout';
import '../styles/index.css';

const SiteList = React.lazy(async () => {
  const module = await import('@/components/SiteList');
  return { default: module.SiteList };
});

const SiteSpecificRules = React.lazy(async () => {
  const module = await import('@/components/SiteSpecificRules');
  return { default: module.SiteSpecificRules };
});

const OptionsCardFallback: React.FC = (): React.JSX.Element => (
  <div className="min-h-[12rem] animate-pulse rounded-xl border border-gray-200 bg-white" />
);

const Options: React.FC = (): React.JSX.Element => {
  const {
    settings,
    currentTabsCount,
    tabsClosedCount,
    activeTab,
    activeTabResolved,
    isLoading,
  } = useExtensionPage();

  if (isLoading || !settings) {
    return <Loading title="Prevent Duplicate Tabs" subtitle="Extension configuration" isPopup={false} />;
  }

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-white">
      <Header
        title="Prevent Duplicate Tabs"
        subtitle="Extension configuration"
        stats={{ currentTabsCount, tabsClosedCount }}
      />
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className={optionsMainStack}>
          <ReviewPrompt enabled={settings.enabled} deferMount />
          <div className={optionsPairedGrid}>
            <ExtensionStatus
              initialEnabled={settings.enabled}
              initialPreventionScope={settings.preventionScope}
              initialDuplicateScope={settings.globalSettings.duplicateScope}
              className={optionsPairedCard}
            />
            <GlobalSettings initialGlobalSettings={settings.globalSettings} className={optionsPairedCard} />
          </div>
          <CurrentDomainSettings
            initialSettings={settings}
            activeTab={activeTab}
            activeTabResolved={activeTabResolved}
          />
          <div className={optionsPairedGrid}>
            <Suspense fallback={<OptionsCardFallback />}>
              <SiteList initialSettings={settings} className={optionsPairedCard} />
            </Suspense>
            <Suspense fallback={<OptionsCardFallback />}>
              <SiteSpecificRules initialSiteRules={settings.siteRules} className={optionsPairedCard} />
            </Suspense>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const container: HTMLElement | null = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Options />);
}
