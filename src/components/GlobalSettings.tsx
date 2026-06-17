import React, { useState, useEffect } from 'react';
import { DUPLICATE_ACTION_OPTIONS, type DuplicateAction } from '@/types/settings';
import { RadioGroup } from './RadioGroup';
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
import { textBody, textCardTitle } from '@/ui-classes/typography';

interface GlobalSettingsProps {
  className?: string;
  initialGlobalSettings: {
    duplicateAction: DuplicateAction;
    ignoreParameters: boolean;
  };
}

export const GlobalSettings: React.FC<GlobalSettingsProps> = ({
  className = '',
  initialGlobalSettings,
}: GlobalSettingsProps): React.JSX.Element => {
  const [duplicateActionState, setDuplicateActionState] = useState<DuplicateAction>(
    initialGlobalSettings.duplicateAction
  );
  const [ignoreParametersState, setIgnoreParametersState] = useState<boolean>(
    initialGlobalSettings.ignoreParameters
  );

  useEffect(() => {
    const unsubscribe = storageService.subscribe((settings) => {
      setDuplicateActionState(settings.globalSettings.duplicateAction);
      setIgnoreParametersState(settings.globalSettings.ignoreParameters);
    });

    return (): void => {
      unsubscribe();
    };
  }, []);

  const handleDuplicateActionChange = async (value: string): Promise<void> => {
    const action = value as DuplicateAction;
    setDuplicateActionState(action);
    await storageService.updateSettings({
      globalSettings: {
        duplicateAction: action,
        ignoreParameters: ignoreParametersState,
      },
    });
  };

  const handleIgnoreParametersChange = async (checked: boolean): Promise<void> => {
    setIgnoreParametersState(checked);
    await storageService.updateSettings({
      globalSettings: {
        duplicateAction: duplicateActionState,
        ignoreParameters: checked,
      },
    });
  };

  return (
    <div className={`${cardShell} flex min-h-0 flex-col ${className}`}>
      <div className={`${gradientBarClass} ${cardShellTopRadius}`} />
      <div className={cardHeaderRow}>
        <div className={cardIconBox}>
          <svg className={`${cardIconSvg} text-brand`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 className={textCardTitle}>Global Settings</h2>
      </div>
      <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
        <div className={innerPanel}>
          <RadioGroup
            label="When duplicate tab detected"
            value={duplicateActionState}
            options={DUPLICATE_ACTION_OPTIONS}
            onChange={handleDuplicateActionChange}
          />
          <p className={`ml-0 mt-1 ${textBody}`}>Choose how to handle duplicate tabs</p>
        </div>
        <div className={innerPanelFlat}>
          <Toggle
            label="Ignore URL parameters"
            description="Match URLs without query parameters (?id=123, etc.)"
            checked={ignoreParametersState}
            onChange={handleIgnoreParametersChange}
            interactiveRow
            className={toggleRowInset}
          />
        </div>
      </div>
    </div>
  );
};
