import { AdvanceFrameData } from "./CelesteSocket";
import { getSyncedState } from "./state";
import { formatList } from "./utils";

export class ApplyContext {
    public keysHeld: Set<string> = new Set();
    public frames: number = 0;
    public frameMultiplier: number = 1;
    
    constructor() {
    }
    
    isValid(): boolean {
        return this.frames > 0 && getSyncedState().ControlledByDiscord;
    }
    
    getAdvanceFrameData(): AdvanceFrameData {
        return {
            KeysHeld: Array.from(this.keysHeld),
            FramesToAdvance: this.frames * this.frameMultiplier
        };
    }
    
    print(): string {
        let frames = this.frames * this.frameMultiplier;
        let seconds = Math.round(frames / 60 * 1000) / 1000;
        let readableDuration = `${seconds} second${seconds !== 1 ? "s" : ""}`;
        let result = `Moving forward ${frames} frame${this.frames != 1 ? "s" : ""} (${readableDuration}) with `;
        if(this.keysHeld.size == 0) {
            result += "no keys held.";
        } else {
            result += `${formatList(Array.from(this.keysHeld))} held.`;
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

const emojiMeanings: EmojiMeaning[] = [
    // All the regional indicators and add held keys
    ...Array.from({ length: 26 }, (_, i) => {
        const letter = String.fromCodePoint(0x1F1E6 + i); // Regional indicator symbols A-Z
        return EmojiMeaning.holdKey(letter, String.fromCharCode(65 + i)); // A-Z keys
    }),
    
    // leftwards_arrow_with_hook is enter
    EmojiMeaning.holdKey("↩️", "Enter"),
    // arrow_right_hook is tab
    EmojiMeaning.holdKey("↪️", "Tab"),
    // up, down, left, and right arrow keys
    EmojiMeaning.holdKey("⬆️", "Up"),
    EmojiMeaning.holdKey("⬇️", "Down"),
    EmojiMeaning.holdKey("⬅️", "Left"),
    EmojiMeaning.holdKey("➡️", "Right"),
    EmojiMeaning.holdKeys("↖️", ["Up", "Left"]),
    EmojiMeaning.holdKeys("↗️", ["Up", "Right"]),
    EmojiMeaning.holdKeys("↙️", ["Down", "Left"]),
    EmojiMeaning.holdKeys("↘️", ["Down", "Right"]),
    EmojiMeaning.holdKeys("↔️", ["Left", "Right"]),
    EmojiMeaning.holdKeys("↕️", ["Up", "Down"]),
    
    // X means escape
    EmojiMeaning.holdKey("❌", "Escape"),
    
    // Wait multipliers
    EmojiMeaning.waitMultiplier("⏩", 6),
    
    // All the number symbols are individual frame counts
    EmojiMeaning.wait("1️⃣", 0, 1),
    EmojiMeaning.wait("2️⃣", 0, 2),
    EmojiMeaning.wait("3️⃣", 0, 3),
    EmojiMeaning.wait("4️⃣", 0, 4),
    EmojiMeaning.wait("5️⃣", 0, 5),
    EmojiMeaning.wait("6️⃣", 0, 6),
    EmojiMeaning.wait("7️⃣", 0, 7),
    EmojiMeaning.wait("8️⃣", 0, 8),
    EmojiMeaning.wait("9️⃣", 0, 9),
    EmojiMeaning.wait("🔟", 0, 10),
    EmojiMeaning.wait("💯", 0, 100), // why not?
    // Clock emojis are seconds, e.g. 1 o'clock is 1 second, 1:30 is 1.5 seconds, etc
    EmojiMeaning.wait("🕐", 1, 0),
    EmojiMeaning.wait("🕜", 1.5, 0),
    EmojiMeaning.wait("🕑", 2, 0),
    EmojiMeaning.wait("🕝", 2.5, 0),
    EmojiMeaning.wait("🕒", 3, 0),
    EmojiMeaning.wait("🕞", 3.5, 0),
    EmojiMeaning.wait("🕓", 4, 0),
    EmojiMeaning.wait("🕟", 4.5, 0),
    EmojiMeaning.wait("🕔", 5, 0),
    EmojiMeaning.wait("🕠", 5.5, 0),
    EmojiMeaning.wait("🕕", 6, 0),
    EmojiMeaning.wait("🕡", 6.5, 0),
    EmojiMeaning.wait("🕖", 7, 0),
    EmojiMeaning.wait("🕢", 7.5, 0),
    EmojiMeaning.wait("🕗", 8, 0),
    EmojiMeaning.wait("🕣", 8.5, 0),
    EmojiMeaning.wait("🕘", 9, 0),
    EmojiMeaning.wait("🕤", 9.5, 0),
    EmojiMeaning.wait("🕙", 10, 0),
    EmojiMeaning.wait("🕥", 10.5, 0),
    EmojiMeaning.wait("🕚", 11, 0),
    EmojiMeaning.wait("🕦", 11.5, 0),
    EmojiMeaning.wait("🕛", 12, 0),
    EmojiMeaning.wait("🕧", 0.5, 0),
];

export function findEmojiMeaning(name: string | null) {
    return emojiMeanings.find(m => m.emoji === name);
}