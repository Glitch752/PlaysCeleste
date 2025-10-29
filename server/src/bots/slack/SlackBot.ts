import { Bot } from "../Bot";
import { config } from "../../config";
import { getMaxFrames, getMinimumReactionsRequired, getReactionDebounce, shouldLogDeaths } from "../../settings";
import { ApplyContext, findEmojiMeaning, getEmojiForKey } from "./SlackEmojiMeaning";
import { ChangeRoomResult, EventUser } from "../../EventRecorder";
import { debounce } from "../../utils";
import { CassetteCollectedEvent, ChangeRoomEvent, CompleteChapterEvent, HeartCollectedEvent, HeartColor, StrawberryCollectedEvent } from "../../CelesteSocket";
import { App } from "@slack/bolt";
import { KnownBlock } from "@slack/types";

export class SlackBot extends Bot {
    private client: App;
    
    private gameplayMessageID: string | null = null;
    private lastInfoTime: number | null = null;
    
    private reactionsFinishedDebounce: (messageID: string) => void;
    
    constructor() {
        super({
            descriptionDebounce: 10000 // 10 seconds
        });
        
        this.client = new App({
            token: config.SLACK_BOT_TOKEN,
            signingSecret: config.SLACK_SIGNING_SECRET,
            appToken: config.SLACK_APP_TOKEN,
            socketMode: true
        });
        
        this.reactionsFinishedDebounce = debounce(this.updateReactions.bind(this), () => getReactionDebounce() * 1000);
        
        this.setupClientEvents();
        this.setupSketchyErrorHandling();
    }
    
    public async onDescriptionChange(description: string) {
        // If only there was a way to do this w/o sending a funky message :/
        // await this.client.client.conversations.setTopic({
        //     channel: config.CHANNEL_ID,
        //     topic: `See the info canvas!   ${description}`
        // });
    }

    /**
     * Converts discord-like markdown to Slack blocks.  
     * Because headings don't work in Slack blocks, we split the markdown into separate blocks.
     * - Content like "# heading", "## heading 2", "### heading 3" become heading blocks
     *   (slack only supports one heading size)
     * - Content like "-# note" become a context block with italic text (slack doesn't support
     *   small headings / subscript)
     */
    private markToBlocks(markdown: string): KnownBlock[] {
        const lines = markdown.split("\n");
        let blocks: KnownBlock[] = [];
        
        let currentMark = "";
        for(const line of lines) {
            let newBlock: KnownBlock | null = null;
            const headers = line.match(/^#+ (.*)$/);
            if(headers) {
                newBlock = {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: headers[0]
                    }
                };
            }
            
            const smallText = line.match(/^-# (.*)$/);
            if(smallText) {
                newBlock = {
                    type: "markdown",
                    text: `*${smallText[0]}*`
                }
            }
            
            if(newBlock !== null) {
                if(currentMark.trim() !== "") {
                    blocks.push({
                        type: "markdown",
                        text: currentMark
                    });
                    currentMark = "";
                }
                
                blocks.push(newBlock);
            } else {
                currentMark += line + "\n";
            }
        }

        if(currentMark.trim() !== "") {
            blocks.push({
                type: "markdown",
                text: currentMark
            });
        }
        
        return blocks;
    }

    private async sendToChannel(options: {
        content: string;
        ephemeral?: string; // user ID
        files?: { buf: Buffer; filename: string }[];
    }): Promise<{
        id: string;
    } | null> {
        let fileIDs = [];

        if(options.files) {
            for(const file of options.files) {
                const url = await this.client.client.files.uploadV2({
                    filename: file.filename,
                    file: file.buf,
                    title: "Celeste screenshot"
                });

                // @ts-ignore
                const id: string = url.files?.[0]?.files?.[0]?.id ?? "";

                // Wait for it to finish uploading.
                // WE NEED TO POLL FOR THIS?? Who at slack came up with this shit 🥀

                let fileExists = false;
                for(let i = 0; i < 30; i++) {
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    const info = await this.client.client.files.info({
                        file: id
                    });
                    if(info?.file?.mimetype !== "") {
                        fileExists = true;
                        break;
                    }
                    console.log(`Image upload poll ${i} failed...`);
                }

                if(!fileExists) {
                    console.error("File upload failed");

                    this.client.client.chat.postMessage({
                        channel: config.CHANNEL_ID,
                        markdown_text: `File upload failed... slack is probably rate limiting us :c
Will try again in 30s! who knows if this logic actually works because i sure didn't test it

sorry about this! slack is funky and not giving proper error messages in this case`
                    });

                    try {
                        await this.client.client.files.delete({
                            file: id
                        });
                    } catch(e) {
                        console.error("Error deleting file:", e);
                    }

                    // lmaoo
                    return new Promise((resolve) => {
                        setTimeout(async () => {
                            const retryResult = await this.sendToChannel(options);
                            resolve(retryResult);
                        }, 30_000);
                    });
                }

                fileIDs.push(id);
            }
        }

        try {
            if(options.ephemeral) {
                const result = await this.client.client.chat.postEphemeral({
                    channel: config.CHANNEL_ID,
                    user: options.ephemeral,
                    markdown_text: options.content
                });

                if(result.ok) {
                    return {
                        id: result.message_ts ?? "unknown"
                    };
                }

                console.error("Error sending ephemeral message:", result.error);
                return null;
            }

            const result = await this.client.client.chat.postMessage({
                channel: config.CHANNEL_ID,
                text: options.content,
                blocks: [
                    ...options.files ? fileIDs.map(id => ({
                        type: "image",
                        slack_file: {
                            id
                        },
                        alt_text: "Celeste screenshot"
                    })) : [],
                    ...this.markToBlocks(options.content)
                ]
            });

            if(result.ok) {
                return {
                    id: result.ts ?? "unknown"
                };
            }
            console.error("Error sending message:", result.error);
        } catch (e) {
            console.error("Exception sending message:", e);
        }

        return null;
    }
    
    private async updateReactions(messageID: string) {
        // Query reactions for the message
        const result = await this.client.client.reactions.get({
            channel: config.CHANNEL_ID,
            timestamp: messageID
        });
        if(!result.message) {
            console.error("No message found for reactions get");
            return;
        }

        const reactions = result.message.reactions;
        if(!reactions) {
            console.log("No reactions on message");
            return;
        }

        // Find all reactions with more than MINIMUM_REACTIONS_REQUIRED reactions
        let validReactions = reactions.filter(r => (r.count ?? 0) >= getMinimumReactionsRequired());
        if(validReactions.length === 0) {
            // This isn't valid yet
            return;
        }

        // Apply all the reactions to a new context and continue only if the resulting context is valid
        const context = new ApplyContext();
        validReactions = validReactions.filter(reaction => {
            const meaning = findEmojiMeaning(reaction.name ?? null);
            if(meaning) meaning.apply(context);
            return meaning !== null;
        });

        if(!context.isValid()) {
            return;
        }
        
        let contributors = validReactions.flatMap(r => {
            return (r.users ?? []).map(u => ({
                id: u,
                username: u // We don't have usernames here; just use ID
            }));
        }).filter(u => u !== null);
        
        // Deduplicate contributors
        const uniqueContributors = new Map<string, EventUser>();
        contributors.forEach(user => {
            if(!uniqueContributors.has(user.id)) {
                uniqueContributors.set(user.id, user);
            }
        });
        contributors = Array.from(uniqueContributors.values());

        this.gameplayMessageID = null;

        // Awesome! Advance frames.
        const message = await this.sendToChannel({
            content: context.print()
        });

        const advanceData = context.getAdvanceFrameData();
        const maxFrames = getMaxFrames();
        if(advanceData.FramesToAdvance > maxFrames) {
            this.sendToChannel({
                content: `${advanceData.FramesToAdvance} frames?? Capped to ${maxFrames}.`,
            });
            advanceData.FramesToAdvance = maxFrames;
        }
        
        this.emit("advanceFrame", advanceData, contributors, message?.id ?? "unknown");
    }
    
    private setupClientEvents() {
        this.client.start().then(() => {
            console.log("Slack client ready!");

            this.emit("ready");
            
            this.onDescriptionChange(this.descriptionManager.getShortDescription());
        });

        this.client.event("reaction_added", async ({ event }) => {
            const emoji = event.reaction;
            if(event.item.ts === this.gameplayMessageID) {
                if(["information_source", "tw_information_source"].includes(emoji)) {
                    this.infoReaction(event.user);
                    return;
                }
                
                console.log(`Received ${emoji} reaction to latest message`);
                this.reactionsFinishedDebounce(this.gameplayMessageID);
            }
        });
    }
    
    private async infoReaction(user: string) {
        if(this.lastInfoTime === null || (Date.now() - this.lastInfoTime) > 120_000) {
            this.lastInfoTime = Date.now();
            await this.sendToChannel({
                content: this.descriptionManager.getLongDescription(getEmojiForKey),
                ephemeral: user
            });
        }
    }
    
    private setupSketchyErrorHandling() {
        process.on("uncaughtException", (error) => {
            console.error("Uncaught Exception:", error);
            this.sendToChannel({
                content: `:annoyedline: An error occurred; Slack is probably rate limiting us. Wait a few seconds, and we'll restart the bot. <@U078QP0J4EM> ahhh something went wrong`,
            });
            
            this.gameplayMessageID = null;
            setTimeout(() => process.exit(1), 1000);
        });

        process.on("unhandledRejection", (reason, promise) => {
            console.error("Unhandled Rejection at:", promise, "reason:", reason);
            this.sendToChannel({
                content: `:annoyedline: An error occurred; Slack is probably rate limiting us. Wait a few seconds, and we'll restart the bot. <@U078QP0J4EM> ahhh something went wrong`,
            });
            
            this.gameplayMessageID = null;
            setTimeout(() => process.exit(1), 1000);
        });
    }
    
    public async onScreenshot(pngBuffer: Buffer) {
        const message = await this.sendToChannel({
            content: `See the info canvas for how to play, or react with ℹ️ for more.`,
            files: [{
                buf: pngBuffer,
                filename: "celeste.png"
            }]
        });
        
        this.lastInfoTime = null;
        
        if(message) {
            this.gameplayMessageID = message.id;
        } else {
            console.error("Failed to send message!");
        }
    }
    
    public onDeath(_newDeathCount: number): void {
        if(shouldLogDeaths()) {
            this.sendToChannel({
                content: ":annoyedline: Madeline died"
            });
        }
    }
    
    public onMessage(msg: string): void {
        this.sendToChannel({
            content: msg
        });
    }
    
    public onStrawberryCollected(event: StrawberryCollectedEvent, contributors: string[]): void {
        let content = "";
        const firstTimeText = event.isGhost ? "" : " for the first time";
        const wingedText = event.isWinged ? " winged" : "";
        if(event.isGolden) {
            content += `## :strawberry: Collected **${event.chapterName}**${wingedText} golden strawberry${firstTimeText}! ${event.newStrawberryCount}/175\n`;
        } else {
            content += `### :strawberry: Collected **${event.chapterName} ${event.roomName}**${wingedText} strawberry${firstTimeText}! ${event.newStrawberryCount}/175\n`;
        }
        
        content += `Contributors: ${contributors.map(id => `<@${id}>`).join(", ")}\n`;
        content += "-# Note: contributors may not be accurate; it's just a heuristic!";
        
        this.sendToChannel({
            content,
        });

        if(event.newStrawberryCount >= 202) {
            this.sendToChannel({
                content: ":surprised: what"
            });
        }
    }

    public onCassetteConnected(event: CassetteCollectedEvent, contributors: string[]): void {
        const firstTimeText = event.isGhost ? "" : " for the first time";

        let content = `### :vhs: Collected **${event.chapterName}** cassette${firstTimeText}! ${event.newCassetteCount} cassette${event.newCassetteCount === 1 ? "" : "s"} total.\n`;
        
        content += `Contributors: ${contributors.map(id => `<@${id}>`).join(", ")}\n`;
        content += "-# Note: contributors may not be accurate; it's just a heuristic!";
        
        this.sendToChannel({
            content
        });
    }

    public onHeartCollected(event: HeartCollectedEvent, contributors: string[]): void {
        let content = "";
        const firstTimeText = event.isGhost ? "" : " for the first time";

        let emoji = ({
            [HeartColor.Blue]: ":blue_heart:",
            [HeartColor.Red]: ":heart:",
            [HeartColor.Gold]: ":yellow_heart:",
            [HeartColor.Fake]: ":white_heart:"
        })[event.color];

        const fakeHeartText = event.color === HeartColor.Fake ? " (not including this fake one)" : "";

        content += `### ${emoji} Collected **${event.chapterName}** crystal heart${firstTimeText}! ${event.newHeartCount} heart${event.newHeartCount === 1 ? "" : "s"} total${fakeHeartText}.\n`;
        
        content += `Contributors: ${contributors.map(id => `<@${id}>`).join(", ")}\n`;
        content += "-# Note: contributors may not be accurate; it's just a heuristic!";
        
        this.sendToChannel({
            content
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
                content
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
            content
        });
    }
    
    public onBindsChanged(diff: { [bind: string]: string[]; }): void {
        let content = `Bind${Object.keys(diff).length !== 1 ? "s" : ""} changed:\n${this.descriptionManager.getBindDescription(diff, false, getEmojiForKey)}`;
        
        this.sendToChannel({
            content
        });
    }
}