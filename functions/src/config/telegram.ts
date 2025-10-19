import { Bot } from "grammy";
import { TELEGRAM_BOT_TOKEN } from "./index";

export const bot: Bot = new Bot(TELEGRAM_BOT_TOKEN);
