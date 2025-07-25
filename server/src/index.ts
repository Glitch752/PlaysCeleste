import { AttachmentBuilder, Client, Events, GatewayIntentBits, Message, MessageCreateOptions, MessageFlags, ReactionManager, TextChannel } from "discord.js";
import { config } from "./config";
import { AdvanceFrameData, CelesteSocket } from "./CelesteSocket";
import UPNG from "upng-js";
import { ApplyContext, findEmojiMeaning } from "./EmojiMeaning";
import { cropImage, debounce } from "./utils";
import { getMaxFrames, getMinimumReactionsRequired, getReactionDebounce } from "./settings";
import { getSyncedState, setStateChangeCallback } from "./state";
import { EventRecorder, EventUser } from "./EventRecorder";

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
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMessageReactions
            ],
        });

        this.celesteSocket = new CelesteSocket();

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
    
    private async setChannelDescription(description: string): Promise<void> {
        const channel = this.client.channels.cache.get(config.CHANNEL_ID);
        if(channel && channel.isTextBased()) {
            await (channel as TextChannel).setTopic(description);
        }
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
            [arrayBuf, width, height] = cropImage(arrayBuf, frame.width, frame.height);

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
                content += `### :trophy: **${roomEvent.chapterName} ${roomEvent.toRoomName}** reached for the first time!\n`;
                content += `Contributors: ${contributors.map(id => `<@${id}>`).join(", ")}\n`;
                content += "-# Note: contributors may not be accurate; it's just a heuristic!";
                
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
            setTimeout(() => process.exit(1), 1000);
        });

        process.on("unhandledRejection", (reason, promise) => {
            console.error("Unhandled Rejection at:", promise, "reason:", reason);
            this.sendToChannel({
                content: `<:annoyedeline:1396712320452792452> An error occurred; Discord is probably rate limiting us. Wait a few seconds, and we'll restart the bot. <@601206663059603487> ahhh something went wrong`,
                flags: MessageFlags.SuppressEmbeds
            });
            
            this.latestMessageID = null;
            setTimeout(() => process.exit(1), 1000);
        });
    }

    private async updateReactions(reactions: ReactionManager) {
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
        const message = await this.sendToChannel({
            content: context.print()
        });

        const advanceData = context.getAdvanceFrameData();
        const maxFrames = getMaxFrames();
        if(advanceData.FramesToAdvance > maxFrames) {
            this.sendToChannel({
                content: `${advanceData.FramesToAdvance} frames... [Nice one.](https://discord.com/channels/1396648547708829778/1396661370757447680/1396944113743560894)
Capped to ${maxFrames} frames.`,
                flags: MessageFlags.SuppressEmbeds
            });
            advanceData.FramesToAdvance = maxFrames;
        }
        
        this.celesteSocket.sendAdvanceFrame(advanceData);
        this.eventRecorder.recordInputHistory(advanceData, contributors, message?.id ?? "unknown");
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
            setStateChangeCallback(() => {
                this.celesteSocket.updateSyncedState(getSyncedState());
            });
            
            const data: AdvanceFrameData = {
                KeysHeld: [],
                FramesToAdvance: 1
            };
            this.celesteSocket.sendAdvanceFrame(data);
            this.eventRecorder.recordInputHistory(data, []);
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

new DiscordPlaysCelesteServer();