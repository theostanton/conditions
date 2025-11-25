import axios, {AxiosHeaders} from "axios";
import {createWriteStream} from "fs";
import {Readable} from "stream";
import {Storage} from '@google-cloud/storage';
import {PROJECT_ID, METEOFRANCE_TOKEN} from "@config/envs";
import {Bulletin, BulletinInfos} from "@app-types";
import {Database} from "@database/queries";
import {formatDateTime} from "@utils/formatters";
import {Analytics} from "@analytics/Analytics";
import {MassifCache} from "@cache/MassifCache";

const meteoFranceHeaders: AxiosHeaders = new AxiosHeaders();
meteoFranceHeaders.set('Content-Type', 'application/xml');
meteoFranceHeaders.set('apikey', METEOFRANCE_TOKEN);

export namespace BulletinService {

    export type NewBulletinsResult = {
        bulletinInfosToUpdate: BulletinInfos[]
        massifsNew: number[]
        failedMassifs: number[]
        massifsWithUpdate: number[]
        massifsWithNoUpdate: number[]
    }

    export async function fetchBulletinMetadata(massifCode: number): Promise<{
        validFrom: Date,
        validTo: Date,
        riskLevel?: number
    } | undefined> {
        try {
            const response = await axios.get(
                `https://public-api.meteofrance.fr/public/DPBRA/v1/massif/BRA?id-massif=${massifCode}&format=xml`,
                {headers: meteoFranceHeaders, timeout: 10000}
            );

            const matchFrom = response.data.match(/DATEBULLETIN="(.[0-9-T:]*)"/);
            const matchUntil = response.data.match(/DATEVALIDITE="(.[0-9-T:]*)"/);

            if (matchFrom == null || matchUntil == null) {
                return undefined;
            }

            // Extract RISQUEMAXI from the XML
            const matchRiskLevel = response.data.match(/RISQUEMAXI="(\d+)"/);
            const riskLevel = matchRiskLevel ? parseInt(matchRiskLevel[1], 10) : undefined;

            return {
                validFrom: new Date(matchFrom[1]),
                validTo: new Date(matchUntil[1]),
                riskLevel
            };
        } catch (error) {
            const massifName = MassifCache.findByCode(massifCode)?.name || `massif ${massifCode}`;
            console.error(`Failed to fetch bulletin metadata for ${massifName}:`, error);

            // Report to admin
            await Analytics.sendError(
                error as Error,
                `bulletinService.fetchBulletinMetadata: ${massifName}`
            ).catch(err => console.error('Failed to send error analytics:', err));

            throw error;
        }
    }

    export async function checkForNewBulletins(): Promise<NewBulletinsResult> {
        const massifsWithSubscribers = await Database.getMassifsWithSubscribers();
        console.log(`massifsWithSubscribers=${JSON.stringify(massifsWithSubscribers)}`);

        const latestStoredBulletins = await Database.getLatestStoredBulletins();
        console.log(`latestStoredBulletins=${JSON.stringify(latestStoredBulletins)}`);

        const bulletinInfosToUpdate: BulletinInfos[] = [];
        const massifsNew: number[] = []
        const massifsWithUpdate: number[] = []
        const massifsWithNoUpdate: number[] = []
        const failedMassifs: number[] = []

        // Fetch all bulletin metadata in parallel
        const results = await Promise.allSettled(
            massifsWithSubscribers.map(async (massif) => {
                console.log(`Checking for new bulletin for massif=${massif}`);
                const metadata = await fetchBulletinMetadata(massif);
                return {massif, metadata};
            })
        );

        // Process results
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const massif = massifsWithSubscribers[i];

            if (result.status === 'rejected') {
                console.error(`Failed to fetch bulletin for massif=${massif}:`, result.reason);
                failedMassifs.push(massif);
                continue;
            }

            const {metadata} = result.value;

            if (!metadata) {
                console.log(`No bulletin metadata available for massif=${massif}`);
                failedMassifs.push(massif);
            } else {
                const {validFrom, validTo, riskLevel} = metadata;
                const storedBulletin = latestStoredBulletins.find(value => value.massif == massif);

                if (storedBulletin == undefined) {
                    console.log(`No existing bulletin for massif=${massif}`);
                    bulletinInfosToUpdate.push({
                        massif: massif,
                        valid_from: validFrom,
                        valid_to: validTo,
                        risk_level: riskLevel
                    });
                    massifsNew.push(massif);
                } else if (validFrom > storedBulletin.valid_from) {
                    console.log(`New bulletin for massif=${massif} ${validFrom} > ${storedBulletin.valid_from}`);
                    bulletinInfosToUpdate.push({
                        massif: massif,
                        valid_from: validFrom,
                        valid_to: validTo,
                        risk_level: riskLevel
                    });
                    massifsWithUpdate.push(massif);
                } else {
                    console.log(`No new bulletin for massif=${massif} ${validFrom} <= ${storedBulletin.valid_from}`);
                    massifsWithNoUpdate.push(massif);
                }
            }
        }

        // Report failed massifs to admin
        if (failedMassifs.length > 0) {
            const failedMassifsList = failedMassifs
                .map(code => MassifCache.findByCode(code)?.name || `massif ${code}`)
                .join(', ');
            const summary = `${failedMassifs.length}/${massifsWithSubscribers.length} massif(s) failed metadata check: ${failedMassifsList}`;

            await Analytics.send(
                `🚨 Bulletin metadata check failures\n\n${summary}`
            ).catch(err => console.error('Failed to send analytics:', err));
        }

        return {bulletinInfosToUpdate, massifsNew, failedMassifs, massifsWithUpdate, massifsWithNoUpdate}
    }

    async function fetchBulletin(massif: number, filename: string): Promise<string | null> {
        const resp = await fetch(
            `https://public-api.meteofrance.fr/public/DPBRA/v1/massif/BRA?id-massif=${massif}&format=pdf`,
            {headers: meteoFranceHeaders}
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
            .upload(filename, {public: true});
        return response[0].publicUrl();
    }

    async function generateFilename(bulletin: BulletinInfos, massifName: string): Promise<string> {
        const toDateString = formatDateTime(bulletin.valid_from);

       if (bulletin.risk_level) {
            return `/tmp/${massifName} ${toDateString} ${bulletin.risk_level} ⁄ 5.pdf`;
        } else {
            return `/tmp/${massifName} ${toDateString}.pdf`;
        }
    }

    export async function fetchAndStoreBulletins(newBulletinsToFetch: BulletinInfos[]): Promise<Bulletin[]> {
        if (newBulletinsToFetch.length === 0) {
            return [];
        }

        // Fetch all massif names in one batch
        const massifCodes = newBulletinsToFetch.map(b => b.massif);
        console.log(`fetchAndStoreBulletins() massifCodes=${massifCodes}`);
        const massifNames = await Database.getMassifNames(massifCodes);
        console.log(`fetchAndStoreBulletins() massifNames=${JSON.stringify(massifNames)}`);

        // Process all bulletins in parallel
        const results = await Promise.allSettled(
            newBulletinsToFetch.map(async (bulletin) => {
                const massifName = massifNames.find(value => value.code == bulletin.massif)?.name
                if (!massifName) {
                    throw new Error(`Massif name not found for code ${bulletin.massif}`);
                }

                const filename = await generateFilename(bulletin, massifName);

                // Fetch PDF
                const fetchResult = await fetchBulletin(bulletin.massif, filename);
                console.log(`fetchResult=${fetchResult}`);
                if (fetchResult == null) {
                    throw new Error(`Failed to fetch bulletin for massif=${bulletin.massif}`);
                }

                // Store PDF
                const publicUrl = await storeBulletin(filename);
                console.log(`Stored at publicUrl=${publicUrl}`);

                return {
                    bulletin,
                    filename,
                    publicUrl
                };
            })
        );

        // Collect successful bulletins and track failures
        const successfulBulletins: Bulletin[] = [];
        const failedBulletins: Array<{ massif: number; error: any }> = [];
        const dbInserts: Array<{
            massif: number;
            filename: string;
            publicUrl: string;
            validFrom: Date;
            validTo: Date;
            riskLevel?: number;
        }> = [];

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const bulletin = newBulletinsToFetch[i];

            if (result.status === 'fulfilled') {
                const {bulletin, filename, publicUrl} = result.value;
                successfulBulletins.push({...bulletin, filename, public_url: publicUrl});
                dbInserts.push({
                    massif: bulletin.massif,
                    filename,
                    publicUrl,
                    validFrom: bulletin.valid_from,
                    validTo: bulletin.valid_to,
                    riskLevel: bulletin.risk_level
                });
            } else {
                console.error(`Failed to process bulletin for massif ${bulletin.massif}:`, result.reason);
                failedBulletins.push({massif: bulletin.massif, error: result.reason});
            }
        }

        // Report failures to admin
        if (failedBulletins.length > 0) {
            const failedMassifsList = failedBulletins
                .map(f => MassifCache.findByCode(f.massif)?.name || `massif ${f.massif}`)
                .join(', ');
            const summary = `${failedBulletins.length}/${newBulletinsToFetch.length} bulletin(s) failed to fetch/store: ${failedMassifsList}`;

            await Analytics.send(
                `🚨 Bulletin processing failures\n\n${summary}`
            ).catch(err => console.error('Failed to send analytics:', err));
        }

        // Batch insert all bulletins into database
        if (dbInserts.length > 0) {
            await Database.insertBulletins(dbInserts);
            console.log(`Inserted ${dbInserts.length} bulletins into database`);
        }

        return successfulBulletins;
    }
}
