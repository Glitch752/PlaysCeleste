import { AttachmentBuilder, Client, Events, GatewayIntentBits, Message, MessageCreateOptions, MessageFlags, ReactionManager, TextChannel } from "discord.js";
import { Bot } from "../Bot";
import { config } from "../../config";
import { getMaxFrames, getMinimumReactionsRequired, getReactionDebounce, shouldLogDeaths } from "../../settings";
import { ApplyContext, findEmojiMeaning } from "./EmojiMeaning";
import { ChangeRoomResult, EventUser } from "../../EventRecorder";
import { debounce } from "../../utils";
import { ChangeRoomEvent, CompleteChapterEvent, StrawberryCollectedEvent } from "../../CelesteSocket";

export class DiscordBot extends Bot {
    private client: Client;
    private latestMessageID: string | null = null;
    private description: string = "";
    
    private reactionsFinishedDebounce: (reactions: ReactionManager) => void;
    
    constructor() {
        super();
        
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMessageReactions
            ],
            rest: {
                timeout: 60_000,
            }
        });
        
        this.reactionsFinishedDebounce = debounce(this.updateReactions.bind(this), () => getReactionDebounce() * 1000);
        
        this.setupClientEvents();
        this.setupSketchyErrorHandling();
        
        this.client.login(config.DISCORD_TOKEN);
    }
    
    public async updateDescription(description: string) {
        this.description = description;
        const channel = this.client.channels.cache.get(config.CHANNEL_ID);
        if(channel && channel.isTextBased()) {
            (channel as TextChannel).setTopic(`See <#1396661382782517401>!   ${description}
                    
Info may be out-of-date due to severe rate-limiting on Discord's side.`);
        }
    }

    private async sendToChannel(options: MessageCreateOptions): Promise<Message | null> {
        const channel = this.client.channels.cache.get(config.CHANNEL_ID);
        if(channel && channel.isTextBased()) {
            return await (channel as TextChannel).send(options);
        }
        return null;
    }
    
    private async updateReactions(reactions: ReactionManager) {
        // Find all reactions with more than MINIMUM_REACTIONS_REQUIRED reactions
        let validReactions = [...reactions.cache.values()].filter(r => r.count >= getMinimumReactionsRequired());
        if(validReactions.length === 0) {
            // This isn't valid yet
            return;
        }

        // Apply all the reactions to a new context and continue only if the resulting context is valid
        const context = new ApplyContext();
        validReactions = validReactions.filter(reaction => {
            const meaning = findEmojiMeaning(reaction.emoji.name);
            if(meaning) meaning.apply(context);
            return meaning !== null;
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
        
        this.emit("advanceFrame", advanceData, contributors, message?.id ?? "unknown");
    }
    
    private setupClientEvents() {
        this.client.once("ready", async () => {
            console.log("Discord client ready!");

            this.emit("ready");
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

            if(reaction.message.id === this.latestMessageID && user.id != this.client.user?.id) {
                if(reaction.emoji.name === "ℹ️") {
                    await this.sendToChannel({
                        content: this.description,
                        flags: MessageFlags.SuppressEmbeds
                    });
                }
                
                console.log(`Received ${reaction.emoji.name} reaction to latest message`);
                this.reactionsFinishedDebounce(reaction.message.reactions);
            }
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
    
    public async onScreenshot(pngBuffer: Buffer) {
        const message = await this.sendToChannel({
            content: `See <#1396661382782517401> for how to play, or react with ℹ️ for more.`,
            files: [new AttachmentBuilder(pngBuffer, {
                name: "celeste.png"
            })]
        });
        
        if(message) {
            this.latestMessageID = message.id;
        } else {
            console.error("Failed to send message!");
        }
    }
    
    public onDeath(_newDeathCount: number): void {
        if(shouldLogDeaths()) {
            this.sendToChannel({
                content: "<:annoyedeline:1396712320452792452> Madeline died",
                flags: MessageFlags.SuppressEmbeds
            });
        }
    }
    
    public onMessage(msg: string): void {
        this.sendToChannel({
            content: msg,
            flags: MessageFlags.SuppressEmbeds
        });
    }
    
    public onStrawberryCollected(event: StrawberryCollectedEvent, contributors: string[]): void {
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
    }
    
    public onRoomChange(event: ChangeRoomEvent, result: ChangeRoomResult): void {
        const { contributors, firstClear } = result;
        if(event.fromRoomName != null && firstClear) {
            let content = "";
            content += `### :trophy: **${event.chapterName} ${event.toRoomName}** reached for the first time!\n`;
            content += `Contributors: ${contributors.map(id => `<@${id}>`).join(", ")}\n`;
            content += "-# Note: contributors may not be accurate; it's just a heuristic!";
            
            this.sendToChannel({
                content,
                flags: MessageFlags.SuppressEmbeds
            });
        }
    }
    
    public onCompleteChapter(event: CompleteChapterEvent, firstCompletion: boolean, contributors: string[]): void {
        let content = "";
        if(firstCompletion) {
            content += `## :trophy: **${event.chapterName}** completed for the first time!\n`;
        } else {
            content += `## :trophy: **${event.chapterName}** completed!\n`;
        }
        content += `Completion team: ${contributors.map(id => `<@${id}>`).join(", ")}\n`;
        content += "-# Note: completion team may not be accurate; it's just a heuristic!";
        
        this.sendToChannel({
            content,
            flags: MessageFlags.SuppressEmbeds
        });
    }
}