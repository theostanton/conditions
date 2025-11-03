/**
 * One-time script to set Telegram bot commands
 * Run this after deployment to configure the bot menu
 *
 * Usage from project root:
 *   TELEGRAM_BOT_TOKEN=<token> node -e "
 *     fetch('https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN + '/setMyCommands', {
 *       method: 'POST',
 *       headers: {'Content-Type': 'application/json'},
 *       body: JSON.stringify({commands: [
 *         {command: 'get', description: 'Get the latest BERA'},
 *         {command: 'subscriptions', description: 'Manage your BERA subscriptions'}
 *       ]})
 *     }).then(r => r.json()).then(console.log)
 *   "
 *
 * Or use curl:
 *   curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands" \
 *     -H "Content-Type: application/json" \
 *     -d '{"commands":[{"command":"get","description":"Get the latest BERA"},{"command":"subscriptions","description":"Manage your BERA subscriptions"}]}'
 */

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
                {command: 'get', description: 'Get the latest BERA'},
                {command: 'subscriptions', description: 'Manage your BERA subscriptions'}
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
