import { PersistentData } from "./PersistentData";
import { throttleDebounce } from "./utils";

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
        updateDescription: (description: string) => void
    ) {
        // Description updates are rate-limited to 2 requests per 10 minutes (why is it so restrictive??)
        this.descriptionData.onChange(throttleDebounce(() => {
            updateDescription(this.getDescription());
        }, () => 1000 * (60 * 5 + 1)));
    }
    
    public getDescription(): string {
        const data = this.descriptionData.data;
        if(data.currentChapter !== null) {
            return `_${data.currentChapter} ${data.currentRoom}_   🍓 ${data.strawberryCount}/175   ${data.deathCount} deaths (${data.turnsSinceDeath} turn${data.turnsSinceDeath != 1 ? "s" : ""} since last)`;
        } else {
            return `No room controlled   🍓 ${data.strawberryCount}/175   ${data.deathCount} deaths (${data.turnsSinceDeath} turn${data.turnsSinceDeath != 1 ? "s" : ""} since last)`;
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