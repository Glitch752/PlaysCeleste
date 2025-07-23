export function debounce<T extends (...args: any[]) => void>(
    func: T,
    timeout: () => number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    return function (this: any, ...args: Parameters<T>) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), timeout());
    };
}

export function formatList(items: string[]): string {
    if (items.length === 0) {
        return "";
    }
    if (items.length === 1) {
        return items[0];
    }
    if (items.length === 2) {
        return `${items[0]} and ${items[1]}`;
    }
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export class AsyncMutex {
    private mutex: Promise<void> = Promise.resolve();

    async lock(): Promise<() => void> {
        let unlockNext: () => void;
        const nextMutex = new Promise<void>(resolve => unlockNext = resolve);
        const currentMutex = this.mutex;
        this.mutex = nextMutex;
        await currentMutex;
        return () => unlockNext();
    }

    async run<T>(fn: () => T | Promise<T>): Promise<T> {
        const unlock = await this.lock();
        try {
            return await fn();
        } finally {
            unlock();
        }
    }
}