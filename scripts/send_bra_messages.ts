import {BraSubscription, MassifRow} from "./types";
import database from "./database";
import {Client} from "ts-postgres";

async function getBraSubscriptions(client: Client): Promise<BraSubscription[]> {

  const result = await client.query("select massif,array_agg(recipient) from subscriptions_bras group by massif order by massif")

  const subscriptions: BraSubscription[] = []

  result.rows.forEach((row) => {
    subscriptions.push({massifCode: row[0], numbers: row[1]})
  })

  return subscriptions
}

interface BraRow {
  massifCode: number
  publicUrl: string
  filename: string
  date: string
}

async function getBras(client: Client, subscriptions: BraSubscription[], date: string): Promise<BraRow[]> {

  const massifs = subscriptions.reduce((acc, subscription) => acc.add(subscription.massifCode), new Set<number>())

  const result = await client.query('SELECT massif,filename,public_url from bras WHERE massif = ANY($1) AND date = $2', [massifs, date])

  return result.rows.map<BraRow>((row) => {
    return {
      date: date,
      massifCode: row[0],
      filename: row[1],
      publicUrl: row[2],
    }
  })
}

async function send(fileUrl: string, number: string): Promise<void> {

  const headers: HeadersInit = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', 'Bearer EAANme43LYk0BO6WKhMsOER215PwoLbFnJjlJ4ZBEc8ZAp10yyDbyUqnIIh2g0uvQw4eXbqLzRZAguObLO3stQO9vrZCsKXcPbe6LU0GZBLIDN4UIf0jEXfXBqPerFoNvCLdZB7HZBjNArPLSXSZBrbdHq4RQQaTugzIIeBtFsWGRn6GRcKRMrl56qGEpLIhdPe7k8h7LQv0YeVkeqZBDTlFgI7zWuJRtIrGFj5nsZD')

  const url = "https://graph.facebook.com/v22.0/551988608001807/messages"

  const body = {
    messaging_product: "whatsapp",
    to: number,
    recipient_type: "individual",
    text: {
      body: "Aravis BRA!"
    },
    type: "document",
    document: {
      link: fileUrl,
      caption: "Aravis",
      filename: "aravis.pdf"
    }
  }

  const response = await fetch(url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
  console.log(response)
}

async function main(): Promise<void> {

  const client = await database()
  const subscriptions = await getBraSubscriptions(client)


  await send("https://storage.googleapis.com/conditions-450312-bras/Aravis.pdf", "33771874257")

  await client.end()
}

main().then()
