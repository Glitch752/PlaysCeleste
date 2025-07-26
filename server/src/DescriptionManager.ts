import { Client, TextChannel } from "discord.js";
import { PersistentData } from "./PersistentData";
import { throttleDebounce } from "./utils";
import { config } from "./config";

type DescriptionData = {
    currentChapter: string | null,
    currentRoom: string,
    strawberryCount: number,
    turnsSinceDeath: number,
    deathCount: number
};

export class DescriptionManager {
    private descriptionData = new PersistentData<DescriptionData>({
        currentChapter: null,
        currentRoom: "",
        deathCount: 0,
        strawberryCount: 0,
        turnsSinceDeath: 0
    }, "descriptionData.json");
    
    constructor(
        private client: Client
    ) {
        // Description updates are rate-limited to 2 requests per 10 minutes (why is it so restrictive??)
        this.descriptionData.onChange(throttleDebounce(this.updateDescription.bind(this), () => 1000 * (60 * 5 + 1)));
    }
    
    public getDescription(): string {
        const data = this.descriptionData.data;
        if(data.currentChapter !== null) {
            return `_${data.currentChapter} ${data.currentRoom}_   :strawberry: ${data.strawberryCount}/175   ${data.deathCount} deaths (${data.turnsSinceDeath} turn${data.turnsSinceDeath != 1 ? "s" : ""} since last)`;
        } else {
            return `No room controlled   :strawberry: ${data.strawberryCount}/175   ${data.deathCount} deaths (${data.turnsSinceDeath} turn${data.turnsSinceDeath != 1 ? "s" : ""} since last)`;
        }
    }
    
    public async updateDescription() {
        const channel = this.client.channels.cache.get(config.CHANNEL_ID);
        if(channel && channel.isTextBased()) {
            (channel as TextChannel).setTopic(`See <#1396661382782517401>!   ${this.getDescription()}
                    
Info may be out-of-date due to severe rate-limiting on Discord's side.`);
        }
    }
    
    public setChapter(chapter: string | null) {
        this.descriptionData.data.currentChapter = chapter;
    }
    
    public setRoom(room: string) {
        this.descriptionData.data.currentRoom = room;
    }
    
    public setStrawberryCount(count: number) {
        this.descriptionData.data.strawberryCount = count;
    }
    
    public onDeath(newCount: number) {
        this.descriptionData.data.deathCount = newCount;
        this.descriptionData.data.turnsSinceDeath = 0;
    }
    
    public addTurn() {
        this.descriptionData.data.turnsSinceDeath++;
    }
}