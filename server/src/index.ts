import { Client } from "discord.js";
import { config } from "./config";

const client = new Client({
  intents: ["Guilds", "GuildMessages", "DirectMessages"],
});

client.once("ready", () => {
  console.log("Ready!");
});

client.login(config.DISCORD_TOKEN);