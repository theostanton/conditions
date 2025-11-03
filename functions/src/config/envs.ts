import { AxiosHeaders } from "axios";
import { config } from "dotenv";

config();

export const PROJECT_ID = process.env.GOOGLE_PROJECT_ID as string;
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;
export const METEOFRANCE_TOKEN = process.env.METEOFRANCE_TOKEN as string;
export const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID as string;

export const PGHOST = process.env.PGHOST as string;
export const PGDATABASE = process.env.PGDATABASE as string;
export const PGUSER = process.env.PGUSER as string;
export const PGPASSWORD = process.env.PGPASSWORD as string;