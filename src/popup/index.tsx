import React from 'react';
import { createRoot } from 'react-dom/client';

import { CurrentDomainSettings } from '@/components/CurrentDomainSettings';
import { ExtensionStatus } from '@/components/ExtensionStatus';
import { Footer } from '@/components/Footer';
import { GlobalSettings } from '@/components/GlobalSettings';
import { Header } from '@/components/Header';
import { Loading } from '@/components/Loading';
import { ReviewPrompt } from '@/components/ReviewPrompt';
import { useExtensionPage } from '@/hooks/useExtensionPage';
import { popupMainStack } from '@/ui-classes/layout';
import '../styles/index.css';

const Popup: React.FC = (): React.JSX.Element => {
  const {
    settings,
    currentTabsCount,
    tabsClosedCount,
    activeTab,
    activeTabResolved,
    isLoading,
  } = useExtensionPage();

  if (isLoading || !settings) {
    return <Loading title="Prevent Duplicate Tabs" subtitle="Extension settings" isPopup={true} />;
  }

  return (
    <div className="h-full min-h-0 w-full min-w-0 flex flex-col overflow-hidden bg-slate-50">
      <Header
        title="Prevent Duplicate Tabs"
        subtitle="Extension settings"
        stats={{ currentTabsCount, tabsClosedCount }}
      />
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className={popupMainStack}>
          <ReviewPrompt variant="popup" enabled={settings.enabled} deferMount />
          <ExtensionStatus
            initialEnabled={settings.enabled}
            initialPreventionScope={settings.preventionScope}
            initialDuplicateScope={settings.globalSettings.duplicateScope}
          />
          <CurrentDomainSettings
            initialSettings={settings}
            activeTab={activeTab}
            activeTabResolved={activeTabResolved}
          />
          <GlobalSettings initialGlobalSettings={settings.globalSettings} />
        </div>
      </main>
      <Footer variant="popup" />
    </div>
  );
};

const container: HTMLElement | null = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
