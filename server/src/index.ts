import { AdvanceFrameData, CelesteSocket } from "./CelesteSocket";
import UPNG from "upng-js";
import { cropImage } from "./utils";
import { getSyncedState, setStateChangeCallback } from "./state";
import { EventRecorder } from "./EventRecorder";
import { DescriptionManager } from "./DescriptionManager";
import { Bot } from "./bots/Bot";
import { DiscordBot } from "./bots/discord/DiscordBot";
import { config } from "./config";
import { TwitchBot } from "./bots/twitch/TwitchBot";

class DiscordPlaysCelesteServer {
    private celesteSocket: CelesteSocket;
    private celesteConnected = false;
    private initializedDiscord = false;

    private framesReceived = 0;

    private eventRecorder: EventRecorder;

    constructor(
        private bot: Bot
    ) {
        this.eventRecorder = new EventRecorder();
        this.celesteSocket = new CelesteSocket();

        this.setupCelesteSocketEvents();
        this.setupBotEvents();
    }

    private setupCelesteSocketEvents() {
        this.celesteSocket.once("connect", () => {
            console.log("Connected to Celeste!");
            this.celesteConnected = true;
            
            if(this.initializedDiscord) {
                this.initCeleste();
            }
        });

        this.celesteSocket.on("screenshotData", async (frame) => {
            console.log(`Received ${frame.width}x${frame.height} frame (${this.framesReceived++})`);

            // Encode as PNG and save
            let arrayBuf = Uint8Array.from(frame.data).buffer;
            let width = frame.width, height = frame.height;
            [arrayBuf, width, height] = cropImage(arrayBuf, frame.width, frame.height);

            const pngArrayBuffer = UPNG.encode([arrayBuf], width, height, 256);
            const pngBuffer = Buffer.from(pngArrayBuffer);

            this.bot.onScreenshot(pngBuffer);
            
            this.bot.descriptionManager.addTurn();
        });

        this.celesteSocket.on("message", (msg) => {
            console.log(`Received message to send: ${msg}`);
            this.bot.onMessage(msg);
            this.eventRecorder.recordMessage(msg);
        });
        
        this.celesteSocket.on("playerDeath", (event) => {
            this.bot.onDeath(event.newDeathCount);
            this.eventRecorder.playerDeath(event.newDeathCount);
            this.bot.descriptionManager.onDeath(event.newDeathCount);
        });
        
        this.celesteSocket.on("strawberryCollected", async (event) => {
            const contributors = await this.eventRecorder.collectStrawberry(event);
            this.bot.onStrawberryCollected(event, contributors);
            this.bot.descriptionManager.setStrawberryCount(event.newStrawberryCount);
        });

        this.celesteSocket.on("heartCollected", (event) => {
            const contributors = this.eventRecorder.collectHeart(event);
            this.bot.onHeartCollected(event, contributors);
        });

        this.celesteSocket.on("cassetteCollected", (event) => {
            const contributors = this.eventRecorder.collectCassette(event);
            this.bot.onCassetteConnected(event, contributors);
        });
        
        this.celesteSocket.on("changeRoom", async (event) => {
            const result = await this.eventRecorder.changeRoom(event);
            this.bot.onRoomChange(event, result);
            this.bot.descriptionManager.setRoom(event.toRoomName);
        });
        
        this.celesteSocket.on("completeChapter", async (event) => {
            const [firstCompletion, contributors] = await this.eventRecorder.completeChapter(event.chapterName);
            this.bot.onCompleteChapter(event, firstCompletion, contributors);
        });
        
        this.celesteSocket.on("setControlledChapter", (event) => {
            if(event.chapter != null) console.log(`Set controlled chapter to ${event.chapter}`);
            else console.log("Cleared controlled chapter");
            this.eventRecorder.setControlledChapter(event.chapter, event.reason);
            this.bot.descriptionManager.setChapter(event.chapter);
        });
        
        this.celesteSocket.on("bindsChanged", (event) => {
            console.log("Received new binds");
            const diff = this.bot.descriptionManager.setBinds(event.binds);
            if(Object.keys(diff).length > 0) {
                this.eventRecorder.bindsChanged(event.binds);
                this.bot.onBindsChanged(diff);
            }
        });

        this.celesteSocket.on("close", () => {
            console.log("Disconnected from Celeste");
            this.celesteConnected = false;
        });

        this.celesteSocket.on("error", (e) => {
            console.error("Celeste socket error:", e);
        });
    }
    
    private setupBotEvents() {
        this.bot.on("ready", async () => {
            if(!this.celesteConnected) {
                // Wait for celeste to connect
                console.log("Waiting for Celeste to connect...");
                while(!this.celesteConnected) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            let previousControlledByDiscord = getSyncedState().ControlledByDiscord;
            
            setStateChangeCallback(() => {
                const syncedState = getSyncedState();
                this.celesteSocket.updateSyncedState(syncedState);
                
                if(!previousControlledByDiscord && syncedState.ControlledByDiscord) {
                    const data: AdvanceFrameData = {
                        KeysHeld: [],
                        FramesToAdvance: 0 // Just screenshot
                    };
                    this.celesteSocket.sendAdvanceFrame(data);   
                }
                previousControlledByDiscord = syncedState.ControlledByDiscord;
            });
            
            this.initCeleste();
            
            this.initializedDiscord = true; 
        });
        
        this.bot.on("advanceFrame", (data, contributors, id) => {
            this.celesteSocket.sendAdvanceFrame(data);
            this.eventRecorder.recordInputHistory(data, contributors, id);
        });
    }

    private initCeleste() {
        const syncedState = getSyncedState();
        this.celesteSocket.updateSyncedState(syncedState);
        if(syncedState.ControlledByDiscord) {
            const data: AdvanceFrameData = {
                KeysHeld: [],
                FramesToAdvance: 0 // Just screenshot
            };
            this.celesteSocket.sendAdvanceFrame(data);
            // this.eventRecorder.recordInputHistory(data, []);
        }
    }
}

new DiscordPlaysCelesteServer(config.BOT_TO_USE === "discord" ? new DiscordBot() : new TwitchBot());