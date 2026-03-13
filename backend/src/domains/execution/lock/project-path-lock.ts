import { Mutex, withTimeout, type MutexInterface } from 'async-mutex'

const LOCK_TIMEOUT_MS = 30 * 60 * 1000 // 30 min

export class ProjectPathLockManager {
  private locks = new Map<string, MutexInterface>()

  private getMutex(path: string): MutexInterface {
    let mutex = this.locks.get(path)
    if (!mutex) {
      mutex = withTimeout(new Mutex(), LOCK_TIMEOUT_MS)
      this.locks.set(path, mutex)
    }
    return mutex
  }

  async acquire(path: string): Promise<() => void> {
    const mutex = this.getMutex(path)
    const release = await mutex.acquire()
    return release
  }

  isLocked(path: string): boolean {
    const mutex = this.locks.get(path)
    return mutex ? mutex.isLocked() : false
  }

  cleanup(): void {
    for (const [path, mutex] of this.locks.entries()) {
      if (!mutex.isLocked()) {
        this.locks.delete(path)
      }
    }
  }
}

export const projectPathLock = new ProjectPathLockManager()
