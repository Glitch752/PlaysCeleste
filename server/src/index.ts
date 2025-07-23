import { AttachmentBuilder, Client, Events, GatewayIntentBits, Message, MessageCreateOptions, MessageFlags, ReactionManager, TextChannel } from "discord.js";
import { config } from "./config";
import { CelesteSocket } from "./CelesteSocket";
import UPNG from "upng-js";
import { ApplyContext, findEmojiMeaning } from "./EmojiMeaning";
import { debounce } from "./utils";
import { getMinimumReactionsRequired, getReactionDebounce } from "./settings";
import { getSyncedState, setStateChangeCallback } from "./state";
import { EventRecorder, EventUser } from "./EventRecorder";
import { spawn } from "child_process";

class DiscordPlaysCelesteServer {
    private client: Client;
    private celesteSocket: CelesteSocket;
    private framesReceived = 0;
    private celesteConnected = false;
    private latestMessageID: string | null = null;
    private reactionsFinishedDebounce: (reactions: ReactionManager) => void;
    private eventRecorder: EventRecorder;

    constructor() {
        this.eventRecorder = new EventRecorder();
        
        this.client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
        });

        this.celesteSocket = new CelesteSocket();

        setStateChangeCallback(() => {
            this.celesteSocket.updateSyncedState(getSyncedState());
        });

        this.reactionsFinishedDebounce = debounce(this.updateReactions.bind(this), () => getReactionDebounce() * 1000);

        this.setupCelesteSocketEvents();
        this.setupClientEvents();
        this.setupSketchyErrorHandling();

        this.client.login(config.DISCORD_TOKEN);
    }

    private async sendToChannel(options: MessageCreateOptions): Promise<Message | null> {
        const channel = this.client.channels.cache.get(config.CHANNEL_ID);
        if(channel && channel.isTextBased()) {
            return await (channel as TextChannel).send(options);
        }
        return null;
    }

    private setupCelesteSocketEvents() {
        this.celesteSocket.once("connect", () => {
            console.log("Connected to Celeste!");
            this.celesteConnected = true;
        });

        this.celesteSocket.on("screenshotData", async (frame) => {
            console.log(`Received ${frame.width}x${frame.height} frame (${this.framesReceived++})`);

            // Encode as PNG and save
            let arrayBuf = Uint8Array.from(frame.data).buffer;
            let width = frame.width, height = frame.height;
            [arrayBuf, width, height] = this.cropImage(arrayBuf, frame.width, frame.height);

            const pngArrayBuffer = UPNG.encode([arrayBuf], width, height, 256);
            const pngBuffer = Buffer.from(pngArrayBuffer);

            const message = await this.sendToChannel({
                content: "Here's a screenshot of the game! See <#1396661382782517401> for how to play.",
                files: [new AttachmentBuilder(pngBuffer, {
                    name: "celeste.png"
                })]
            });
            if(message) {
                this.latestMessageID = message.id;
            } else {
                console.error("Failed to send message!");
            }
        });

        this.celesteSocket.on("message", (msg) => {
            console.log(`Received message to send: ${msg}`);

            this.sendToChannel({
                content: msg,
                flags: MessageFlags.SuppressEmbeds
            });
            
            this.eventRecorder.recordMessage(msg);
        });
        
        this.celesteSocket.on("playerDeath", () => {
            this.sendToChannel({
                content: "<:annoyedeline:1396712320452792452> Madeline died",
                flags: MessageFlags.SuppressEmbeds
            });
            this.eventRecorder.playerDeath();
        });
        
        this.celesteSocket.on("strawberryCollected", async (event) => {
            const contributors = await this.eventRecorder.collectStrawberry(event);
            
            let content = "";
            const firstTimeText = event.isGhost ? "" : " for the first time";
            const wingedText = event.isWinged ? " winged" : "";
            if(event.isGolden) {
                content += `## :strawberry: Collected **$${event.chapterName}**${wingedText} golden strawberry${firstTimeText}! ${event.newStrawberryCount}/175\n`;
            } else {
                content += `### :strawberry: Collected **${event.chapterName} ${event.roomName}**${wingedText} strawberry${firstTimeText}! ${event.newStrawberryCount}/175\n`;
            }
            
            content += `Contributors: ${contributors.map(id => `<@${id}>`).join(", ")}\n`;
            content += "-# Note: contributors may not be accurate; it's just a heuristic!";
            
            this.sendToChannel({
                content,
                flags: MessageFlags.SuppressEmbeds
            });
        });
        
        this.celesteSocket.on("changeRoom", async (roomEvent) => {
            const {
                contributors,
                firstClear,
                wasCleared
            } = await this.eventRecorder.changeRoom(
                roomEvent.fromRoomName,
                roomEvent.toRoomName,
                roomEvent.chapterName
            );
            
            if(wasCleared && firstClear) {
                let content = "";
                content += `### :trophy: **${roomEvent.chapterName} ${roomEvent.toRoomName}** cleared for the first time!\n`;
                content += `Clear team: ${contributors.map(id => `<@${id}>`).join(", ")}\n`;
                content += "-# Note: clear team or room completion may not be accurate; it's just a heuristic!";
                
                this.sendToChannel({
                    content,
                    flags: MessageFlags.SuppressEmbeds
                });
            }
        });
        
        this.celesteSocket.on("completeChapter", async (chapterEvent) => {
            const [firstCompletion, contributors] = await this.eventRecorder.completeChapter(chapterEvent.chapterName);
            
            let content = "";
            if(firstCompletion) {
                content += `## :trophy: **${chapterEvent.chapterName}** completed for the first time!\n`;
            } else {
                content += `## :trophy: **${chapterEvent.chapterName}** completed!\n`;
            }
            content += `Completion team: ${contributors.map(id => `<@${id}>`).join(", ")}\n`;
            content += "-# Note: completion team may not be accurate; it's just a heuristic!";
            
            this.sendToChannel({
                content,
                flags: MessageFlags.SuppressEmbeds
            });
        });

        this.celesteSocket.on("close", () => {
            console.log("Disconnected from Celeste");
            this.celesteConnected = false;
        });

        this.celesteSocket.on("error", (e) => {
            console.error("Celeste socket error:", e);
        });
    }
    
    private setupSketchyErrorHandling() {
        process.on("uncaughtException", (error) => {
            console.error("Uncaught Exception:", error);
            this.sendToChannel({
                content: `<:annoyedeline:1396712320452792452> An error occurred; Discord is probably rate limiting us. Wait a few seconds, and we'll restart the bot. <@601206663059603487> ahhh something went wrong`,
                flags: MessageFlags.SuppressEmbeds
            });
            
            this.latestMessageID = null;
            setTimeout(() => {
                spawn(process.argv[0], process.argv.slice(1), {
                    env: { process_restarting: "1" },
                    stdio: 'ignore',
                    detached: true
                }).unref();
                process.exit(1);
            }, 3000);
        });

        process.on("unhandledRejection", (reason, promise) => {
            console.error("Unhandled Rejection at:", promise, "reason:", reason);
            this.sendToChannel({
                content: `<:annoyedeline:1396712320452792452> An error occurred; Discord is probably rate limiting us. Wait a few seconds, and we'll restart the bot. <@601206663059603487> ahhh something went wrong`,
                flags: MessageFlags.SuppressEmbeds
            });
            
            this.latestMessageID = null;
            setTimeout(() => {
                spawn(process.argv[0], process.argv.slice(1), {
                    env: { process_restarting: "1" },
                    stdio: 'ignore',
                    detached: true
                }).unref();
                process.exit(1);
            }, 3000);
        });
    }

    /**
     * Celeste renders the actual game content in a 16:9 box in the middle of the screen.
     * If the window isn't exactly 16:9, there are black bars on the sides of the screen that we don't want to send.
     * This shouldn't happen, but it does in testing.
     */
    private cropImage(arrayBuf: ArrayBuffer, width: number, height: number): [ArrayBuffer, number, number] {
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

    private updateReactions(reactions: ReactionManager) {
        // Find all reactions with more than MINIMUM_REACTIONS_REQUIRED reactions
        const validReactions = [...reactions.cache.values()].filter(r => r.count >= getMinimumReactionsRequired());
        if(validReactions.length === 0) {
            // This isn't valid yet
            return;
        }

        // Apply all the reactions to a new context and continue only if the resulting context is valid
        const context = new ApplyContext();
        validReactions.forEach(reaction => {
            const meaning = findEmojiMeaning(reaction.emoji.name);
            if(meaning) meaning.apply(context);
        });

        if(!context.isValid()) {
            return;
        }
        
        let contributors = validReactions.flatMap(r => {
            return r.users.cache.map(u => ({
                id: u.id,
                username: u.username
            })).filter(u => u.id !== this.client.user?.id);
        }).filter(u => u !== null);
        
        // Deduplicate contributors
        const uniqueContributors = new Map<string, EventUser>();
        contributors.forEach(user => {
            if(!uniqueContributors.has(user.id)) {
                uniqueContributors.set(user.id, user);
            }
        });
        contributors = Array.from(uniqueContributors.values());

        this.latestMessageID = null;

        // Awesome! Advance frames.
        this.sendToChannel({
            content: context.print()
        });

        const advanceData = context.getAdvanceFrameData();
        this.celesteSocket.sendAdvanceFrame(advanceData);
        
        this.eventRecorder.recordInputHistory(advanceData, contributors);
    }

    private setupClientEvents() {
        this.client.once("ready", async () => {
            console.log("Ready!");

            if(!this.celesteConnected) {
                // Wait for celeste to connect
                console.log("Waiting for Celeste to connect...");
                while(!this.celesteConnected) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            this.celesteSocket.updateSyncedState(getSyncedState());
            this.celesteSocket.sendAdvanceFrame({
                KeysHeld: [],
                FramesToAdvance: 1
            });
        });

        this.client.on(Events.MessageReactionAdd, async (reaction, user) => {
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

            if(reaction.message.id === this.latestMessageID && user.id != this.client.user?.id) {
                console.log(`Received ${reaction.emoji.name} reaction to latest message`);
                this.reactionsFinishedDebounce(reaction.message.reactions);
            }
        });
    }
}

// TODO: Switch to a proper process manager
if(process.env.process_restarting) {
    // Give old process one second to shut down before continuing...
    setTimeout(() => {
        new DiscordPlaysCelesteServer();
    }, 1000);
} else {
    new DiscordPlaysCelesteServer();
}