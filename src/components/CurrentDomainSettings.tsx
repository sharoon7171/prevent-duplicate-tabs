import React, { useState, useEffect } from 'react';
import { Toggle } from './Toggle';
import { RadioGroup } from './RadioGroup';
import { Button } from './Button';
import { storageService } from '@/services/storage';
import { DUPLICATE_ACTION_OPTIONS, type ExtensionSettings, type DuplicateAction } from '@/types/settings';
import { normalizeException, isPageInExceptions, isDomainInExceptions } from '@/utils/urlNormalization';
import type { ActiveTabInfo } from '@/utils/activeTab';
import { gradientBarClass } from '@/ui-classes/gradient-bar';
import {
  accentPanel,
  cardHeaderRow,
  cardIconBox,
  cardIconSvg,
  cardShell,
  cardShellTopRadius,
  innerPanel,
  innerPanelFlat,
  toggleRowInset,
} from '@/ui-classes/layout';
import { textBody, textCardSubtitle, textCardTitle, textSectionLabel } from '@/ui-classes/typography';

interface CurrentDomainSettingsProps {
  className?: string;
  initialSettings: ExtensionSettings;
  activeTab: ActiveTabInfo | null;
  activeTabResolved: boolean;
}

export const CurrentDomainSettings: React.FC<CurrentDomainSettingsProps> = ({
  initialSettings,
  activeTab,
  activeTabResolved = false,
  className = '',
}: CurrentDomainSettingsProps): React.JSX.Element | null => {
  const [settings, setSettings] = useState<ExtensionSettings>(initialSettings);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [currentDomain, setCurrentDomain] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = storageService.subscribe((updatedSettings) => {
      setSettings(updatedSettings);
    });

    return (): void => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!activeTabResolved) {
      return;
    }

    setCurrentUrl(activeTab?.url ?? null);
    setCurrentDomain(activeTab?.domain ?? null);
    setIsLoading(false);
  }, [activeTab, activeTabResolved]);

  if (isLoading || !currentUrl || !currentDomain) {
    return null;
  }

  const isPageInExceptionsList = currentUrl ? isPageInExceptions(currentUrl, settings.exceptions) : false;
  const isDomainInExceptionsList = currentDomain ? isDomainInExceptions(currentDomain, settings.domainExceptions) : false;
  const isPageInSkipsList = currentUrl ? isPageInExceptions(currentUrl, settings.targetPageSkips) : false;
  const isPageInTargetsList = currentUrl ? isPageInExceptions(currentUrl, settings.targetPages) : false;
  const isDomainInTargetsList = currentDomain ? isDomainInExceptions(currentDomain, settings.targetDomains) : false;
  const isListedOnly = settings.preventionScope === 'listed-only';
  const pageIsMonitored =
    isPageInTargetsList || (isDomainInTargetsList && !isPageInSkipsList);
  const pageToggleChecked = isListedOnly ? pageIsMonitored : isPageInExceptionsList;
  const domainToggleChecked = isListedOnly ? isDomainInTargetsList : isDomainInExceptionsList;
  const pageToggleLabel = isListedOnly ? 'Monitor this page' : 'Allow duplicates for this page';
  const domainToggleLabel = isListedOnly
    ? `Monitor ${currentDomain}`
    : `Allow duplicates for ${currentDomain}`;
  const pageToggleDescription = isListedOnly
    ? isDomainInTargetsList && !isPageInTargetsList
      ? 'Include this page when the domain is monitored'
      : 'Prevent duplicate tabs for this specific page'
    : 'Allow duplicate tabs for this specific page';
  const domainToggleDescription = isListedOnly
    ? `Prevent duplicate tabs for all pages on ${currentDomain}`
    : `Allow duplicate tabs for all pages on ${currentDomain}`;
  const scopeSectionLabel = isListedOnly ? 'Monitoring' : 'Exceptions';
  const currentSiteRule = settings.siteRules.find((rule) => rule.domain === currentDomain);
  const hasSiteRule = currentSiteRule !== undefined;

  const currentDuplicateAction: DuplicateAction = currentSiteRule?.duplicateAction ?? settings.globalSettings.duplicateAction;
  const currentIgnoreParameters: boolean = currentSiteRule?.ignoreParameters ?? settings.globalSettings.ignoreParameters;

  const handleUrlExceptionToggle = async (checked: boolean): Promise<void> => {
    if (!settings || !currentUrl) return;

    const normalizedUrl = normalizeException(currentUrl);

    const updatedExceptions = checked
      ? [...settings.exceptions, normalizedUrl].filter((item, index, arr) => arr.indexOf(item) === index)
      : settings.exceptions.filter((item) => {
          const normalizedItem = normalizeException(item);
          return normalizedItem !== normalizedUrl && item !== currentUrl;
        });

    await storageService.updateSettings({ exceptions: updatedExceptions });
  };

  const handleDomainExceptionToggle = async (checked: boolean): Promise<void> => {
    if (!settings || !currentDomain) return;

    const normalizedDomain = normalizeException(currentDomain);

    const updatedDomainExceptions = checked
      ? [...settings.domainExceptions, normalizedDomain].filter((item, index, arr) => arr.indexOf(item) === index)
      : settings.domainExceptions.filter((item) => {
          const normalizedItem = normalizeException(item);
          return normalizedItem !== normalizedDomain && item !== currentDomain;
        });

    await storageService.updateSettings({ domainExceptions: updatedDomainExceptions });
  };

  const handlePageTargetToggle = async (checked: boolean): Promise<void> => {
    if (!settings || !currentUrl) return;

    const normalizedUrl = normalizeException(currentUrl);

    const updatedTargetPages = checked
      ? [...settings.targetPages, normalizedUrl].filter((item, index, arr) => arr.indexOf(item) === index)
      : settings.targetPages.filter((item) => {
          const normalizedItem = normalizeException(item);
          return normalizedItem !== normalizedUrl && item !== currentUrl;
        });

    await storageService.updateSettings({ targetPages: updatedTargetPages });
  };

  const handleDomainTargetToggle = async (checked: boolean): Promise<void> => {
    if (!settings || !currentDomain) return;

    const normalizedDomain = normalizeException(currentDomain);

    const updatedTargetDomains = checked
      ? [...settings.targetDomains, normalizedDomain].filter((item, index, arr) => arr.indexOf(item) === index)
      : settings.targetDomains.filter((item) => {
          const normalizedItem = normalizeException(item);
          return normalizedItem !== normalizedDomain && item !== currentDomain;
        });

    await storageService.updateSettings({ targetDomains: updatedTargetDomains });
  };

  const handlePageSkipToggle = async (checked: boolean): Promise<void> => {
    if (!settings || !currentUrl) return;

    const normalizedUrl = normalizeException(currentUrl);

    const updatedSkips = checked
      ? [...settings.targetPageSkips, normalizedUrl].filter((item, index, arr) => arr.indexOf(item) === index)
      : settings.targetPageSkips.filter((item) => {
          const normalizedItem = normalizeException(item);
          return normalizedItem !== normalizedUrl && item !== currentUrl;
        });

    await storageService.updateSettings({ targetPageSkips: updatedSkips });
  };

  const handlePageToggle = async (checked: boolean): Promise<void> => {
    if (!isListedOnly) {
      await handleUrlExceptionToggle(checked);
      return;
    }
    if (isDomainInTargetsList && !isPageInTargetsList) {
      await handlePageSkipToggle(!checked);
      return;
    }
    await handlePageTargetToggle(checked);
  };

  const handleDomainToggle = async (checked: boolean): Promise<void> => {
    if (!isListedOnly) {
      await handleDomainExceptionToggle(checked);
      return;
    }
    await handleDomainTargetToggle(checked);
  };

  const handleCreateOrUpdateSiteRule = async (updates: { duplicateAction?: DuplicateAction; ignoreParameters?: boolean }): Promise<void> => {
    if (!settings || !currentDomain) return;

    const existingRule = settings.siteRules.find((rule) => rule.domain === currentDomain);
    const currentDuplicateAction = existingRule?.duplicateAction ?? settings.globalSettings.duplicateAction;
    const currentIgnoreParameters = existingRule?.ignoreParameters ?? settings.globalSettings.ignoreParameters;

    if (existingRule) {
      const updatedRules = settings.siteRules.map((rule) =>
        rule.domain === currentDomain ? { ...rule, ...updates } : rule
      );
      await storageService.updateSettings({ siteRules: updatedRules });
    } else {
      const newRule = {
        domain: currentDomain,
        duplicateAction: updates.duplicateAction ?? currentDuplicateAction,
        ignoreParameters: updates.ignoreParameters ?? currentIgnoreParameters,
      };
      await storageService.updateSettings({ siteRules: [...settings.siteRules, newRule] });
    }
  };

  const handleRemoveSiteRule = async (): Promise<void> => {
    if (!settings) return;

    const updatedRules = settings.siteRules.filter((rule) => rule.domain !== currentDomain);
    await storageService.updateSettings({ siteRules: updatedRules });
  };

  return (
    <div 
      className={`${cardShell} ${className}`}
    >
      <div className={`${gradientBarClass} ${cardShellTopRadius}`} />
      <div className={cardHeaderRow}>
        <div className={cardIconBox}>
          <svg className={`${cardIconSvg} text-brand`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className={textCardTitle}>Current Domain</h2>
          <p className={`mt-0.5 truncate ${textCardSubtitle}`} title={currentUrl}>
            {currentDomain}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="space-y-1.5">
          <h3 className={textSectionLabel}>{scopeSectionLabel}</h3>
          <div className={accentPanel}>
            <Toggle
              label={pageToggleLabel}
              description={pageToggleDescription}
              checked={pageToggleChecked}
              onChange={handlePageToggle}
              interactiveRow
              className={toggleRowInset}
            />
          </div>
          <div className={accentPanel}>
            <Toggle
              label={domainToggleLabel}
              description={domainToggleDescription}
              checked={domainToggleChecked}
              onChange={handleDomainToggle}
              interactiveRow
              className="w-full p-2.5"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h3 className={textSectionLabel}>Site-Specific Rules</h3>
            {hasSiteRule && (
              <Button variant="ghost" color="danger" onClick={handleRemoveSiteRule} className="text-xs px-2 py-1">
                Remove Rule
              </Button>
            )}
          </div>
          
          
          <div className="space-y-1.5">
            <div className={innerPanel}>
              <RadioGroup
                label="When duplicate tab detected"
                value={currentDuplicateAction}
                options={DUPLICATE_ACTION_OPTIONS}
                onChange={(value): void => {
                  handleCreateOrUpdateSiteRule({ duplicateAction: value as DuplicateAction }).catch((error) => {
                    console.error('Error updating site rule:', error);
                  });
                }}
              />
              <p className={`ml-0 mt-1 ${textBody}`}>Choose how to handle duplicate tabs for this domain</p>
            </div>
            <div className={innerPanelFlat}>
              <Toggle
                label="Ignore URL parameters"
                description="Match URLs without query parameters (?id=123, etc.)"
                checked={currentIgnoreParameters}
                onChange={(checked): void => {
                  handleCreateOrUpdateSiteRule({ ignoreParameters: checked }).catch((error) => {
                    console.error('Error updating site rule:', error);
                  });
                }}
                interactiveRow
                className={toggleRowInset}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
