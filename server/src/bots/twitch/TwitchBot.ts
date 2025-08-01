import { Bot } from "../Bot";
import { Client } from "tmi.js";
import { config } from "../../config";
import { ChangeRoomEvent, CompleteChapterEvent, StrawberryCollectedEvent } from "../../CelesteSocket";
import { ChangeRoomResult } from "../../EventRecorder";

export class TwitchBot extends Bot {
    private client: Client;
    
    constructor() {
        super();
        
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
    
    public updateDescription(description: string): void {
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
}