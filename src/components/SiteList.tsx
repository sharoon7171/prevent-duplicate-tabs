import React, { useState, useEffect, useMemo } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { storageService } from '@/services/storage';
import { normalizeException } from '@/utils/urlNormalization';
import { gradientBarClass } from '@/ui-classes/gradient-bar';
import { iconButtonSvg, inputInlineEdit } from '@/ui-classes/control';
import {
  cardHeaderRow,
  cardIconBox,
  cardIconBoxAmber,
  cardIconSvg,
  cardShell,
  cardShellTopRadius,
  emptyStateIcon,
  emptyStateIconSvg,
  emptyStateWrap,
  listItemShell,
  scrollListFrame,
  optionsListScroll,
} from '@/ui-classes/layout';
import { textBadge, textBodyBold, textCaption, textCardSubtitle, textCardTitle } from '@/ui-classes/typography';
import type { ExtensionSettings, PreventionScope } from '@/types/settings';

type SiteKind = 'domain' | 'page';

interface SiteItem {
  kind: SiteKind;
  value: string;
}

interface SiteListProps {
  className?: string;
  initialSettings: ExtensionSettings;
}

export const SiteList: React.FC<SiteListProps> = ({
  className = '',
  initialSettings,
}: SiteListProps): React.JSX.Element => {
  const [preventionScope, setPreventionScope] = useState<PreventionScope>(
    initialSettings.preventionScope
  );
  const [pages, setPages] = useState<string[]>(() =>
    initialSettings.preventionScope === 'listed-only'
      ? initialSettings.targetPages
      : initialSettings.exceptions
  );
  const [domains, setDomains] = useState<string[]>(() =>
    initialSettings.preventionScope === 'listed-only'
      ? initialSettings.targetDomains
      : initialSettings.domainExceptions
  );
  const [inputValue, setInputValue] = useState<string>('');
  const [inputKind, setInputKind] = useState<SiteKind>('domain');
  const [searchValue, setSearchValue] = useState<string>('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  const isListedOnly = preventionScope === 'listed-only';

  const siteItems = useMemo((): SiteItem[] => {
    const domainItems: SiteItem[] = domains.map((value) => ({ kind: 'domain', value }));
    const pageItems: SiteItem[] = pages.map((value) => ({ kind: 'page', value }));
    return [...domainItems, ...pageItems];
  }, [domains, pages]);

  const filteredItems = useMemo(() => {
    if (!searchValue.trim()) {
      return siteItems;
    }
    const searchLower = searchValue.toLowerCase();
    return siteItems.filter((item) => item.value.toLowerCase().includes(searchLower));
  }, [siteItems, searchValue]);

  useEffect(() => {
    const syncFromSettings = (settings: {
      preventionScope: PreventionScope;
      exceptions: string[];
      domainExceptions: string[];
      targetPages: string[];
      targetDomains: string[];
    }): void => {
      setPreventionScope(settings.preventionScope);
      if (settings.preventionScope === 'listed-only') {
        setPages(settings.targetPages);
        setDomains(settings.targetDomains);
      } else {
        setPages(settings.exceptions);
        setDomains(settings.domainExceptions);
      }
    };

    const unsubscribe = storageService.subscribe(syncFromSettings);

    return (): void => {
      unsubscribe();
    };
  }, []);

  const persistSites = async (nextPages: string[], nextDomains: string[]): Promise<void> => {
    if (isListedOnly) {
      await storageService.updateSettings({ targetPages: nextPages, targetDomains: nextDomains });
      return;
    }
    await storageService.updateSettings({ exceptions: nextPages, domainExceptions: nextDomains });
  };

  const isDuplicate = (kind: SiteKind, value: string): boolean => {
    if (kind === 'domain') {
      return domains.includes(value);
    }
    return pages.includes(value);
  };

  const handleAdd = async (): Promise<void> => {
    if (!inputValue.trim()) {
      return;
    }

    const normalized = normalizeException(inputValue.trim());
    if (isDuplicate(inputKind, normalized)) {
      setInputValue('');
      return;
    }

    if (inputKind === 'domain') {
      const nextDomains = [...domains, normalized];
      setDomains(nextDomains);
      await persistSites(pages, nextDomains);
    } else {
      const nextPages = [...pages, normalized];
      setPages(nextPages);
      await persistSites(nextPages, domains);
    }
    setInputValue('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd().catch((error) => {
        console.error('Error adding site:', error);
      });
    }
  };

  const handleRemove = async (item: SiteItem): Promise<void> => {
    if (item.kind === 'domain') {
      const nextDomains = domains.filter((value) => value !== item.value);
      setDomains(nextDomains);
      await persistSites(pages, nextDomains);
      return;
    }
    const nextPages = pages.filter((value) => value !== item.value);
    setPages(nextPages);
    await persistSites(nextPages, domains);
  };

  const handleEditStart = (item: SiteItem): void => {
    setEditingKey(`${item.kind}:${item.value}`);
    setEditingValue(item.value);
  };

  const handleEditCancel = (): void => {
    setEditingKey(null);
    setEditingValue('');
  };

  const handleEditSave = async (item: SiteItem): Promise<void> => {
    if (!editingValue.trim()) {
      handleEditCancel();
      return;
    }

    const normalized = normalizeException(editingValue.trim());
    const duplicate =
      item.kind === 'domain'
        ? domains.some((value) => value === normalized && value !== item.value)
        : pages.some((value) => value === normalized && value !== item.value);

    if (!duplicate) {
      if (item.kind === 'domain') {
        const nextDomains = domains.map((value) => (value === item.value ? normalized : value));
        setDomains(nextDomains);
        await persistSites(pages, nextDomains);
      } else {
        const nextPages = pages.map((value) => (value === item.value ? normalized : value));
        setPages(nextPages);
        await persistSites(nextPages, domains);
      }
    }

    handleEditCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent, item: SiteItem): void => {
    if (e.key === 'Enter') {
      handleEditSave(item).catch((error) => {
        console.error('Error saving edit:', error);
      });
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  const title = isListedOnly ? 'Monitored Sites' : 'Exceptions';
  const subtitle = isListedOnly
    ? 'Prevent duplicates only on these domains or pages'
    : 'Allow duplicates on these domains or pages';
  const addLabel = isListedOnly ? 'Add Site' : 'Add Exception';
  const emptyLabel = isListedOnly ? 'No monitored sites added yet' : 'No exceptions added yet';
  const iconBoxClass = isListedOnly ? cardIconBox : cardIconBoxAmber;
  const iconClass = isListedOnly ? 'text-brand' : 'text-amber-600';
  const badgeClass = isListedOnly
    ? 'rounded-full bg-linear-to-r from-brand to-emerald-600 px-2 py-0.5 text-white shadow-md'
    : 'rounded-full bg-linear-to-r from-amber-600 to-orange-600 px-2 py-0.5 text-white shadow-md';

  return (
    <div className={`${cardShell} flex h-full min-h-0 flex-col ${className}`}>
      <div className={`${gradientBarClass} ${cardShellTopRadius}`} />
      <div className={cardHeaderRow}>
        <div className={iconBoxClass}>
          <svg className={`${cardIconSvg} ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isListedOnly ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            )}
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className={textCardTitle}>{title}</h2>
            {siteItems.length > 0 && (
              <span className={`${textBadge} ${badgeClass}`}>
                {siteItems.length}
              </span>
            )}
          </div>
          <p className={`mt-0.5 ${textCardSubtitle}`}>{subtitle}</p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0">
      <div className="mb-1.5 flex flex-col gap-1.5 sm:flex-row">
        <div className="flex-1">
          <Input
            placeholder={inputKind === 'domain' ? 'example.com' : 'example.com/page'}
            value={inputValue}
            onChange={setInputValue}
            onKeyDown={handleInputKeyDown}
          />
        </div>
        <div className="flex gap-1.5">
          <Button
            variant={inputKind === 'domain' ? 'primary' : 'secondary'}
            onClick={(): void => setInputKind('domain')}
            className="whitespace-nowrap"
          >
            Domain
          </Button>
          <Button
            variant={inputKind === 'page' ? 'primary' : 'secondary'}
            onClick={(): void => setInputKind('page')}
            className="whitespace-nowrap"
          >
            Page
          </Button>
          <Button onClick={handleAdd} className="whitespace-nowrap">
            {addLabel}
          </Button>
        </div>
      </div>

      {siteItems.length > 0 && (
        <div className="mb-1.5">
          <Input
            placeholder="Search..."
            value={searchValue}
            onChange={setSearchValue}
          />
        </div>
      )}

        </div>

      <div className={`${scrollListFrame} mt-auto`}>
        <div className={optionsListScroll}>
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const itemKey = `${item.kind}:${item.value}`;
              const isEditing = editingKey === itemKey;

              return (
                <div key={itemKey} className={listItemShell}>
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e): void => setEditingValue(e.target.value)}
                        onKeyDown={(e): void => handleKeyDown(e, item)}
                        className={inputInlineEdit}
                        autoFocus
                      />
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          variant="ghost"
                          color="success"
                          onClick={(): void => {
                            handleEditSave(item).catch((error) => {
                              console.error('Error saving edit:', error);
                            });
                          }}
                          title="Save (Enter)"
                        >
                          <svg className={iconButtonSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </Button>
                        <Button variant="ghost" color="muted" onClick={handleEditCancel} title="Cancel (Esc)">
                          <svg className={iconButtonSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span
                        className={`${textBadge} mr-2 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-gray-600`}
                      >
                        {item.kind === 'domain' ? 'Domain' : 'Page'}
                      </span>
                      <span className={`${textBodyBold} mr-2 min-w-0 flex-1 break-all`} title={item.value}>
                        {item.value}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          variant="ghost"
                          color="brand"
                          onClick={(): void => handleEditStart(item)}
                          title="Edit"
                        >
                          <svg className={iconButtonSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Button>
                        <Button
                          variant="ghost"
                          color="danger"
                          onClick={(): void => {
                            handleRemove(item).catch((error) => {
                              console.error('Error removing site:', error);
                            });
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          ) : siteItems.length === 0 ? (
            <div className={emptyStateWrap}>
              <div className={emptyStateIcon}>
                <svg className={emptyStateIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className={textCaption}>{emptyLabel}</p>
            </div>
          ) : (
            <div className={emptyStateWrap}>
              <div className={emptyStateIcon}>
                <svg className={emptyStateIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className={textCaption}>No items match your search</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
