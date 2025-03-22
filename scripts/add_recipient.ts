import database from "./database";

async function addRecipient(recipientNumber: string) {
  const client = await database()
  await client.query("INSERT INTO recipients(number) VALUES ($1)", [recipientNumber])
  await client.end()
}

async function main(): Promise<void> {
  await addRecipient("33771874257")
}

main().then();
