import { config } from "dotenv";

config();

const REQUIRED_VARS = [
    'GOOGLE_PROJECT_ID',
    'TELEGRAM_BOT_TOKEN',
    'ANALYTICS_BOT_TOKEN',
    'METEOFRANCE_TOKEN',
    'ADMIN_CHAT_ID',
    'PGHOST',
    'PGDATABASE',
    'PGUSER',
    'PGPASSWORD',
    'WA_PHONE_NUMBER_ID',
    'WA_ACCESS_TOKEN',
    'WA_VERIFY_TOKEN',
    'GOOGLE_MAPS_API_KEY',
    'ANTHROPIC_API_KEY',
] as const;

const missing = REQUIRED_VARS.filter(k => !process.env[k]);
if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

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

export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY as string;