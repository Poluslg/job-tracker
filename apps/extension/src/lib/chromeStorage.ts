import type { KeyValueAdapter } from "@job-ai/core";
import { StorageQuotaError } from "@job-ai/core";

export class ChromeStorageAdapter implements KeyValueAdapter {
  private readonly area: chrome.storage.StorageArea;

  constructor(area: chrome.storage.StorageArea = chrome.storage.local) {
    this.area = area;
  }

  async get<T>(key: string): Promise<T | null> {
    const result = await this.area.get(key);
    return (result[key] as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await this.area.set({ [key]: value });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/quota/i.test(message)) {
        throw new StorageQuotaError(
          "Extension storage is full. Export your tracker and clear old applications from Settings.",
          { cause: err },
        );
      }
      throw err;
    }
  }

  async remove(key: string): Promise<void> {
    await this.area.remove(key);
  }

  async keys(): Promise<string[]> {
    const all = await this.area.get(null);
    return Object.keys(all);
  }

  async usage(): Promise<number> {
    return this.area.getBytesInUse(null);
  }
}
