import dotenv from "dotenv";

dotenv.config();

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, CHANNEL_ID } = process.env;

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

checkEnvVar("DISCORD_TOKEN");
checkEnvVar("DISCORD_CLIENT_ID");
checkEnvVar("CHANNEL_ID");

export const config = {
    DISCORD_TOKEN: DISCORD_TOKEN as string,
    DISCORD_CLIENT_ID: DISCORD_CLIENT_ID as string,
    CHANNEL_ID: CHANNEL_ID as string
};