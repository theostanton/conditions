import { setupDatabase } from "./database/client";
import { checkForNewBulletins, fetchAndStoreBulletins } from "./services/bulletinService";
import { generateSubscriptionDestinations, send } from "./services/notificationService";

async function main() {
    await setupDatabase();

    // Check Bulletin difference
    const newBulletinsToFetch = await checkForNewBulletins();
    console.log(`newBulletinsToFetch=${JSON.stringify(newBulletinsToFetch)}`);
    console.log();

    // Fetch + Store new Bulletins
    const newBulletins = await fetchAndStoreBulletins(newBulletinsToFetch);
    console.log(`newBulletins=${JSON.stringify(newBulletins)}`);

    // Check subscription difference
    const destinations = await generateSubscriptionDestinations(newBulletins);
    console.log(`destinations=${JSON.stringify(destinations)}`);

    // Send to subscribers
    await send(destinations);
}

main().then();