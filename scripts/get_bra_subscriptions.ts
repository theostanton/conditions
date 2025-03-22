import database from "./database";
import {BraSubscription} from "./types";

async function getBraSubscriptions(): Promise<BraSubscription[]> {

  const client = await database()
  const result = await client.query("select recipient,array_agg(massif) from bra_subscriptions group by recipient")
  await client.end()

  const subscriptions: BraSubscription[] = []

  result.rows.forEach((row) => {
    subscriptions.push({number: row[0], massifCodes: row[1]})
  })

  return subscriptions
}

async function main(): Promise<void> {
  const subscriptions = await getBraSubscriptions()
  console.log(subscriptions)
}

main().then();
