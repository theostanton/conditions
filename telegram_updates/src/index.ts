import { config } from "dotenv";
import { createBot } from './bot';

config();

async function main() {
    const bot = await createBot();

    console.log("Starting bot");
    await bot.start();
}

main().then();
