import path from "path";
import fs from "fs";
import { AdvanceFrameData, CassetteCollectedEvent, ChangeRoomEvent, HeartCollectedEvent, HeartColor, StrawberryCollectedEvent } from "./CelesteSocket";

enum EventType {
    InputHistory = "inputHistory",
    ChangeRoom = "changeRoom",
    CompleteChapter = "completeChapter",
    CollectStrawberry = "collectStrawberry",
    CollectHeart = "collectHeart",
    CollectCassette = "collectCassette",
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
    fromRoomName: string | null,
    toRoomName: string,
    chapterName: string,
    reason: string,
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
    type: EventType.CollectHeart,
    contributors: EventUser[],
    newHeartCount: number,
    isGhost: boolean,
    roomName: string,
    chapterName: string
} | {
    type: EventType.CollectCassette,
    contributors: EventUser[],
    newCassetteCount: number,
    isGhost: boolean,
    roomName: string,
    chapterName: string
} | {
    type: EventType.Death,
    contributors: EventUser[],
    newDeathCount: number
} | {
    type: EventType.Message,
    content: string
} | {
    type: EventType.SetControlledChapter,
    chapter: string | null,
    reason: string | null
};

export type ChangeRoomResult = {
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
    previousRoomContributors: Map<string, EventUser[]> = new Map();
    
    previousRooms: string[] = [];
    static MAX_PREVIOUS_ROOMS: number = 5;
    
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
    setControlledChapter(chapter: string | null, reason: string | null) {
        this.record({
            type: EventType.SetControlledChapter,
            chapter,
            reason
        });
    }
    
    /**
     * Run when the room is changed.  
     * Returns if this was the first time we've entered the new room and a list of contributor IDs.
     */
    async changeRoom(ev: ChangeRoomEvent): Promise<ChangeRoomResult> {
        const { fromRoomName, toRoomName, chapterName, reason } = ev;

        let firstClear = true;
        for await(const event of this.streamEvents()) {
            if(event.type === EventType.ChangeRoom) {
                if(event.toRoomName === toRoomName && event.chapterName === chapterName) {
                    firstClear = false;
                }
            }
        }

        let contributors = this.currentContributors;
        // If nobody contributed to a room, get the latest room that somebody did contribute to (if any)
        // this probably isn't correct all of the time, but it's close enough
        if(contributors.length === 0 && fromRoomName != null) {
            for(let i = this.previousRooms.length - 1; i >= 0; i--) {
                const room = this.previousRooms[i];
                const roomContributors = this.previousRoomContributors.get(room);
                if(roomContributors != null && roomContributors.length > 0) {
                    contributors = roomContributors;
                    break;
                }
            }
        }
        
        const contributorIDs = contributors.map(user => user.id);
        this.record({
            type: EventType.ChangeRoom,
            fromRoomName,
            toRoomName,
            chapterName,
            contributors: contributors,
            wasCleared: firstClear,
            reason
        });
        
        if(fromRoomName != null) {
            this.previousRoomContributors.set(fromRoomName, this.currentContributors);
        }
        this.currentContributors = [];

        if(fromRoomName != null) {
            this.previousRooms.push(fromRoomName);
            if(this.previousRooms.length > EventRecorder.MAX_PREVIOUS_ROOMS) this.previousRooms.shift();
        }
        
        return {
            firstClear: firstClear,
            contributors: contributorIDs
        };
    }
    
    private async getChapterContributors(chapterName: string, eventCallback?: (event: GameEvent) => void): Promise<EventUser[]> {
        // Collect the contributors for every room in this chapter
        const chapterContributors: Map<string, EventUser> = new Map();

        const startTime = Date.now();
        
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
        
        console.log(`Collected contributors for chapter ${chapterName} in ${Date.now() - startTime}ms`);

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
        
        this.currentContributors = [];
        this.previousRoomContributors.clear();
        
        return [firstCompletion, contributors.map(user => user.id)];
    }
    
    /**
     * Run when a strawberry is collected.  
     * Returns a list of contributor IDs.
     */
    async collectStrawberry(celesteEvent: StrawberryCollectedEvent): Promise<string[]> {
        let contributors = celesteEvent.isGolden ?
            (await this.getChapterContributors(celesteEvent.chapterName))
            : (this.previousRoomContributors.get(celesteEvent.roomName) ?? []).concat(this.currentContributors);
        
        // Deduplicate contributors
        const uniqueContributors = new Map<string, EventUser>();
        for(const user of contributors) {
            uniqueContributors.set(user.id, user);
        }
        contributors = Array.from(uniqueContributors.values());
        
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
     * Run when a crystal heart is collected.  
     * Returns a list of contributor IDs.
     */
    collectHeart(celesteEvent: HeartCollectedEvent): string[] {
        let contributors = (this.previousRoomContributors.get(celesteEvent.roomName) ?? []).concat(this.currentContributors);
        
        // Deduplicate contributors
        const uniqueContributors = new Map<string, EventUser>();
        for(const user of contributors) {
            uniqueContributors.set(user.id, user);
        }
        contributors = Array.from(uniqueContributors.values());
        
        this.record({
            type: EventType.CollectHeart,
            isGhost: celesteEvent.isGhost,
            newHeartCount: celesteEvent.newHeartCount,
            roomName: celesteEvent.roomName,
            chapterName: celesteEvent.chapterName,
            contributors
        });
        
        return contributors.map(user => user.id);
    }

    /**
     * Run when a cassette is collected.  
     * Returns a list of contributor IDs.
     */
    collectCassette(celesteEvent: CassetteCollectedEvent): string[] {
        let contributors = (this.previousRoomContributors.get(celesteEvent.roomName) ?? []).concat(this.currentContributors);
        
        // Deduplicate contributors
        const uniqueContributors = new Map<string, EventUser>();
        for(const user of contributors) {
            uniqueContributors.set(user.id, user);
        }
        contributors = Array.from(uniqueContributors.values());
        
        this.record({
            type: EventType.CollectCassette,
            isGhost: celesteEvent.isGhost,
            newCassetteCount: celesteEvent.newCassetteCount,
            roomName: celesteEvent.roomName,
            chapterName: celesteEvent.chapterName,
            contributors
        });
        
        return contributors.map(user => user.id);
    }
    
    /**
     * Run when the player dies.
     */
    playerDeath(newDeathCount: number) {
        this.record({
            type: EventType.Death,
            contributors: this.currentContributors,
            newDeathCount
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