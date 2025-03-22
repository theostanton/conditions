import format from "pg-format";
import database from "./database";
import {MassifRow} from "./types";

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

  const headers: HeadersInit = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('apikey', 'eyJ4NXQiOiJZV0kxTTJZNE1qWTNOemsyTkRZeU5XTTRPV014TXpjek1UVmhNbU14T1RSa09ETXlOVEE0Tnc9PSIsImtpZCI6ImdhdGV3YXlfY2VydGlmaWNhdGVfYWxpYXMiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0aGVvc3RhbnRvbkBjYXJib24uc3VwZXIiLCJhcHBsaWNhdGlvbiI6eyJvd25lciI6InRoZW9zdGFudG9uIiwidGllclF1b3RhVHlwZSI6bnVsbCwidGllciI6IlVubGltaXRlZCIsIm5hbWUiOiJEZWZhdWx0QXBwbGljYXRpb24iLCJpZCI6MjM5NTksInV1aWQiOiJjNzY2ZTQ2Ny1kMWRmLTQ4NTYtYWNkYS1mYWY3NzFjMWU5ZjcifSwiaXNzIjoiaHR0cHM6XC9cL3BvcnRhaWwtYXBpLm1ldGVvZnJhbmNlLmZyOjQ0M1wvb2F1dGgyXC90b2tlbiIsInRpZXJJbmZvIjp7IjUwUGVyTWluIjp7InRpZXJRdW90YVR5cGUiOiJyZXF1ZXN0Q291bnQiLCJncmFwaFFMTWF4Q29tcGxleGl0eSI6MCwiZ3JhcGhRTE1heERlcHRoIjowLCJzdG9wT25RdW90YVJlYWNoIjp0cnVlLCJzcGlrZUFycmVzdExpbWl0IjowLCJzcGlrZUFycmVzdFVuaXQiOiJzZWMifX0sImtleXR5cGUiOiJQUk9EVUNUSU9OIiwic3Vic2NyaWJlZEFQSXMiOlt7InN1YnNjcmliZXJUZW5hbnREb21haW4iOiJjYXJib24uc3VwZXIiLCJuYW1lIjoiRG9ubmVlc1B1YmxpcXVlc0JSQSIsImNvbnRleHQiOiJcL3B1YmxpY1wvRFBCUkFcL3YxIiwicHVibGlzaGVyIjoiYmFzdGllbmciLCJ2ZXJzaW9uIjoidjEiLCJzdWJzY3JpcHRpb25UaWVyIjoiNTBQZXJNaW4ifV0sImV4cCI6MTgzNDM4MTY3MiwidG9rZW5fdHlwZSI6ImFwaUtleSIsImlhdCI6MTczOTcwODg3MiwianRpIjoiYTdmNzdjYzEtN2ZkZi00MzY4LWEyMDItZjNiMzgxZjFmMDIyIn0=.njrwFB5JhfWAnD_e2pfxbNuQGiTZEsBnHpotR9QTkIaAQl1WTGTEmndXRhwsvG9ForSzi--61k48ap1QJChbDh0GFkkTMi8l5d99suLazxntw00eM7vmYxoYzeitJCc3naX7dW0KbuIN0tFdm8nxyV3FceKE3G-jNBBQ7lXjPC7aoQrIhZXusF0IpyPvAESB2dplY-bgl11HrkDDbA71n6R6qMIZDShcC9S_AnTMx17PBR3UE5kxszueA_Ua4rbDqPoLIZmxeoh-xs4chSSJlqjf2tLws6yyEr4QrHgNAKf5gNYyVdkgJbumc_K33J82zcpM5At7gi1uU87CBzqxHQ==');

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
