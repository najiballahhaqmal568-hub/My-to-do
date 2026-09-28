import Dexie, { type Table } from 'dexie';
import type { Data, StoragePort } from '../core/types';

class Db extends Dexie {
  kv!: Table<{ key: string; value: Data }, string>;
  constructor() {
    super('my-to-do');
    this.version(1).stores({ kv: 'key' });
  }
}

/** Keeps the whole data document in IndexedDB under one key, so every save is atomic. */
export class DexieStorage implements StoragePort {
  private db = new Db();

  async load(): Promise<Data | null> {
    try {
      await navigator.storage?.persist?.();
    } catch {
      /* not critical */
    }
    return (await this.db.kv.get('data'))?.value ?? null;
  }

  async save(data: Data): Promise<void> {
    await this.db.kv.put({ key: 'data', value: data });
  }
}
