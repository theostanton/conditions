import { Bot } from "grammy";
import { TELEGRAM_BOT_TOKEN } from "./envs";
import { setupMessageLogging } from "@bot/middleware/messageLogger";

export const bot: Bot = new Bot(TELEGRAM_BOT_TOKEN);

// Setup message logging for cron job messages
setupMessageLogging(bot);
