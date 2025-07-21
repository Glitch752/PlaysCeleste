import { AttachmentBuilder, Client, Events, GatewayIntentBits, Message, MessageCreateOptions, MessageFlags, MessagePayload, ReactionManager, SectionBuilder, SnowflakeUtil, TextChannel } from "discord.js";
import { config } from "./config";
import { CelesteSocket } from "./CelesteSocket";
import UPNG from "upng-js";
import { ApplyContext, EmojiMeaning } from "./EmojiMeaning";
import { debounce } from "./utils";

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
});

const celesteSocket = new CelesteSocket();
let framesReceived = 0;

let celesteConnected = false;

const channelID = "1396661370757447680";

const MINIMUM_REACTIONS_REQUIRED = 1;
const REACTION_DEBOUNCE = 5;

const emojiMeanings: EmojiMeaning[] = [
    // All the regional indicators and add held keys
    ...Array.from({ length: 26 }, (_, i) => {
        const letter = String.fromCodePoint(0x1F1E6 + i); // Regional indicator symbols A-Z
        return EmojiMeaning.holdKey(letter, String.fromCharCode(97 + i));
    }),
    
    // leftwards_arrow_with_hook is enter
    EmojiMeaning.holdKey("↩️", "Enter"),
    // arrow_right_hook is tab
    EmojiMeaning.holdKey("↪️", "Tab"),
    // up, down, left, and right arrow keys
    EmojiMeaning.holdKey("⬆️", "ArrowUp"),
    EmojiMeaning.holdKey("⬇️", "ArrowDown"),
    EmojiMeaning.holdKey("⬅️", "ArrowLeft"),
    EmojiMeaning.holdKey("➡️", "ArrowRight"),
    
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
    EmojiMeaning.wait("🕧", 12.5, 0),
];

let latestMessageID: string | null = null;

async function sendToChannel(options: MessageCreateOptions): Promise<Message | null> {
    const channel = client.channels.cache.get(channelID);
    if(channel && channel.isTextBased()) {
        return await (channel as TextChannel).send(options);
    }
    return null;
}

celesteSocket.once("connect", () => {
    console.log("Connected to Celeste!");
    celesteConnected = true;
});

celesteSocket.on("screenshotData", async (frame) => {
    console.log(`Received ${frame.width}x${frame.height} frame (${framesReceived++})`);

    // Encode as PNG and save
    let arrayBuf = Uint8Array.from(frame.data).buffer;
    let width = frame.width, height = frame.height;
    [arrayBuf, width, height] = cropImage(arrayBuf, frame.width, frame.height);
    
    const pngArrayBuffer = UPNG.encode([arrayBuf], width, height, 256);
    const pngBuffer = Buffer.from(pngArrayBuffer);
    
    const message = await sendToChannel({
        content: "Here's a screenshot of the game! See <#1396661382782517401> for how to play.",
        files: [new AttachmentBuilder(pngBuffer, {
            name: "celeste.png"
        })]
    });
    if(message) {
        latestMessageID = message.id;
    } else {
        console.error("Failed to send message!");
    }
});

// Celeste renders the actual game content in a 16:9 box in the middle of the screen.
// If the window isn't exactly 16:9, there are black bars on the sides of the screen that we don't want to send.
// This shouldn't happen, but it does in testing.
function cropImage(arrayBuf: ArrayBuffer, width: number, height: number): [ArrayBuffer, number, number] {
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

celesteSocket.on("message", (msg) => {
    // TODO: Send in the channel
    console.log(`Received message to send: ${msg}`);
});

celesteSocket.on("close", () => {
    console.log("Disconnected from Celeste");
    celesteConnected = false;
});

celesteSocket.on("error", (e) => {
    console.error("Celeste socket error:", e);
});

client.once("ready", async () => {
    console.log("Ready!");
    
    if(!celesteConnected) {
        // Wait for celeste to connect
        console.log("Waiting for Celeste to connect...");
        while(!celesteConnected) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    celesteSocket.sendAdvanceFrame({
        KeysHeld: [],
        FramesToAdvance: 5
    });
});

const reactionsFinishedDebounce = debounce((reactions: ReactionManager) => {
    // Find all reactions with more than MINIMUM_REACTIONS_REQUIRED reactions
    const validReactions = reactions.cache.filter(r => r.count >= MINIMUM_REACTIONS_REQUIRED);
    if(validReactions.size === 0) {
        // This isn't valid yet
        return;
    }
    
    // Apply all the reactions to a new context and continue only if the resulting context is valid
    const context = new ApplyContext();
    validReactions.forEach(reaction => {
        const meaning = emojiMeanings.find(m => m.emoji === reaction.emoji.name);
        if(meaning) {
            meaning.apply(context);
        }
    });
    
    if(!context.isValid()) {
        return;
    }
    
    latestMessageID = null;
    
    // Awesome! Advance frames.
    sendToChannel({
        content: context.print()
    });
    
    celesteSocket.sendAdvanceFrame({
        KeysHeld: context.keysHeld,
        FramesToAdvance: context.frames
    });
}, REACTION_DEBOUNCE * 1000);

client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (reaction.partial) {
		try {
			await reaction.fetch();
		} catch(error) {
            console.log(`Error fetching partial reaction: ${error}`);
			return;
		}
	}
    if(user.partial) {
        try {
            await user.fetch();
        } catch(error) {
            console.log(`Error fetching partial user: ${error}`);
            return;
        }
    }

    if(reaction.message.id === latestMessageID && user.id != client.user?.id) {
        console.log(`Received ${reaction.emoji.name} reaction to latest message`);
        reactionsFinishedDebounce(reaction.message.reactions);
    }
})

client.login(config.DISCORD_TOKEN);