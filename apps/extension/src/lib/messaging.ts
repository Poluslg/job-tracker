import type { ExtMessage, ExtResponse, ExtResponseMap } from '@job-ai/types';

export class MessageError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'MessageError';
    this.code = code;
  }
}

export async function send<T extends ExtMessage['type']>(
  message: Extract<ExtMessage, { type: T }>,
): Promise<ExtResponseMap[T]> {
  let response: ExtResponse<ExtResponseMap[T]> | undefined;
  try {
    response = (await chrome.runtime.sendMessage(message)) as ExtResponse<ExtResponseMap[T]>;
  } catch (err) {
    throw new MessageError(
      'disconnected',
      err instanceof Error && /context invalidated/i.test(err.message)
        ? 'The extension was reloaded. Close and reopen this window.'
        : 'Could not reach the extension background service. Try again.',
    );
  }

  if (!response) throw new MessageError('empty', 'The background service did not respond.');
  if (!response.ok) throw new MessageError(response.error.code, response.error.message);
  return response.data;
}

export async function sendToTab<T extends ExtMessage['type']>(
  tabId: number,
  message: Extract<ExtMessage, { type: T }>,
): Promise<ExtResponseMap[T]> {
  let response: ExtResponse<ExtResponseMap[T]> | undefined;
  try {
    response = (await chrome.tabs.sendMessage(tabId, message)) as ExtResponse<ExtResponseMap[T]>;
  } catch {
    throw new MessageError(
      'no-content-script',
      'This page cannot be read by the extension. Chrome blocks extensions on browser pages, the Web Store and PDF viewers.',
    );
  }
  if (!response) throw new MessageError('empty', 'The page did not respond.');
  if (!response.ok) throw new MessageError(response.error.code, response.error.message);
  return response.data;
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

export function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true;
  return /^(chrome|edge|about|devtools|view-source|chrome-extension|moz-extension):/i.test(url) ||
    url.startsWith('https://chromewebstore.google.com') ||
    url.startsWith('https://chrome.google.com/webstore');
}
