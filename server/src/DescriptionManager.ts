import { getEmojiForKey } from "./bots/discord/EmojiMeaning";
import { PersistentData } from "./PersistentData";
import { formatList } from "./utils";

type DescriptionData = {
    currentChapter: string | null,
    currentRoom: string,
    strawberryCount: number,
    turnsSinceDeath: number,
    deathCount: number,
    binds: {
        [bind: string]: string[]
    }
};

export class DescriptionManager {
    private descriptionData = new PersistentData<DescriptionData>({
        currentChapter: null,
        currentRoom: "",
        deathCount: 0,
        strawberryCount: 0,
        turnsSinceDeath: 0,
        binds: {}
    }, "descriptionData.json");
    
    private static NICE_BIND_NAMES: { [bind: string]: string } = {
        "MenuLeft": "Left (menu-only)",
        "MenuRight": "Right (menu-only)",
        "MenuUp": "Up (menu-only)",
        "MenuDown": "Down (menu-only)",
        "QuickRestart": "Quick Restart",
        "DemoDash": "Demo Dash",
        "LeftMoveOnly": "Left (move-only)",
        "RightMoveOnly": "Right (move-only)",
        "UpMoveOnly": "Up (move-only)",
        "DownMoveOnly": "Down (move-only)",
        "LeftDashOnly": "Left (dash-only)",
        "RightDashOnly": "Right (dash-only)",
        "UpDashOnly": "Up (dash-only)",
        "DownDashOnly": "Down (dash-only)"
    };
    
    constructor(
        onDescriptionChange: (description: string) => void,
    ) {
        this.descriptionData.onChange(() => onDescriptionChange(this.getShortDescription()));
    }
    
    public getShortDescription(): string {
        const data = this.descriptionData.data;
        if(data.currentChapter !== null) {
            return `_${data.currentChapter} ${data.currentRoom}_   🍓 ${data.strawberryCount}/175   ${data.deathCount} deaths (${data.turnsSinceDeath} turn${data.turnsSinceDeath != 1 ? "s" : ""} since last)`;
        } else {
            return `No room controlled   🍓 ${data.strawberryCount}/175   ${data.deathCount} deaths (${data.turnsSinceDeath} turn${data.turnsSinceDeath != 1 ? "s" : ""} since last)`;
        }
    }
    
    public getLongDescription(): string {
        return `${this.getShortDescription()}

Current binds:
${this.getBindDescription(this.descriptionData.data.binds)}`;
    }
    
    public getBindDescription(binds: { [bind: string]: string[] }, skipEmpty: boolean = true): string {
        return Object.entries(binds)
            .filter(([_, keys]) => !skipEmpty || keys.length > 0)
            .sort(([a, b]) => a[0].localeCompare(b[0]))
            .map(([bind, keys]) => `**${DescriptionManager.NICE_BIND_NAMES[bind] ?? bind}**: \t${
                keys.length === 0 ? "None" :
                formatList(keys.map(key => getEmojiForKey(key) ?? key))
            }`)
            .join("\n");
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
    
    /**
     * Sets the binds for the description.  
     * Returns the difference between the previous and new binds.
     */
    public setBinds(binds: { [bind: string]: string[] }): { [changedBind: string]: string[] } {
        const previousBinds = this.descriptionData.data.binds;
        
        let diff: { [changedBind: string]: string[] } = {};
        for(const [bind, keys] of Object.entries(binds)) {
            const previousKeys = previousBinds[bind] || [];
            if(previousKeys.length !== keys.length || !keys.every((key, index) => key === previousKeys[index])) {
                diff[bind] = keys;
            }
        }
        
        if(Object.keys(diff).length > 0) {
            this.descriptionData.data.binds = binds;   
        }
        
        return diff;
    }
    
    public onDeath(newCount: number) {
        this.descriptionData.data.deathCount = newCount;
        this.descriptionData.data.turnsSinceDeath = 0;
    }
    
    public addTurn() {
        this.descriptionData.data.turnsSinceDeath++;
    }
}