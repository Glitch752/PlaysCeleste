import { PersistentData } from "./PersistentData";

interface Settings {
    MINIMUM_REACTIONS_REQUIRED: number;
    REACTION_DEBOUNCE: number;
    MAX_FRAMES: number;
    LOG_DEATHS: boolean;
}

let settings = new PersistentData<Settings>({
    MINIMUM_REACTIONS_REQUIRED: 1,
    REACTION_DEBOUNCE: 5,
    MAX_FRAMES: 1000,
    LOG_DEATHS: true
}, "settings.json");

export function getMinimumReactionsRequired() {
    return settings.data.MINIMUM_REACTIONS_REQUIRED;
}

export function getReactionDebounce() {
    return settings.data.REACTION_DEBOUNCE;
}

export function getMaxFrames() {
    return settings.data.MAX_FRAMES;
}

export function shouldLogDeaths() {
    return settings.data.LOG_DEATHS;
}