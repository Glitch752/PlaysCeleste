import fs from "fs";
import path from "path";

export type SyncedState = {
    /**
     * Whether the game is currently being controlled by Discord.
     * If false, the game is being manually controlled instead.
     */
    ControlledByDiscord: boolean;
};

const statePath = path.resolve(__dirname, "..", "data", "state.json");

let state: SyncedState = {
    ControlledByDiscord: true
};

function loadState() {
    if (!fs.existsSync(statePath)) {
        console.warn("State file not found, using defaults.");
        fs.mkdirSync(path.dirname(statePath), { recursive: true });
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
        return;
    }

    const data = fs.readFileSync(statePath, "utf-8");
    state = JSON.parse(data) as SyncedState;
}

loadState();

let stateChangeCallback = () => {};

fs.watch(statePath, { persistent: false }, (eventType) => {
    if(eventType === "change") {
        try {
            loadState();
            console.log("State file changed, reloading...");
            if(!state.ControlledByDiscord) {
                console.warn("State file indicates manual control!");
            }
            stateChangeCallback();
        } catch (err) {
            console.warn("Could not load state.json, using defaults.", err);
        }
    }
});

export function getSyncedState(): SyncedState {
    return { ...state }; // copy
}

export function setStateChangeCallback(callback: () => void) {
    stateChangeCallback = callback;
}