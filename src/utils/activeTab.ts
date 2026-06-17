export interface ActiveTabInfo {
  url: string;
  domain: string;
}

export async function getActiveTabInfo(): Promise<ActiveTabInfo | null> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0]?.url;
    if (!url) {
      return null;
    }

    const urlObj = new URL(url);
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return null;
    }

    return {
      url,
      domain: urlObj.hostname,
    };
  } catch (error) {
    console.error('Error getting active tab:', error);
    return null;
  }
}
