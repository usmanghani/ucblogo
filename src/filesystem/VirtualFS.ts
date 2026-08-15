/**
 * Browser virtual filesystem for Logo SAVE/LOAD and sequential file I/O.
 *
 * The synchronous API (read/write/openRead/...) is backed by an in-memory Map
 * so Logo primitives can use it without awaiting. `initialize()` asynchronously
 * hydrates that map from IndexedDB before the UI enables Run/Load; every
 * mutation enqueues an IndexedDB write-through so state survives reloads.
 */

export interface VirtualFile {
  name: string
  content: string
  updatedAt: number
}

const DB_NAME = 'ucblogo-fs'
const STORE = 'files'
const DB_VERSION = 1

export class VirtualFS {
  private files = new Map<string, VirtualFile>()
  private openFiles = new Map<string, { mode: 'read' | 'write' | 'append'; position: number }>()
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  private normalize(name: string): string {
    return name.replace(/^"/, '').trim()
  }

  /** Open the IndexedDB database (idempotent). */
  private openDB(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db)
    if (typeof indexedDB === 'undefined') {
      // No IndexedDB (e.g. some test environments): degrade to memory-only.
      return Promise.reject(new Error('IndexedDB unavailable'))
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'name' })
        }
      }
      req.onsuccess = () => {
        this.db = req.result
        resolve(req.result)
      }
      req.onerror = () => reject(req.error)
    })
  }

  /** Hydrate the in-memory map from IndexedDB. Call before enabling Run/Load. */
  initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise
    this.initPromise = this.openDB()
      .then((db) => {
        const { promise, resolve, reject } = Promise.withResolvers<void>()
        const tx = db.transaction(STORE, 'readonly')
        const store = tx.objectStore(STORE)
        const req = store.getAll()
        req.onsuccess = () => {
          const rows = (req.result as VirtualFile[]) ?? []
          this.files.clear()
          for (const row of rows) this.files.set(row.name, row)
          resolve()
        }
        req.onerror = () => reject(req.error)
        return promise
      })
      .catch(() => {
        // IndexedDB unavailable: continue with memory-only filesystem.
        this.initPromise = null
      })
    return this.initPromise
  }

  /** Write a file to IndexedDB (fire-and-forget write-through). */
  private persist(file: VirtualFile): void {
    if (!this.db) return
    try {
      const tx = this.db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(file)
    } catch {
      // Ignore persistence failures; in-memory state remains authoritative.
    }
  }

  private removeFromDB(name: string): void {
    if (!this.db) return
    try {
      const tx = this.db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(name)
    } catch {
      // Ignore.
    }
  }

  list(): string[] {
    return Array.from(this.files.keys()).sort()
  }

  exists(name: string): boolean {
    return this.files.has(this.normalize(name))
  }

  read(name: string): string {
    const file = this.files.get(this.normalize(name))
    return file?.content ?? ''
  }

  write(name: string, content: string): void {
    const normalized = this.normalize(name)
    const file: VirtualFile = { name: normalized, content, updatedAt: Date.now() }
    this.files.set(normalized, file)
    this.persist(file)
  }

  erase(name: string): void {
    const normalized = this.normalize(name)
    this.files.delete(normalized)
    this.removeFromDB(normalized)
  }

  openRead(name: string): void {
    const normalized = this.normalize(name)
    if (!this.files.has(normalized)) this.write(normalized, '')
    this.openFiles.set(normalized, { mode: 'read', position: 0 })
  }

  openWrite(name: string): void {
    const normalized = this.normalize(name)
    this.write(normalized, '')
    this.openFiles.set(normalized, { mode: 'write', position: 0 })
  }

  openAppend(name: string): void {
    const normalized = this.normalize(name)
    const content = this.read(normalized)
    this.openFiles.set(normalized, { mode: 'append', position: content.length })
  }

  close(name: string): void {
    this.openFiles.delete(this.normalize(name))
  }

  closeAll(): void {
    this.openFiles.clear()
  }

  allOpen(): string[] {
    return Array.from(this.openFiles.keys())
  }

  readLine(name: string): string {
    const normalized = this.normalize(name)
    const handle = this.openFiles.get(normalized)
    if (!handle || handle.mode !== 'read') return ''
    const content = this.read(normalized)
    if (handle.position >= content.length) return ''
    const end = content.indexOf('\n', handle.position)
    const lineEnd = end === -1 ? content.length : end
    const line = content.slice(handle.position, lineEnd)
    handle.position = end === -1 ? content.length : end + 1
    return line
  }

  writeLine(name: string, line: string): void {
    const normalized = this.normalize(name)
    const handle = this.openFiles.get(normalized)
    if (!handle || (handle.mode !== 'write' && handle.mode !== 'append')) return
    const content = this.read(normalized)
    this.write(normalized, content + line + '\n')
    handle.position += line.length + 1
  }

  eof(name: string): boolean {
    const normalized = this.normalize(name)
    const handle = this.openFiles.get(normalized)
    if (!handle) return true
    return handle.position >= this.read(normalized).length
  }
}
