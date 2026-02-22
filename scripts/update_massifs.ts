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
  geometry?: object
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

  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${await response.text()}`);
  }

  const data: MassifsResponse = await response.json();

  if (!data.features) {
    console.error('API response structure:', JSON.stringify(data).substring(0, 500));
    throw new Error('No features in API response');
  }

  const massifs = data.features.map<MassifRow>(feature => ({
    code: feature.properties.code,
    name: feature.properties.title,
    departement: feature.properties.Departement,
    mountain: feature.properties.mountain,
    geometry: feature.geometry,
  }));

  const withoutGeometry = massifs.filter(m => !m.geometry);
  if (withoutGeometry.length > 0) {
    console.warn(`${withoutGeometry.length} massifs have no geometry:`, withoutGeometry.map(m => m.name).join(', '));
  }

  return massifs;
}

async function insert(massifs: MassifRow[]): Promise<void> {

  const client = await database()

  const values = massifs.map(massif => [
    massif.code,
    massif.name,
    massif.departement,
    massif.mountain,
    massif.geometry ? JSON.stringify(massif.geometry) : null,
  ])

  try {
    await client.query(format(
      'INSERT INTO massifs (code, name, departement, mountain, geometry) VALUES %L ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, departement = EXCLUDED.departement, mountain = EXCLUDED.mountain, geometry = EXCLUDED.geometry::jsonb',
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
