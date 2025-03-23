import axios, {AxiosHeaders} from "axios";
import {config} from "dotenv";
import {Client, connect} from "ts-postgres";
import {createWriteStream} from "fs";
import {Readable} from "stream";
import {Storage} from '@google-cloud/storage';

config()

const PROJECT_ID = process.env.GOOGLE_PROJECT_ID as string;

export const headers: AxiosHeaders = new AxiosHeaders();
headers.set('Content-Type', 'application/xml');
headers.set('apikey', process.env.TOKEN as string);
console.log(headers)


let client: Client

async function setup() {
    client = await connect({
        host: process.env.PGHOST,
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
    })
}


type Bulletin = {
    massif: number,
    filename: string,
    public_url: string,
    valid_from: Date,
    valid_to: Date,
}

type BulletinInfos = Pick<Bulletin, "massif" | "valid_from" | "valid_to">

async function checkForNewBulletins(): Promise<BulletinInfos[]> {

    const massifsWithSubscribersResult = await client.query<Pick<BulletinInfos, "massif">>("select concat(massif) as massif from subscriptions_bras group by massif")
    const massifsWithSubscribers: number[] = [...massifsWithSubscribersResult].map(s => s.massif)

    console.log(`massifsWithSubscribers=${JSON.stringify(massifsWithSubscribers)}`)

    const latestStoredBulletinsResult = await client.query<BulletinInfos>("select massif, max(valid_from) as valid_from, max(valid_to) as valid_to from bras group by massif")
    const latestStoredBulletins = [...latestStoredBulletinsResult]

    console.log(`latestStoredBulletins=${JSON.stringify(latestStoredBulletins)}`)

    const bulletinInfosToUpdate: BulletinInfos[] = []
    for (const massif of massifsWithSubscribers) {
        console.log(`Checking for new bulletin for massif=${massif}`)

        const storedBulletin = latestStoredBulletins.find(b => b.massif == massif)
        const response = await axios.get(`https://public-api.meteofrance.fr/public/DPBRA/massif/BRA?id-massif=${massif}&format=xml`, {headers});

        const bulletinValidFrom = new Date(response.data.match(/DATEBULLETIN="(.[0-9-T:]*)"/)[1]);
        const bulletinValidUntil = new Date(response.data.match(/DATEVALIDITE="(.[0-9-T:]*)"/)[1]);

        if (storedBulletin == undefined) {
            console.log(`No existing bulletin for massif=${massif}`)
            bulletinInfosToUpdate.push({massif: massif, valid_from: bulletinValidFrom, valid_to: bulletinValidUntil})
        } else if (bulletinValidFrom > storedBulletin.valid_from) {
            console.log(`New bulletin for massif=${massif} ${bulletinValidFrom} > ${storedBulletin.valid_from}`)
            bulletinInfosToUpdate.push({massif: massif, valid_from: bulletinValidFrom, valid_to: bulletinValidUntil})
        } else {
            console.log(`No new bulletin for massif=${massif} ${bulletinValidFrom} <= ${storedBulletin.valid_from}`)
        }
    }


    return bulletinInfosToUpdate
}

async function fetchBulletin(massif: number, filename: string): Promise<string | null> {

    const resp = await fetch(`https://public-api.meteofrance.fr/public/DPBRA/v1/massif/BRA?id-massif=${massif}&format=pdf`, {headers});
    if (resp.ok && resp.body) {
        console.log("Writing to file:", filename);
        let writer = createWriteStream(filename);
        // @ts-ignore
        Readable.fromWeb(resp.body).pipe(writer);
        await new Promise<void>((resolve, reject) => {
            writer.on('finish', () => resolve())
            writer.on('error', reject)
        })
        console.log("Saved")
        return filename;
    } else {
        console.log("Failed")
        return null;
    }
}

async function storeBulletin(filename: string): Promise<string> {
    const storage = new Storage({
        projectId: PROJECT_ID,
    });
    const response = await storage
        .bucket(`${PROJECT_ID}-bras`)
        .upload(filename, {public: true})
    return response[0].publicUrl()
}

function formatDate(date: Date): string {
    return date.toLocaleDateString("en-GB", {
        weekday: "long",
        month: "long",
        day: "numeric"
    })
    // return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:00`
}

async function generateFilename(bulletin: BulletinInfos) {
    const nameResult = await client.query<{
        name: string
    }>("select name from massifs where code=$1", [bulletin.massif])
    const name = [...nameResult][0].name
    const toDateString = formatDate(bulletin.valid_to)
    const filename = `./dist/${name} ${toDateString}.pdf`
    return filename;
}

async function fetchAndStoreBulletins(newBulletinsToFetch: BulletinInfos[]) {

    for (const bulletin of newBulletinsToFetch) {

        // Generate Filename
        const filename = await generateFilename(bulletin);

        // Fetch PDF
        const fetchResult = await fetchBulletin(bulletin.massif, filename)
        console.log(`fetchResult=${fetchResult}`)
        if (fetchResult == null) {
            console.log(`Failed to fetch bulletin for massif=${bulletin.massif}`)
            break
        }

        // Store PDF
        const publicUrl = await storeBulletin(filename)
        console.log(`Stored at publicUrl=${publicUrl}`)

        // Write to database
        await client.query("insert into bras (massif, filename, public_url, valid_from, valid_to) values ($1, $2, $3, $4, $5)", [bulletin.massif, filename, publicUrl, bulletin.valid_from, bulletin.valid_to])
        console.log(`Inserted into database`)
        console.log()
    }

}

async function main() {

    await setup()

    // Check Bulletin difference
    const newBulletinsToFetch = await checkForNewBulletins()
    console.log(`newBulletinsToFetch=${JSON.stringify(newBulletinsToFetch)}`)
    console.log()

    // Fetch + Store new Bulletins
    await fetchAndStoreBulletins(newBulletinsToFetch)

    // Check subscription difference

    // Send to subscribers
}

main().then()