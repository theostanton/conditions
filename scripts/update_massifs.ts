import 'dotenv/config';
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
  Departement?: string
  mountain?: string
}


async function fetchRegions(): Promise<MassifRow[]> {
  const response = await fetch(
    "https://public-api.meteofrance.fr/public/DPBRA/v1/liste-massifs",
    {headers: headers}
  )

  const data: MassifsResponse = await response.json();

  return data.features.map<MassifRow>(feature => ({
    code: feature.properties.code,
    name: feature.properties.title,
    departement: feature.properties.Departement,
    mountain: feature.properties.mountain
  }))
}

async function insert(massifs: MassifRow[]): Promise<void> {

  const client = await database()

  const values: [number, string, string | undefined, string | undefined][] = massifs.map(massif => [
    massif.code,
    massif.name,
    massif.departement,
    massif.mountain
  ])

  try {
    await client.query(format(
      'INSERT INTO massifs (code, name, departement, mountain) VALUES %L ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, departement = EXCLUDED.departement, mountain = EXCLUDED.mountain',
      values
    ))
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
