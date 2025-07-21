import { AdvanceFrameData } from "./CelesteSocket";

export class ApplyContext {
    public keysHeld: Set<string> = new Set();
    public frames: number = 0;
    public frameMultiplier: number = 1;
    
    constructor() {
    }
    
    isValid(): boolean {
        return this.frames > 0;
    }
    
    getAdvanceFrameData(): AdvanceFrameData {
        return {
            KeysHeld: Array.from(this.keysHeld),
            FramesToAdvance: this.frames * this.frameMultiplier
        };
    }
    
    print(): string {
        let result = `Moving forward ${this.frames * this.frameMultiplier} frame${this.frames > 0 ? "s" : ""} with `;
        if(this.keysHeld.size == 0) {
            result += "no keys held.";
        } else {
            result += `the following keys held: \`${Array.from(this.keysHeld).join(", ")}\`.`;
        }
        return result;
    }
}

export class EmojiMeaning {
    constructor(
        public emoji: string,
        public apply: (ctx: ApplyContext) => void
    ) {
    }
    
    public static holdKey(emoji: string, key: string): EmojiMeaning {
        return new EmojiMeaning(
            emoji,
            (ctx) => {
                ctx.keysHeld.add(key);
            }
        );
    }
    
    public static holdKeys(emoji: string, keys: string[]): EmojiMeaning {
        return new EmojiMeaning(
            emoji,
            (ctx) => {
                keys.forEach(key => ctx.keysHeld.add(key));
            }
        );
    }
    
    public static wait(emoji: string, seconds: number, frames: number): EmojiMeaning {
        return new EmojiMeaning(
            emoji,
            (ctx) => {
                ctx.frames += frames + seconds * 60;
            }
        );
    }
    
    public static waitMultiplier(emoji: string, multiplier: number): EmojiMeaning {
        return new EmojiMeaning(
            emoji,
            (ctx) => {
                ctx.frameMultiplier *= multiplier;
            }
        );
    }
}