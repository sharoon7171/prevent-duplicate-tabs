function normalizePathname(pathname: string): string {
  if (pathname === '/' || pathname === '') {
    return '/';
  }
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function normalizeUrl(url: string | undefined, ignoreParameters: boolean): string | null {
  if (!url) {
    return null;
  }

  try {
    const urlObj = new URL(url);

    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return null;
    }

    const normalizedPathname = normalizePathname(urlObj.pathname);

    const isDefaultPort =
      (urlObj.protocol === 'http:' && urlObj.port === '80') ||
      (urlObj.protocol === 'https:' && urlObj.port === '443') ||
      urlObj.port === '';
    const host = isDefaultPort ? urlObj.hostname : `${urlObj.hostname}:${urlObj.port}`;

    if (ignoreParameters) {
      return `${urlObj.protocol}//${host}${normalizedPathname}`;
    }
    return `${urlObj.protocol}//${host}${normalizedPathname}${urlObj.search}`;
  } catch (error) {
    return null;
  }
}

export function normalizeException(exception: string): string {
  if (!exception || !exception.trim()) {
    return exception;
  }

  const trimmed = exception.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function extractDomain(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    const urlObj = new URL(url);

    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return null;
    }
    return urlObj.hostname.toLowerCase();
  } catch (error) {
    return null;
  }
}

export function normalizeSiteDomain(input: string | undefined): string | null {
  if (!input || !input.trim()) {
    return null;
  }
  return extractDomain(normalizeException(input.trim()));
}

export function isPageInExceptions(url: string | undefined, exceptions: string[]): boolean {
  if (!url || exceptions.length === 0) {
    return false;
  }

  const normalizedUrl = normalizeUrl(url, false);
  if (!normalizedUrl) {
    return false;
  }

  return exceptions.some((exception) => {
    const normalizedException = normalizeException(exception);
    try {
      const exceptionNormalizedUrl = normalizeUrl(normalizedException, false);
      return exceptionNormalizedUrl === normalizedUrl;
    } catch {
      return normalizedException === normalizedUrl;
    }
  });
}

export function isDomainInExceptions(domain: string | null, domainExceptions: string[]): boolean {
  if (!domain || domainExceptions.length === 0) {
    return false;
  }

  return domainExceptions.some((exception) => {
    const exceptionDomain = normalizeSiteDomain(exception);
    return exceptionDomain !== null && exceptionDomain === domain.toLowerCase();
  });
}

export function isUrlAllowedForDuplicateCheck(
  url: string | undefined,
  exceptions: string[],
  domainExceptions: string[]
): boolean {
  if (!url) return false;
  const domain = extractDomain(url);
  return isPageInExceptions(url, exceptions) || isDomainInExceptions(domain, domainExceptions);
}

export function isUrlInPreventionTargets(
  url: string | undefined,
  targetPages: string[],
  targetDomains: string[]
): boolean {
  if (!url) return false;
  const domain = extractDomain(url);
  return isPageInExceptions(url, targetPages) || isDomainInExceptions(domain, targetDomains);
}

export function isUrlMonitoredInListedMode(
  url: string | undefined,
  targetPages: string[],
  targetDomains: string[],
  targetPageSkips: string[]
): boolean {
  if (!isUrlInPreventionTargets(url, targetPages, targetDomains)) {
    return false;
  }
  return !isPageInExceptions(url, targetPageSkips);
}
