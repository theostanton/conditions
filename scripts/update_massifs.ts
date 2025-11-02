import format from "pg-format";
import database from "./database";
import {MassifRow} from "./types";
import {headers} from "./meteo_api";

interface MassifsResponse {
  features: Massif[]
}

interface Massif {
  properties: MassifProperties
}

interface MassifProperties {
  title: string
  code: number
}


async function fetchRegions(): Promise<MassifRow[]> {
  const response = await fetch(
    "https://public-api.meteofrance.fr/public/DPBRA/v1/liste-massifs",
    {headers: headers}
  )

  const data: MassifsResponse = await response.json();

  return data.features.map<MassifRow>(feature => ({
    code: feature.properties.code,
    name: feature.properties.title
  }))
}

async function insert(massifs: MassifRow[]): Promise<void> {

  const client = await database()

  const values: [string, number][] = massifs.map(massif => [massif.name, massif.code])

  try {
    await client.query(format('INSERT INTO massifs (name,code) VALUES %L', values))
  } catch (err) {
    console.log(err)
  }
  await client.end()
}

async function main(): Promise<void> {
  const massifs = await fetchRegions()
  await insert(massifs)
  console.log('2')
}

main().then()
