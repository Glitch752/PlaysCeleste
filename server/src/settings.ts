
import fs from "fs";
import path from "path";

const settingsPath = path.resolve(__dirname, "settings.json");

interface Settings {
    MINIMUM_REACTIONS_REQUIRED: number;
    REACTION_DEBOUNCE: number;
}

let settings: Settings = {
    MINIMUM_REACTIONS_REQUIRED: 1,
    REACTION_DEBOUNCE: 5,
};

// Load settings from file
function loadSettings() {
    try {
        const data = fs.readFileSync(settingsPath, "utf-8");
        const parsed = JSON.parse(data);
        settings = { ...settings, ...parsed };
        console.log("Settings loaded:", settings);
    } catch (err) {
        console.warn("Could not load settings.json, using defaults.", err);
    }
}

let settingChangedCallbacks: (() => void)[] = [];

// Watch for changes and reload on-the-fly
fs.watch(settingsPath, { persistent: false }, (eventType) => {
    if (eventType === "change") {
        loadSettings();
        
        settingChangedCallbacks.forEach(callback => callback());
    }
});

// Initial load
loadSettings();

export function getMinimumReactionsRequired() {
    return settings.MINIMUM_REACTIONS_REQUIRED;
}

export function getReactionDebounce() {
    return settings.REACTION_DEBOUNCE;
}

export function onSettingChanged(callback: () => void) {
    settingChangedCallbacks.push(callback);
}