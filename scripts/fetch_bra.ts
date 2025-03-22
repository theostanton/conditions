import {Storage} from '@google-cloud/storage';
import {createWriteStream} from "fs";
import {Readable} from "stream";
import {headers} from "./meteo_api";
import {MassifRow} from "./types";
import database from "./database";
import {PROJECT_ID} from "./variables";
import {Client} from "ts-postgres";

async function selectMassifs(client:Client): Promise<MassifRow[]> {

  const result = await client.query("SELECT * FROM massifs LIMIT 1");
  console.log(result);

  const rows: MassifRow[] = []
  result.rows.forEach(row => {
    if (row[0] && row[1]) {
      rows.push({name: row[0], code: row[1]})
    }
  })
  return rows
}

async function downloadBra(idMassif: number, filename: string): Promise<string | null> {

  const resp = await fetch(`https://public-api.meteofrance.fr/public/DPBRA/v1/massif/BRA?id-massif=${idMassif}&format=pdf`, {headers});
  if (resp.ok && resp.body) {
    console.log("Writing to file:", filename);
    let writer = createWriteStream(filename);
    // @ts-ignore
    Readable.fromWeb(resp.body).pipe(writer);
    console.log("Saved")
    return filename;
  } else {
    console.log("Failed")
    return null;
  }
}

async function upload(filename: string): Promise<string> {
  const storage = new Storage({
    projectId: PROJECT_ID,
  });
  const response = await storage
    .bucket(`${PROJECT_ID}-bras`)
    .upload(filename,
      {public: true}
    )
  return response[0].publicUrl()
}


async function insertRow(client: Client, massifCode: number, filename: string, publicUrl: string): Promise<void> {
  await client.query("INSERT INTO bras(massif, date, filename, public_url) VALUES ($1, $2, $3, $4)", [massifCode, "2025-02-0", filename, publicUrl]);
}


async function main(): Promise<void> {
  console.log(`Start`)
  const client = await database()
  console.log('Connected')
  const massifs = await selectMassifs(client)
  console.log(`Got ${massifs.length} massifs`)
  for (const massif of massifs) {
    const filename = `./bras/${massif.name}.pdf`

    console.log(`${massif.name}: Downloading`);
    await downloadBra(massif.code, filename);

    console.log(`${massif.name}: Uploading`);
    const publicUrl = await upload(filename)

    console.log(`${massif.name}: Inserting BRA`);
    await insertRow(client, massif.code, filename, publicUrl)

    console.log(`${massif.name}: Done - ${publicUrl}`);
    console.log(publicUrl)
  }
  console.log("Done")
  await client.end()
}

main().then()
