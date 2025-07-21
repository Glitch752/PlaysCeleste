import { AdvanceFrameData } from "./CelesteSocket";

export class ApplyContext {
    public keysHeld: string[] = [];
    public frames: number = 0;
    public frameMultiplier: number = 1;
    
    constructor() {
    }
    
    isValid(): boolean {
        return this.frames > 0;
    }
    
    getAdvanceFrameData(): AdvanceFrameData {
        return {
            KeysHeld: this.keysHeld,
            FramesToAdvance: this.frames * this.frameMultiplier
        };
    }
    
    print(): string {
        let result = `Moving forward ${this.frames * this.frameMultiplier} frame${this.frames > 0 ? "s" : ""} with `;
        if(this.keysHeld.length == 0) {
            result += "no keys held.";
        } else {
            result += `the following keys held: \`${this.keysHeld.join(", ")}\`.`;
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
                ctx.keysHeld.push(key);
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