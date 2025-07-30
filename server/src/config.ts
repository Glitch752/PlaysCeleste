import dotenv from "dotenv";

dotenv.config();

const {
    BOT_TO_USE,
    DISCORD_TOKEN, DISCORD_CLIENT_ID, CHANNEL_ID,
    TWITCH_CHANNEL, TWITCH_BOT_USERNAME, TWITCH_BOT_PASSWORD
} = process.env;

function checkEnvVar(varName: string) {
    const value = process.env[varName];
    if(!value) {
        throw new Error(`Environment variable ${varName} is not set`);
    }
    return value;
}

if(DISCORD_TOKEN === "dev" || DISCORD_CLIENT_ID === "dev") {
    console.warn("Running in development mode. Using mock client.");
}

checkEnvVar("BOT_TO_USE");
if(BOT_TO_USE === "discord") {
    checkEnvVar("DISCORD_TOKEN");
    checkEnvVar("DISCORD_CLIENT_ID");
    checkEnvVar("CHANNEL_ID");   
} else {
    checkEnvVar("TWITCH_CHANNEL");
    checkEnvVar("TWITCH_BOT_USERNAME");
    checkEnvVar("TWITCH_BOT_PASSWORD");
}

export const config = {
    BOT_TO_USE: BOT_TO_USE ?? "discord",
    
    DISCORD_TOKEN: DISCORD_TOKEN ?? "",
    DISCORD_CLIENT_ID: DISCORD_CLIENT_ID ?? "",
    CHANNEL_ID: CHANNEL_ID ?? "",
    
    TWITCH_CHANNEL: TWITCH_CHANNEL ?? "",
    TWITCH_BOT_USERNAME: TWITCH_BOT_USERNAME ?? "",
    TWITCH_BOT_PASSWORD: TWITCH_BOT_PASSWORD ?? ""
};