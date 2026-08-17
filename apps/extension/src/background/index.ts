import type { ExtMessage, ExtResponse, JobExtractionResult, JobPosting } from '@job-ai/types';
import { AIError, nowIso } from '@job-ai/types';
import { DataStore } from '@job-ai/core';
import { ChromeStorageAdapter } from '../lib/chromeStorage.ts';
import { handleMessage } from './handlers.ts';

export const store = new DataStore(new ChromeStorageAdapter());

const detectedByTab = new Map<number, JobExtractionResult>();

export function getDetected(tabId: number | undefined): JobExtractionResult | null {
  return tabId === undefined ? null : (detectedByTab.get(tabId) ?? null);
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await store.init();
  if (details.reason === 'install') {
    
    await chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  detectedByTab.delete(tabId);
});

chrome.runtime.onMessage.addListener((message: ExtMessage, sender, sendResponse) => {
  if (message.type === 'JOB_DETECTED') {
    const tabId = sender.tab?.id;
    if (tabId !== undefined) {
      detectedByTab.set(tabId, message.payload);
      void updateBadge(tabId, message.payload);
    }
    sendResponse({ ok: true, data: { ok: true } });
    return false;
  }

  handleMessage(message, sender)
    .then((data) => sendResponse({ ok: true, data } as ExtResponse<unknown>))
    .catch((err: unknown) => {
      sendResponse({ ok: false, error: toErrorPayload(err) } as ExtResponse<never>);
    });
  return true;
});

function toErrorPayload(err: unknown): { code: string; message: string } {
  if (err instanceof AIError) return { code: err.code, message: err.message };
  if (err instanceof Error) return { code: 'internal', message: err.message };
  return { code: 'unknown', message: 'Something went wrong.' };
}

async function updateBadge(tabId: number, result: JobExtractionResult): Promise<void> {
  try {
    if (result.ok) {
      await chrome.action.setBadgeText({ tabId, text: '•' });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#3b5bdb' });
      await chrome.action.setTitle({ tabId, title: 'Job detected — click to analyze your match' });
    } else {
      await chrome.action.setBadgeText({ tabId, text: '' });
    }
  } catch {
    
  }
}

export function stampCaptured(job: Partial<JobPosting>): Partial<JobPosting> {
  return { ...job, capturedAt: job.capturedAt ?? nowIso() };
}

void store.init();
