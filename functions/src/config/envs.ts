import { AxiosHeaders } from "axios";
import { config } from "dotenv";

config();

export const PROJECT_ID = process.env.GOOGLE_PROJECT_ID as string;
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;
export const ANALYTICS_BOT_TOKEN = process.env.ANALYTICS_BOT_TOKEN as string;
export const METEOFRANCE_TOKEN = process.env.METEOFRANCE_TOKEN as string;
export const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID as string;

export const PGHOST = process.env.PGHOST as string;
export const PGDATABASE = process.env.PGDATABASE as string;
export const PGUSER = process.env.PGUSER as string;
export const PGPASSWORD = process.env.PGPASSWORD as string;

export const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID as string;
export const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN as string;
export const WA_VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN as string;

export const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY as string;