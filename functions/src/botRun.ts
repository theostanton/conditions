import { setupDatabase } from "@config/database";
import { createBot } from "@bot/index";

async function main() {
    console.log('Setting up database');
    await setupDatabase();

    const bot = await createBot();

    console.log("Starting bot");
    await bot.start();
}

main().then();
