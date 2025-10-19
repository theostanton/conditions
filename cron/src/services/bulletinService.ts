import axios from "axios";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import { Storage } from '@google-cloud/storage';
import { meteoFranceHeaders, PROJECT_ID } from "../config";
import { Bulletin, BulletinInfos } from "../types";
import { Database } from "../database/queries";
import { formatDate } from "../utils/formatters";

export async function checkForNewBulletins(): Promise<BulletinInfos[]> {
    const massifsWithSubscribers = await Database.getMassifsWithSubscribers();
    console.log(`massifsWithSubscribers=${JSON.stringify(massifsWithSubscribers)}`);

    const latestStoredBulletins = await Database.getLatestStoredBulletins();
    console.log(`latestStoredBulletins=${JSON.stringify(latestStoredBulletins)}`);

    const bulletinInfosToUpdate: BulletinInfos[] = [];

    for (const massif of massifsWithSubscribers) {
        console.log(`Checking for new bulletin for massif=${massif}`);

        const storedBulletin = latestStoredBulletins.find(b => b.massif == massif);
        const response = await axios.get(
            `https://public-api.meteofrance.fr/public/DPBRA/massif/BRA?id-massif=${massif}&format=xml`,
            { headers: meteoFranceHeaders }
        );

        const bulletinValidFrom = new Date(response.data.match(/DATEBULLETIN="(.[0-9-T:]*)"/)[1]);
        const bulletinValidUntil = new Date(response.data.match(/DATEVALIDITE="(.[0-9-T:]*)"/)[1]);

        if (storedBulletin == undefined) {
            console.log(`No existing bulletin for massif=${massif}`);
            bulletinInfosToUpdate.push({
                massif: massif,
                valid_from: bulletinValidFrom,
                valid_to: bulletinValidUntil
            });
        } else if (bulletinValidFrom > storedBulletin.valid_from) {
            console.log(`New bulletin for massif=${massif} ${bulletinValidFrom} > ${storedBulletin.valid_from}`);
            bulletinInfosToUpdate.push({
                massif: massif,
                valid_from: bulletinValidFrom,
                valid_to: bulletinValidUntil
            });
        } else {
            console.log(`No new bulletin for massif=${massif} ${bulletinValidFrom} <= ${storedBulletin.valid_from}`);
        }
    }

    return bulletinInfosToUpdate;
}

async function fetchBulletin(massif: number, filename: string): Promise<string | null> {
    const resp = await fetch(
        `https://public-api.meteofrance.fr/public/DPBRA/v1/massif/BRA?id-massif=${massif}&format=pdf`,
        { headers: meteoFranceHeaders }
    );

    if (resp.ok && resp.body) {
        console.log("Writing to file:", filename);
        let writer = createWriteStream(filename);
        // @ts-ignore
        Readable.fromWeb(resp.body).pipe(writer);
        await new Promise<void>((resolve, reject) => {
            writer.on('finish', () => resolve());
            writer.on('error', reject);
        });
        console.log("Saved");
        return filename;
    } else {
        console.log("Failed");
        return null;
    }
}

async function storeBulletin(filename: string): Promise<string> {
    const storage = new Storage({
        projectId: PROJECT_ID,
    });
    const response = await storage
        .bucket(`${PROJECT_ID}-bras`)
        .upload(filename, { public: true });
    return response[0].publicUrl();
}

async function generateFilename(bulletin: BulletinInfos): Promise<string> {
    const name = await Database.getMassifName(bulletin.massif);
    const toDateString = formatDate(bulletin.valid_to);
    const filename = `./dist/${name} ${toDateString}.pdf`;
    return filename;
}

export async function fetchAndStoreBulletins(newBulletinsToFetch: BulletinInfos[]): Promise<Bulletin[]> {
    const bulletins: Bulletin[] = [];

    for (const bulletin of newBulletinsToFetch) {
        // Generate Filename
        const filename = await generateFilename(bulletin);

        // Fetch PDF
        const fetchResult = await fetchBulletin(bulletin.massif, filename);
        console.log(`fetchResult=${fetchResult}`);
        if (fetchResult == null) {
            console.log(`Failed to fetch bulletin for massif=${bulletin.massif}`);
            break;
        }

        // Store PDF
        const publicUrl = await storeBulletin(filename);
        console.log(`Stored at publicUrl=${publicUrl}`);

        // Write to database
        await Database.insertBulletin(bulletin.massif, filename, publicUrl, bulletin.valid_from, bulletin.valid_to);
        console.log();

        bulletins.push({ ...bulletin, filename, public_url: publicUrl });
    }

    return bulletins;
}
