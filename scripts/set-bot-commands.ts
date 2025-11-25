import {config} from "dotenv";

config()

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
    console.error('Error: TELEGRAM_BOT_TOKEN environment variable is required');
    process.exit(1);
}

async function setCommands() {
    console.log('Setting bot commands...');

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            commands: [
                {command: 'subscriptions', description: 'Subscribe to conditions'},
                {command: 'get', description: 'Download the current conditions'},
            ]
        })
    });

    const result = await response.json();

    if (result.ok) {
        console.log('✓ Bot commands set successfully');
    } else {
        console.error('Failed to set bot commands:', result);
        process.exit(1);
    }
}

setCommands().catch(error => {
    console.error('Failed to set bot commands:', error);
    process.exit(1);
});
