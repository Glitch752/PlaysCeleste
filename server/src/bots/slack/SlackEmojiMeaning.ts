import { AdvanceFrameData } from "../../CelesteSocket";
import { getSyncedState } from "../../state";
import { formatList } from "../../utils";

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
        let result = `Moving forward ${frames} frame${frames != 1 ? "s" : ""} (${readableDuration}) with `;
        if(this.keysHeld.size == 0) {
            result += "no keys held.";
        } else {
            result += `${formatList(Array.from(this.keysHeld))} held.`;
        }
        result += " Slack images take a while to upload, so this is pretty slow :c";
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
    // ...Array.from({ length: 26 }, (_, i) => {
    //     const letter = String.fromCodePoint(0x1F1E6 + i); // Regional indicator symbols A-Z
    //     return EmojiMeaning.holdKey(letter, String.fromCharCode(65 + i)); // A-Z keys
    // }),
    // Regional indicators A-Z
    ...Array.from({ length: 26 }, (_, i) => {
        const key = String.fromCharCode(65 + i); // A-Z keys
        return [
            EmojiMeaning.holdKey(`${key.toLowerCase()}`, key),
            EmojiMeaning.holdKey(`${key.toLowerCase()}_1`, key)
        ];
    }).flat(),
    
    // leftwards_arrow_with_hook is enter
    EmojiMeaning.holdKey("leftwards_arrow_with_hook", "Enter"),
    EmojiMeaning.holdKey("tw_leftwards_arrow_with_hook", "Enter"),
    // arrow_right_hook is tab
    EmojiMeaning.holdKey("arrow_right_hook", "Tab"),
    EmojiMeaning.holdKey("tw_arrow_right_hook", "Tab"),

    // up, down, left, and right arrow keys
    EmojiMeaning.holdKey("arrow_up", "Up"),
    EmojiMeaning.holdKey("tw_arrow_up", "Up"),
    
    EmojiMeaning.holdKey("arrow_down", "Down"),
    EmojiMeaning.holdKey("tw_arrow_down", "Down"),

    EmojiMeaning.holdKey("arrow_left", "Left"),
    EmojiMeaning.holdKey("tw_arrow_left", "Left"),

    EmojiMeaning.holdKey("arrow_right", "Right"),
    EmojiMeaning.holdKey("tw_arrow_right", "Right"),

    EmojiMeaning.holdKeys("arrow_upper_left", ["Up", "Left"]),
    EmojiMeaning.holdKeys("tw_arrow_upper_left", ["Up", "Left"]),
    
    EmojiMeaning.holdKeys("arrow_upper_right", ["Up", "Right"]),
    EmojiMeaning.holdKeys("tw_arrow_upper_right", ["Up", "Right"]),
    
    EmojiMeaning.holdKeys("arrow_lower_left", ["Down", "Left"]),
    EmojiMeaning.holdKeys("tw_arrow_lower_left", ["Down", "Left"]),

    EmojiMeaning.holdKeys("arrow_lower_right", ["Down", "Right"]),
    EmojiMeaning.holdKeys("tw_arrow_lower_right", ["Down", "Right"]),
    
    EmojiMeaning.holdKeys("left_right_arrow", ["Left", "Right"]),
    EmojiMeaning.holdKeys("tw_left_right_arrow", ["Left", "Right"]),

    EmojiMeaning.holdKeys("arrow_up_down", ["Up", "Down"]),
    EmojiMeaning.holdKeys("tw_arrow_up_down", ["Up", "Down"]),
    
    // X means escape
    EmojiMeaning.holdKey("x", "Escape"),
    EmojiMeaning.holdKey("tw_x", "Escape"),
    
    // Wait multipliers
    EmojiMeaning.waitMultiplier("fast_forward", 6),
    EmojiMeaning.waitMultiplier("tw_fast_forward", 6),
    
    // All the number symbols are individual frame counts
    EmojiMeaning.wait("one", 0, 1),
    EmojiMeaning.wait("two", 0, 2),
    EmojiMeaning.wait("three", 0, 3),
    EmojiMeaning.wait("four", 0, 4),
    EmojiMeaning.wait("five", 0, 5),
    EmojiMeaning.wait("six", 0, 6),
    EmojiMeaning.wait("seven", 0, 7),
    EmojiMeaning.wait("eight", 0, 8),
    EmojiMeaning.wait("nine", 0, 9),
    EmojiMeaning.wait("keycap_ten", 0, 10), // WHY IS IT DIFFERENT
    EmojiMeaning.wait("tw_one", 0, 1),
    EmojiMeaning.wait("tw_two", 0, 2),
    EmojiMeaning.wait("tw_three", 0, 3),
    EmojiMeaning.wait("tw_four", 0, 4),
    EmojiMeaning.wait("tw_five", 0, 5),
    EmojiMeaning.wait("tw_six", 0, 6),
    EmojiMeaning.wait("tw_seven", 0, 7),
    EmojiMeaning.wait("tw_eight", 0, 8),
    EmojiMeaning.wait("tw_nine", 0, 9),
    EmojiMeaning.wait("tw_keycap_ten", 0, 10), // WHY IS IT DIFFERENT

    EmojiMeaning.wait("sixseven", 0, 67), // why not?
    EmojiMeaning.wait("100", 0, 100), // why not?
    EmojiMeaning.wait("tw_100", 0, 100), // why not?

    // Clock emojis are seconds, e.g. 1 o'clock is 1 second, 1:30 is 1.5 seconds, etc
    EmojiMeaning.wait("clock1", 1, 0),
    EmojiMeaning.wait("clock130", 1.5, 0),
    EmojiMeaning.wait("clock2", 2, 0),
    EmojiMeaning.wait("clock230", 2.5, 0),
    EmojiMeaning.wait("clock3", 3, 0),
    EmojiMeaning.wait("clock330", 3.5, 0),
    EmojiMeaning.wait("clock4", 4, 0),
    EmojiMeaning.wait("clock430", 4.5, 0),
    EmojiMeaning.wait("clock5", 5, 0),
    EmojiMeaning.wait("clock530", 5.5, 0),
    EmojiMeaning.wait("clock6", 6, 0),
    EmojiMeaning.wait("clock630", 6.5, 0),
    EmojiMeaning.wait("clock7", 7, 0),
    EmojiMeaning.wait("clock730", 7.5, 0),
    EmojiMeaning.wait("clock8", 8, 0),
    EmojiMeaning.wait("clock830", 8.5, 0),
    EmojiMeaning.wait("clock9", 9, 0),
    EmojiMeaning.wait("clock930", 9.5, 0),
    EmojiMeaning.wait("clock10", 10, 0),
    EmojiMeaning.wait("clock1030", 10.5, 0),
    EmojiMeaning.wait("clock11", 11, 0),
    EmojiMeaning.wait("clock1130", 11.5, 0),
    EmojiMeaning.wait("clock12", 12, 0),
    EmojiMeaning.wait("clock1230", 0.5, 0),


    EmojiMeaning.wait("tw_clock1", 1, 0),
    EmojiMeaning.wait("tw_clock130", 1.5, 0),
    EmojiMeaning.wait("tw_clock2", 2, 0),
    EmojiMeaning.wait("tw_clock230", 2.5, 0),
    EmojiMeaning.wait("tw_clock3", 3, 0),
    EmojiMeaning.wait("tw_clock330", 3.5, 0),
    EmojiMeaning.wait("tw_clock4", 4, 0),
    EmojiMeaning.wait("tw_clock430", 4.5, 0),
    EmojiMeaning.wait("tw_clock5", 5, 0),
    EmojiMeaning.wait("tw_clock530", 5.5, 0),
    EmojiMeaning.wait("tw_clock6", 6, 0),
    EmojiMeaning.wait("tw_clock630", 6.5, 0),
    EmojiMeaning.wait("tw_clock7", 7, 0),
    EmojiMeaning.wait("tw_clock730", 7.5, 0),
    EmojiMeaning.wait("tw_clock8", 8, 0),
    EmojiMeaning.wait("tw_clock830", 8.5, 0),
    EmojiMeaning.wait("tw_clock9", 9, 0),
    EmojiMeaning.wait("tw_clock930", 9.5, 0),
    EmojiMeaning.wait("tw_clock10", 10, 0),
    EmojiMeaning.wait("tw_clock1030", 10.5, 0),
    EmojiMeaning.wait("tw_clock11", 11, 0),
    EmojiMeaning.wait("tw_clock1130", 11.5, 0),
    EmojiMeaning.wait("tw_clock12", 12, 0),
    EmojiMeaning.wait("tw_clock1230", 0.5, 0),
];

/**
 * Maps from Celeste/XNA `Keys` to emojis
 */
const keyEmojis: { [key: string]: string } = Object.fromEntries([
    ...Array.from({ length: 26 }, (_, i) => {
        const letter = String.fromCharCode(65 + i);
        return [letter, `:${letter.toLowerCase()}_1:`];
    }),
    
    // Arrow keys
    ["Up", ":arrow_up:"],
    ["Down", ":arrow_down:"],
    ["Left", ":arrow_left:"],
    ["Right", ":arrow_right:"],
    
    // Enter, Tab, Escape
    ["Enter", ":leftwards_arrow_with_hook:"],
    ["Tab", ":arrow_right_hook:"],
    ["Escape", ":x:"],
]);

export function findEmojiMeaning(name: string | null): EmojiMeaning | null {
    return emojiMeanings.find(m => m.emoji === name) ?? null;
}

export function getEmojiForKey(key: string): string | null {
    return keyEmojis[key] ?? null;
}