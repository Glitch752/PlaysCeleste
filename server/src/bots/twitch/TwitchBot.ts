import { Bot } from "../Bot";
import { Client } from "tmi.js";
import { config } from "../../config";
import { CassetteCollectedEvent, ChangeRoomEvent, CompleteChapterEvent, HeartCollectedEvent, StrawberryCollectedEvent } from "../../CelesteSocket";
import { ChangeRoomResult } from "../../EventRecorder";

export class TwitchBot extends Bot {
    private client: Client;
    
    // Twitch's game ID for Celeste.
    private static CELESTE_GAME_ID: string = "492535";
    
    constructor() {
        super({});
        
        this.client = new Client({
            options: { debug: true },
            identity: {
                username: config.TWITCH_BOT_USERNAME,
                password: config.TWITCH_BOT_PASSWORD
            },
            channels: [ config.TWITCH_CHANNEL ]
        });
        
        this.setupClientEvents();
        
        this.client.connect().catch(err => {
            console.error("Failed to connect to Twitch:", err);
        });
    }
    
    private setupClientEvents() {
        this.client.on("connected", () => {
            console.log(`Connected to Twitch channel ${config.TWITCH_CHANNEL}`);
            this.emit("ready");
        });

        this.client.on("message", (channel, tags, message, self) => {
            if(self) return; // Ignore own messages
            
            console.log(`Received message: ${message}`);
            // TODO
        });
    }
    
    public onDescriptionChange(description: string): void {
        // TODO
    }
    
    public onCompleteChapter(event: CompleteChapterEvent, firstCompletion: boolean, contributors: string[]): void {
        // TODO
    }
    
    public onDeath(newDeathCount: number): void {
        // TODO
    }
    
    public onMessage(msg: string): void {
        // TODO
    }
    
    public onRoomChange(event: ChangeRoomEvent, result: ChangeRoomResult): void {
        // TODO
    }
    
    public async onScreenshot(pngBuffer: Buffer): Promise<void> {
        // TODO
    }
    
    public onStrawberryCollected(event: StrawberryCollectedEvent, contributors: string[]): void {
        // TODO
    }

    public onHeartCollected(event: HeartCollectedEvent, contributors: string[]): void {
        // TODO
    }

    public onCassetteConnected(event: CassetteCollectedEvent, contributors: string[]): void {
        // TODO
    }
    
    public onBindsChanged(diff: { [bind: string]: string[]; }): void {
        // TODO
    }
}