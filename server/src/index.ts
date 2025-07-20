import { Client } from "discord.js";
import { config } from "./config";
import { CelesteSocket } from "./CelesteSocket";
import { PNG } from "pngjs";
import fs from "fs";

const client = new Client({
    intents: ["Guilds", "GuildMessages", "DirectMessages"],
});

const celesteSocket = new CelesteSocket();
let framesReceived = 0;

celesteSocket.once("connect", () => {
    console.log("Connected to Celeste!");
});

celesteSocket.on("screenshotData", (frame) => {
    console.log(`Received ${frame.width}x${frame.height} frame (${framesReceived++})`);

    if(framesReceived === 100) {
        // Encode as PNG and save
        const png = new PNG({ width: frame.width, height: frame.height });
        png.data = frame.data;
        const pngBuffer = PNG.sync.write(png);
        fs.writeFileSync("screenshot.png", pngBuffer);
    }
});

celesteSocket.on("close", () => {
    console.log("Disconnected from Celeste");
});

celesteSocket.on("error", (e) => {
    console.error("Celeste socket error:", e);
});

client.once("ready", () => {
    console.log("Ready!");
});

client.login(config.DISCORD_TOKEN);