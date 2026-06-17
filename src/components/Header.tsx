import React from 'react';

import { gradientBarClass } from '@/ui-classes/gradient-bar';
import { cardShellTopRadius, headerIcon, headerInner, headerStatBadge } from '@/ui-classes/layout';
import { textAppSubtitle, textAppTitle } from '@/ui-classes/typography';

interface HeaderProps {
  title: string;
  subtitle?: string;
  stats?: { currentTabsCount: number; tabsClosedCount: number };
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  stats,
}: HeaderProps): React.JSX.Element => {
  const getIconSrc = (): string => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL('icon-48.png');
    }
    return '/icon-48.png';
  };

  return (
    <header className="relative w-full shrink-0 overflow-hidden bg-linear-to-br from-brand to-brand-dark text-white shadow-header transition-all duration-300 hover:shadow-xl">
      <div className={`${gradientBarClass} ${cardShellTopRadius}`} />
      <div className={headerInner}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="shrink-0 text-white">
              <img src={getIconSrc()} alt="Extension Icon" className={headerIcon} />
            </div>
            <div className="flex min-w-0 flex-col">
              <h1 className={`${textAppTitle} text-white`}>{title}</h1>
              {subtitle && (
                <p className={`mt-0.5 ${textAppSubtitle} text-blue-100`}>{subtitle}</p>
              )}
            </div>
          </div>
          {stats != null && (
            <div className="flex shrink-0 items-center gap-1 font-bold">
              <span className={headerStatBadge} title="Active tabs">
                {stats.currentTabsCount.toLocaleString()} tabs
              </span>
              <span className={headerStatBadge} title="Duplicates prevented">
                {stats.tabsClosedCount.toLocaleString()} prevented
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
