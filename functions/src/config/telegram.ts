import { Bot } from "grammy";
import { TELEGRAM_BOT_TOKEN } from "./envs";

export const bot: Bot = new Bot(TELEGRAM_BOT_TOKEN);
