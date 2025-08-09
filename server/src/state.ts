import { PersistentData } from "./PersistentData";

export type SyncedState = {
    /**
     * Whether the game is currently being controlled by Discord.
     * If false, the game is being manually controlled instead.
     */
    ControlledByDiscord: boolean;
    /**
     * Whether we should override debug mode to be off.
     */
    OverrideDebugMode: boolean;
};

let state = new PersistentData<SyncedState>({
    ControlledByDiscord: true,
    OverrideDebugMode: true
}, "state.json");

export function getSyncedState(): SyncedState {
    return { ...state.data }; // copy
}

export function setStateChangeCallback(callback: () => void) {
    state.onChange(callback);
}