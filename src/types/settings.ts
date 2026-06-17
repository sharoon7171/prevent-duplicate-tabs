export type DuplicateAction =
  | 'close-new-stay-current'
  | 'close-old-stay-current'
  | 'close-new-switch-existing'
  | 'close-old-switch-new';

export const DUPLICATE_ACTION_OPTIONS: ReadonlyArray<{ value: DuplicateAction; label: string }> = [
  { value: 'close-new-stay-current', label: 'Close new duplicate tab and stay on current tab' },
  { value: 'close-old-stay-current', label: 'Close old duplicate and stay on current tab' },
  { value: 'close-new-switch-existing', label: 'Close new duplicate tab and switch to existing tab' },
  { value: 'close-old-switch-new', label: 'Close old duplicate and switch to new tab' },
];

export type DuplicateScope = 'all-windows' | 'current-window';

export type PreventionScope = 'everywhere' | 'listed-only';

export interface SiteRule {
  domain: string;
  duplicateAction: DuplicateAction;
  ignoreParameters: boolean;
}

export interface ExtensionSettings {
  enabled: boolean;
  preventionScope: PreventionScope;
  targetPages: string[];
  targetDomains: string[];
  targetPageSkips: string[];
  globalSettings: {
    duplicateAction: DuplicateAction;
    ignoreParameters: boolean;
    duplicateScope: DuplicateScope;
  };
  exceptions: string[];
  domainExceptions: string[];
  siteRules: SiteRule[];
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  preventionScope: 'everywhere',
  targetPages: [],
  targetDomains: [],
  targetPageSkips: [],
  globalSettings: {
    duplicateAction: 'close-new-stay-current',
    ignoreParameters: false,
    duplicateScope: 'all-windows',
  },
  exceptions: [],
  domainExceptions: [],
  siteRules: [],
};

export const SETTINGS_STORAGE_KEY = 'extensionSettings';

export interface StatisticsData {
  tabsClosedCount: number;
}

export const DEFAULT_STATISTICS: StatisticsData = {
  tabsClosedCount: 0,
};

export const STATISTICS_STORAGE_KEY = 'extensionStatistics';

