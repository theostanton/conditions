import database from "./database";

async function addSubscription(recipientNumber: string, massifCode: number) {
  const client = await database()
  await client.query("INSERT INTO bra_subscriptions(recipient, massif) VALUES ($1, $2)", [recipientNumber, massifCode])
  await client.end()
}

async function main(): Promise<void> {
  await addSubscription("33771874257", 5)
}

main().then();
