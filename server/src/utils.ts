export function debounce<T extends (...args: any[]) => void>(
    func: T,
    timeout: () => number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    return function(this: any, ...args: Parameters<T>) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), timeout());
    };
}

export function throttle<T extends (...args: any[]) => void>(
    func: T,
    timeout: () => number
): (...args: Parameters<T>) => void {
    let lastCall = 0;
    
    return function(this: any, ...args: Parameters<T>) {
        const now = Date.now();
        if(now - lastCall >= timeout()) {
            lastCall = now;
            return func.apply(this, args);
        }
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

/**
 * Celeste renders the actual game content in a 16:9 box in the middle of the screen.
 * If the window isn't exactly 16:9, there are black bars on the sides of the screen that we don't want to send.
 * This shouldn't happen, but it does in testing.
 */
export function cropImage(arrayBuf: ArrayBuffer, width: number, height: number): [ArrayBuffer, number, number] {
    const aspectRatio = 16 / 9;
    const targetWidth = Math.floor(height * aspectRatio);

    if(width === targetWidth) return [arrayBuf, width, height]; // Already correct aspect ratio

    if(width > targetWidth) {
        // Too wide, crop sides
        const bytesPerPixel = 4; // RGBA
        const cropX = Math.floor((width - targetWidth) / 2);
        const cropped = new Uint8Array(targetWidth * height * bytesPerPixel);
        const src = new Uint8Array(arrayBuf);

        for(let y = 0; y < height; y++) {
            const srcStart = (y * width + cropX) * bytesPerPixel;
            const destStart = (y * targetWidth) * bytesPerPixel;
            cropped.set(src.subarray(srcStart, srcStart + targetWidth * bytesPerPixel), destStart);
        }
        return [cropped.buffer, targetWidth, height];
    } else {
        // Too narrow, crop top and bottom
        const bytesPerPixel = 4; // RGBA
        const targetHeight = Math.floor(width / aspectRatio);
        const cropY = Math.floor((height - targetHeight) / 2);
        const cropped = new Uint8Array(width * targetHeight * bytesPerPixel);
        const src = new Uint8Array(arrayBuf);

        for(let y = 0; y < targetHeight; y++) {
            const srcStart = ((y + cropY) * width) * bytesPerPixel;
            const destStart = (y * width) * bytesPerPixel;
            cropped.set(src.subarray(srcStart, srcStart + width * bytesPerPixel), destStart);
        }
        return [cropped.buffer, width, targetHeight];
    }
}