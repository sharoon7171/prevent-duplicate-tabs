import React, { useState, useEffect } from 'react';

import { Toggle } from './Toggle';
import { storageService } from '@/services/storage';
import { gradientBarClass } from '@/ui-classes/gradient-bar';
import {
  cardHeaderRow,
  cardIconBox,
  cardIconSvg,
  cardShell,
  cardShellTopRadius,
  innerPanel,
  innerPanelFlat,
  toggleRowInset,
} from '@/ui-classes/layout';
import { textBody, textCaption, textCardTitle } from '@/ui-classes/typography';
import type { DuplicateScope, PreventionScope } from '@/types/settings';
import { RadioGroup } from './RadioGroup';

const PREVENTION_SCOPE_OPTIONS = [
  { value: 'everywhere', label: 'All websites' },
  { value: 'listed-only', label: 'Listed sites only' },
] as const;

interface ExtensionStatusProps {
  className?: string;
  initialEnabled: boolean;
  initialPreventionScope: PreventionScope;
  initialDuplicateScope: DuplicateScope;
}

export const ExtensionStatus: React.FC<ExtensionStatusProps> = ({
  initialEnabled,
  initialPreventionScope,
  initialDuplicateScope,
  className = '',
}: ExtensionStatusProps): React.JSX.Element => {
  const [isEnabled, setIsEnabled] = useState<boolean>(initialEnabled);
  const [checkAllWindows, setCheckAllWindows] = useState<boolean>(
    initialDuplicateScope === 'all-windows'
  );
  const [preventionScope, setPreventionScope] = useState<PreventionScope>(initialPreventionScope);

  useEffect(() => {
    const unsubscribe = storageService.subscribe((settings) => {
      setIsEnabled(settings.enabled);
      setCheckAllWindows(settings.globalSettings.duplicateScope === 'all-windows');
      setPreventionScope(settings.preventionScope);
    });

    return (): void => {
      unsubscribe();
    };
  }, []);

  const handleToggle = async (checked: boolean): Promise<void> => {
    setIsEnabled(checked);
    await storageService.updateSettings({ enabled: checked });
  };

  const handleScopeToggle = async (checked: boolean): Promise<void> => {
    const scope: DuplicateScope = checked ? 'all-windows' : 'current-window';
    setCheckAllWindows(checked);
    await storageService.updateSettings({
      globalSettings: {
        duplicateScope: scope,
      },
    });
  };

  const handlePreventionScopeChange = async (value: string): Promise<void> => {
    const scope = value as PreventionScope;
    setPreventionScope(scope);
    await storageService.updateSettings({ preventionScope: scope });
  };

  const statusCaption = !isEnabled
    ? 'Disabled'
    : preventionScope === 'listed-only'
      ? 'Active on listed sites only'
      : 'Active and monitoring tabs';

  return (
    <div
      className={`${cardShell} hover:shadow-lg ${isEnabled ? 'border-emerald-200' : ''} ${className}`}
    >
      <div className={`${gradientBarClass} ${cardShellTopRadius}`} />
      <div className={cardHeaderRow}>
        <div className={cardIconBox}>
          <svg className={`${cardIconSvg} text-emerald-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className={textCardTitle}>Extension Status</h2>
          <p className={`mt-0.5 ${textCaption} ${isEnabled ? 'text-emerald-700' : ''}`}>{statusCaption}</p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
        <div className={innerPanelFlat}>
          <Toggle
            label="Enable extension"
            description="Turn duplicate prevention on or off"
            checked={isEnabled}
            onChange={handleToggle}
            interactiveRow
            className={toggleRowInset}
          />
        </div>
        <div className={innerPanelFlat}>
          <Toggle
            label="All windows"
            description="When off, only the current window is checked"
            checked={checkAllWindows}
            onChange={handleScopeToggle}
            interactiveRow
            className={toggleRowInset}
          />
        </div>
        <div className={innerPanel}>
          <RadioGroup
            label="Prevention scope"
            value={preventionScope}
            options={PREVENTION_SCOPE_OPTIONS}
            onChange={(value): void => {
              handlePreventionScopeChange(value).catch((error) => {
                console.error('Error updating prevention scope:', error);
              });
            }}
          />
          <p className={`mt-1 ${textBody}`}>
            {preventionScope === 'listed-only'
              ? 'Only monitored sites in the list are checked'
              : 'All sites are checked except those in the list'}
          </p>
        </div>
      </div>
    </div>
  );
};
