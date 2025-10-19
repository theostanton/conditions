import { AxiosHeaders } from "axios";
import { config } from "dotenv";
import { Bot } from "grammy";

config();

export const PROJECT_ID = process.env.GOOGLE_PROJECT_ID as string;

export const meteoFranceHeaders: AxiosHeaders = new AxiosHeaders();
meteoFranceHeaders.set('Content-Type', 'application/xml');
meteoFranceHeaders.set('apikey', process.env.METEOFRANCE_TOKEN as string);

export const bot: Bot = new Bot(process.env.TELEGRAM_BOT_TOKEN as string);
