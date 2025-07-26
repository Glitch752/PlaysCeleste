import path from "path";
import fs from "fs";
import { AdvanceFrameData, StrawberryCollectedEvent } from "./CelesteSocket";

enum EventType {
    InputHistory = "inputHistory",
    ChangeRoom = "changeRoom",
    CompleteChapter = "completeChapter",
    CollectStrawberry = "collectStrawberry",
    Death = "death",
    Message = "message",
    SetControlledChapter = "setControlledChapter"
}

export type EventUser = {
    id: string,
    username: string
}

type GameEventData = {
    type: EventType.InputHistory,
    keysHeld: string[],
    frames: number,
    contributors: EventUser[],
    messageId: string
} | {
    type: EventType.ChangeRoom,
    fromRoomName: string,
    toRoomName: string,
    chapterName: string,
    wasCleared: boolean,
    contributors: EventUser[]
} | {
    type: EventType.CompleteChapter,
    chapterName: string,
    contributors: EventUser[]
} | {
    type: EventType.CollectStrawberry,
    contributors: EventUser[],
    newStrawberryCount: number,
    isGhost: boolean,
    isGolden: boolean,
    isWinged: boolean,
    roomName: string,
    chapterName: string,
    idKey: string
} | {
    type: EventType.Death,
    contributors: EventUser[]
} | {
    type: EventType.Message,
    content: string
} | {
    type: EventType.SetControlledChapter,
    chapter: string | null
};

export type ChangeRoomResult = {
    /**
     * If the room we came from was cleared. Only true if we've entered a new room.
     */
    wasCleared: boolean,
    /**
     * If this was the first clear of the room.
     */
    firstClear: boolean,
    /**
     * The IDs of contributors to this room change.
     */
    contributors: string[]
}

type GameEvent = GameEventData & {
    timestamp: number;
};

export class EventRecorder {
    currentContributors: EventUser[] = [];
    
    filePath: string;
    fileHandle: number;
    
    constructor() {
        this.filePath = path.join(__dirname, "..", "data", "events.json");
        if(!fs.existsSync(this.filePath)) {
            fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
            fs.writeFileSync(this.filePath, "");
        }
        
        this.fileHandle = fs.openSync(this.filePath, "a+");
    }
    
    /**
     * Records an input history event.
     */
    recordInputHistory(data: AdvanceFrameData, contributors: EventUser[], messageId: string = "") {
        this.record({
            type: EventType.InputHistory,
            keysHeld: data.KeysHeld,
            frames: data.FramesToAdvance,
            contributors,
            messageId
        });
        
        for(const user of contributors) {
            if(!this.currentContributors.some(c => c.id === user.id)) {
                this.currentContributors.push(user);
            }
        }
    }
    
    /**
     * Sets the chapter that is currently being controlled.  
     * This is used to determine which chapter events are for.
     */
    setControlledChapter(chapter: string | null) {
        this.record({
            type: EventType.SetControlledChapter,
            chapter
        });
    }
    
    /**
     * Run when the room is changed.  
     * Returns if this was the first time we've entered the new room and a list of contributor IDs.
     */
    async changeRoom(fromRoomName: string, toRoomName: string, chapterName: string): Promise<ChangeRoomResult> {
        let firstEnter = true;
        let firstClear = true;
        for await(const event of this.streamEvents()) {
            console.log(event);
            if(event.type === EventType.ChangeRoom) {
                if(event.toRoomName === toRoomName || event.fromRoomName === toRoomName && event.chapterName === chapterName) {
                    firstEnter = false;
                }
                if(event.fromRoomName === fromRoomName && event.chapterName === chapterName && event.wasCleared) {
                    firstClear = false;
                }
            }
        }
        
        this.record({
            type: EventType.ChangeRoom,
            fromRoomName,
            toRoomName,
            chapterName,
            contributors: this.currentContributors,
            wasCleared: firstEnter
        });
        const contributorIDs = this.currentContributors.map(user => user.id);
        this.clearContributors();
        
        return {
            wasCleared: firstClear,
            firstClear: firstEnter,
            contributors: contributorIDs
        };
    }
    
    private async getChapterContributors(chapterName: string, eventCallback?: (event: GameEvent) => void): Promise<EventUser[]> {
        // Collect the contributors for every room in this chapter
        const chapterContributors: Map<string, EventUser> = new Map();
        
        // This isn't the most efficient way to do this, but meh.
        for await(const event of this.streamEvents()) {
            if(event.type === EventType.ChangeRoom && event.chapterName === chapterName) {
                for(const user of event.contributors) {
                    chapterContributors.set(user.id, user);
                }
            }
            if(event.type === EventType.CompleteChapter && event.chapterName === chapterName) {
                // We only want the most recent completion's data
                chapterContributors.clear();
            }
            eventCallback?.(event);
        }
        
        for(const user of this.currentContributors) {
            chapterContributors.set(user.id, user);
        }
        
        return Array.from(chapterContributors.values());
    }
    
    /**
     * Run when a chapter is completed.  
     * Returns if this was the first completion and a list of contributor IDs.
     */
    async completeChapter(chapterName: string): Promise<[boolean, string[]]> {
        let firstCompletion = true;
        
        const contributors = await this.getChapterContributors(chapterName, (event) => {
            if(event.type === EventType.CompleteChapter && event.chapterName === chapterName) {
                firstCompletion = false;
            }
        });
        
        this.record({
            type: EventType.CompleteChapter,
            chapterName,
            contributors
        });
        this.clearContributors();
        
        return [firstCompletion, contributors.map(user => user.id)];
    }
    
    /**
     * Run when a strawberry is collected.  
     * Returns a list of contributor IDs.
     */
    async collectStrawberry(celesteEvent: StrawberryCollectedEvent): Promise<string[]> {
        const contributors = celesteEvent.isGolden ?
            (await this.getChapterContributors(celesteEvent.chapterName))
            : this.currentContributors;
        
        this.record({
            type: EventType.CollectStrawberry,
            newStrawberryCount: celesteEvent.newStrawberryCount,
            roomName: celesteEvent.roomName,
            chapterName: celesteEvent.chapterName,
            idKey: celesteEvent.idKey,
            isGhost: celesteEvent.isGhost,
            isGolden: celesteEvent.isGolden,
            isWinged: celesteEvent.isWinged,
            contributors
        });
        
        return contributors.map(user => user.id);
    }
    
    /**
     * Run when the player dies.
     */
    playerDeath() {
        this.record({
            type: EventType.Death,
            contributors: this.currentContributors
        });
    }
    
    /**
     * Records a message event.  
     * This doesn't have any specific meaning.
     */
    recordMessage(content: string) {
        this.record({
            type: EventType.Message,
            content
        });
    }
    
    /**
     * Clears the current contributors.
     */
    private clearContributors() {
        this.currentContributors = [];
    }
    
    record(event: GameEventData) {
        const timestamp = Date.now();
        fs.writeSync(this.fileHandle, JSON.stringify({ ...event, timestamp } satisfies GameEvent) + "\n");
    }
    
    /**
     * Streams the full event history item-by-item so we can handle huge files.
     */
    async *streamEvents(): AsyncGenerator<GameEvent> {
        const fileStream = fs.createReadStream(this.filePath, { encoding: "utf8" });
        let current = "";
        for await(const chunk of fileStream) {
            current += chunk;
            let lines = current.split("\n");
            current = lines.pop() || "";
            for(const line of lines) {
                if(line.trim()) {
                    yield JSON.parse(line) as GameEvent;
                }
            }
        }
        if(current.trim()) {
            yield JSON.parse(current) as GameEvent;
        }
    }
}