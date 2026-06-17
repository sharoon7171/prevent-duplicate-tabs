import React from 'react';

import { CHROME_WEB_STORE_REVIEWS_URL } from '@/constants/chromeWebStore';
import { NEW_ISSUE_URL } from '@/constants/repo';
import { gradientBarClass } from '@/ui-classes/gradient-bar';
import {
  footerActions,
  footerAttribution,
  footerButton,
  footerButtonGroup,
  footerInner,
  footerInnerOptions,
  footerRow,
  footerShell,
} from '@/ui-classes/footer';

interface FooterProps {
  variant?: 'default' | 'popup';
}

const FOOTER_LINKS = [
  { href: CHROME_WEB_STORE_REVIEWS_URL, label: 'Rate extension' },
  { href: `${NEW_ISSUE_URL}?labels=enhancement`, label: 'Request feature' },
  { href: `${NEW_ISSUE_URL}?labels=bug`, label: 'Report bug' },
] as const;

export const Footer: React.FC<FooterProps> = ({
  variant = 'default',
}: FooterProps): React.JSX.Element => {
  const isPopup = variant === 'popup';

  return (
    <footer className={`${footerShell} ${isPopup ? 'bg-slate-100/95' : 'bg-slate-50'}`}>
      <div className={gradientBarClass} />
      <div className={isPopup ? footerInner : footerInnerOptions}>
        <div className={footerRow}>
          <p className={footerAttribution}>
            By{' '}
            <a
              href="https://www.sqtech.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-brand transition-colors duration-200 hover:text-brand-dark"
            >
              SQ Tech
            </a>
          </p>
          <nav className={footerActions} aria-label="Extension links">
            <div className={footerButtonGroup}>
              {FOOTER_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={footerButton}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </footer>
  );
};
