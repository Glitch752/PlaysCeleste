import { AttachmentBuilder, Client, Events, GatewayIntentBits, MessageFlags, SectionBuilder, SnowflakeUtil, TextChannel } from "discord.js";
import { config } from "./config";
import { CelesteSocket } from "./CelesteSocket";
import UPNG from "upng-js";

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
});

const celesteSocket = new CelesteSocket();
let framesReceived = 0;

let celesteConnected = false;

const channelID = "1396661370757447680";

const MINIMUM_REACTIONS_REQUIRED = 1;
const REACTION_DEBOUNCE = 5;

let latestMessageID: string | null = null;

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
    
    const channel = client.channels.cache.get(channelID);
    if(channel && channel.isTextBased()) {
        const message = await (channel as TextChannel).send({
            content: "Here's a screenshot of the game! See <#1396661382782517401> for how to play.",
            files: [new AttachmentBuilder(pngBuffer, {
                name: "celeste.png"
            })]
        });
        
        latestMessageID = message.id;
        
        await message.react("🇿");
        await message.react("🇽");
        await message.react("🇨");
        await message.react("⬆️");
        await message.react("⬇️");
        await message.react("⬅️");
        await message.react("➡️");
        await message.react("1️⃣");
        await message.react("2️⃣");
        await message.react("5️⃣");
        await message.react("🕐");
        await message.react("🕑");
        await message.react("🕔");
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
        console.log(`Reacted ${reaction.emoji.name} to latest message`);
    }
})

client.login(config.DISCORD_TOKEN);