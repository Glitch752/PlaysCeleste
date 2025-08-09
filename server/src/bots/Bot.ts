import { EventEmitter } from 'events';
import { AdvanceFrameData, CassetteCollectedEvent, ChangeRoomEvent, CompleteChapterEvent, HeartCollectedEvent, StrawberryCollectedEvent } from '../CelesteSocket';
import { ChangeRoomResult, EventUser } from '../EventRecorder';
import { DescriptionManager } from '../DescriptionManager';
import { throttleDebounce } from '../utils';

export type BotEvents = {
    ready: [];
    advanceFrame: [AdvanceFrameData, EventUser[], string]
};

export abstract class Bot extends EventEmitter<BotEvents> {
    public descriptionManager: DescriptionManager;
    
    constructor({
        descriptionDebounce
    }: {
        descriptionDebounce?: number
    }) {
        super();
        
        this.descriptionManager = new DescriptionManager(descriptionDebounce ? throttleDebounce((description: string) => {
            this.onDescriptionChange(description);
        }, () => descriptionDebounce) : this.onDescriptionChange.bind(this));
    }
    
    public abstract onDescriptionChange(description: string): void;
    public abstract onScreenshot(pngBuffer: Buffer): Promise<void>;
    public abstract onDeath(newDeathCount: number): void;
    public abstract onMessage(msg: string): void;
    public abstract onStrawberryCollected(event: StrawberryCollectedEvent, contributors: string[]): void;
    public abstract onHeartCollected(event: HeartCollectedEvent, contributors: string[]): void;
    public abstract onCassetteConnected(event: CassetteCollectedEvent, contributors: string[]): void;
    public abstract onRoomChange(event: ChangeRoomEvent, result: ChangeRoomResult): void;
    public abstract onCompleteChapter(event: CompleteChapterEvent, firstCompletion: boolean, contributors: string[]): void;
    public abstract onBindsChanged(diff: { [bind: string]: string[] }): void;
}