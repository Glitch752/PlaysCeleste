import path from "path";
import fs from "fs";
import { AdvanceFrameData } from "./CelesteSocket";

enum EventType {
    InputHistory = "inputHistory",
    ChangeRoom = "changeRoom",
    CompleteChapter = "completeChapter",
    CollectStrawberry = "collectStrawberry",
    Death = "death",
    Message = "message"
}

export type EventUser = {
    id: string,
    username: string
}

type GameEventData = {
    type: EventType.InputHistory,
    keysHeld: string[],
    frames: number,
    contributors: EventUser[]
} | {
    type: EventType.ChangeRoom,
    fromRoomName: string,
    toRoomName: string,
    chapterName: string,
    contributors: EventUser[]
} | {
    type: EventType.CompleteChapter,
    chapterName: string,
    contributors: EventUser[]
} | {
    type: EventType.CollectStrawberry,
    contributors: EventUser[],
    newStrawberryCount: number,
    isGolden: boolean,
    isWinged: boolean,
    roomName: string,
    chapterName: string
} | {
    type: EventType.Death,
    contributors: EventUser[]
} | {
    type: EventType.Message,
    content: string
};

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
    recordInputHistory(data: AdvanceFrameData, contributors: EventUser[]) {
        this.record({
            type: EventType.InputHistory,
            keysHeld: data.KeysHeld,
            frames: data.FramesToAdvance,
            contributors
        });
        
        for(const user of contributors) {
            if(!this.currentContributors.some(c => c.id === user.id)) {
                this.currentContributors.push(user);
            }
        }
    }
    
    /**
     * Run when the room is changed.  
     * Returns if this was the first time we've entered the new room and a list of contributor IDs.
     */
    async changeRoom(fromRoomName: string, toRoomName: string, chapterName: string): Promise<[boolean, string[]]> {
        this.record({
            type: EventType.ChangeRoom,
            fromRoomName,
            toRoomName,
            chapterName,
            contributors: this.currentContributors
        });
        const contributorIDs = this.currentContributors.map(user => user.id);
        this.clearContributors();
        
        let firstTime = true;
        for await(const event of this.streamEvents()) {
            if(event.type === EventType.ChangeRoom && event.toRoomName === toRoomName && event.chapterName === chapterName) {
                firstTime = false;
            }
        }
        
        return [firstTime, contributorIDs];
    }
    
    private async getChapterContributors(chapterName: string, eventCallback: (event: GameEvent) => void): Promise<EventUser[]> {
        // Collect the contributors for every room in this chapter
        const chapterContributors: Map<string, EventUser> = new Map();
        
        for(const user of this.currentContributors) {
            chapterContributors.set(user.id, user);
        }
        
        for await(const event of this.streamEvents()) {
            if(event.type === EventType.ChangeRoom && event.chapterName === chapterName) {
                for(const user of event.contributors) {
                    chapterContributors.set(user.id, user);
                }
            }
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
     * Returns if this was the first time we've collected this strawberry and a list of contributor IDs.
     */
    async collectStrawberry(
        newStrawberryCount: number,
        winged: boolean, golden: boolean,
        roomName: string,
        chapterName: string
    ): Promise<[boolean, string[]]> {
        let firstCompletion = true;
        const goldenContributors = await this.getChapterContributors(chapterName, (event) => {
            if(event.type === EventType.CollectStrawberry && event.roomName === roomName && event.chapterName === chapterName) {
                firstCompletion = false;
            }
        });
        
        const contributors = golden ? goldenContributors : this.currentContributors;
        
        this.record({
            type: EventType.CollectStrawberry,
            newStrawberryCount,
            roomName,
            chapterName,
            isGolden: golden,
            isWinged: winged,
            contributors
        });
        
        return [firstCompletion, contributors.map(user => user.id)];
    }
    
    /**
     * Run when the player dies.
     */
    playerDeath() {
        this.record({
            type: EventType.Death,
            contributors: this.currentContributors
        });
        this.clearContributors();
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