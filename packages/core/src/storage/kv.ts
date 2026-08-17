export interface KeyValueAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
  
  usage?(): Promise<number>;
}

export class MemoryAdapter implements KeyValueAdapter {
  private data = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.data.get(key) as T | undefined) ?? null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }
  async keys(): Promise<string[]> {
    return [...this.data.keys()];
  }
}

export class WebStorageAdapter implements KeyValueAdapter {
  private readonly storage: Storage;
  private readonly prefix: string;

  constructor(storage: Storage, prefix = 'jobai:') {
    this.storage = storage;
    this.prefix = prefix;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = this.storage.getItem(this.prefix + key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      
      this.storage.removeItem(this.prefix + key);
      return null;
    }
  }
  async set<T>(key: string, value: T): Promise<void> {
    try {
      this.storage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (err) {
      throw new StorageQuotaError(
        'Browser storage is full. Export and clear old applications to free space.',
        { cause: err },
      );
    }
  }
  async remove(key: string): Promise<void> {
    this.storage.removeItem(this.prefix + key);
  }
  async keys(): Promise<string[]> {
    const out: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const k = this.storage.key(i);
      if (k?.startsWith(this.prefix)) out.push(k.slice(this.prefix.length));
    }
    return out;
  }
}

export class StorageQuotaError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StorageQuotaError';
  }
}

export class NamespacedAdapter implements KeyValueAdapter {
  private readonly inner: KeyValueAdapter;
  private readonly ns: string;

  constructor(inner: KeyValueAdapter, ns: string) {
    this.inner = inner;
    this.ns = ns;
  }
  get<T>(key: string) {
    return this.inner.get<T>(`${this.ns}:${key}`);
  }
  set<T>(key: string, value: T) {
    return this.inner.set(`${this.ns}:${key}`, value);
  }
  remove(key: string) {
    return this.inner.remove(`${this.ns}:${key}`);
  }
  async keys() {
    const all = await this.inner.keys();
    return all.filter((k) => k.startsWith(`${this.ns}:`)).map((k) => k.slice(this.ns.length + 1));
  }
}
