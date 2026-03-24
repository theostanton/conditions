import {Storage} from '@google-cloud/storage';
import {PROJECT_ID} from "@config/envs";
import {Bulletin, BulletinInfos, BulletinMetadata} from "@app-types";
import {Database} from "@database/queries";
import {formatDateTime, formatError} from "@utils/formatters";
import {AsyncUtils} from "@utils/async";
import {Analytics} from "@analytics/Analytics";
import {MassifCache} from "@cache/MassifCache";
import {getProviderForRegion} from "@providers/registry";

export namespace BulletinService {

    export type NewBulletinsResult = {
        bulletinInfosToUpdate: BulletinInfos[]
        massifsNew: string[]
        failedMassifs: string[]
        massifsWithUpdate: string[]
        massifsWithNoUpdate: string[]
    }

    export async function fetchBulletinMetadata(massifCode: string): Promise<{
        validFrom: Date,
        validTo: Date,
        riskLevel?: number,
        metadata?: BulletinMetadata,
    } | undefined> {
        const provider = getProviderForRegion(massifCode);
        if (!provider) {
            console.error(`No provider found for region ${massifCode}`);
            return undefined;
        }
        const result = await provider.fetchBulletinMetadata(massifCode);
        if (!result) return undefined;

        // Collect enhanced metadata fields into a single object
        const metadata: BulletinMetadata = {};
        if (result.freezingLevel !== undefined) metadata.freezingLevel = result.freezingLevel;
        if (result.snowStability) metadata.snowStability = result.snowStability;
        if (result.snowQuality) metadata.snowQuality = result.snowQuality;
        if (result.windDescription) metadata.windDescription = result.windDescription;
        if (result.precipitationForecast) metadata.precipitationForecast = result.precipitationForecast;

        return {
            validFrom: result.validFrom,
            validTo: result.validTo,
            riskLevel: result.riskLevel,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        };
    }

    export async function checkForNewBulletins(massifsWithSubscribers: string[]): Promise<NewBulletinsResult> {
        console.log(`massifsWithSubscribers=${JSON.stringify(massifsWithSubscribers)}`);

        const latestStoredBulletins = await Database.getLatestStoredBulletins();
        console.log(`latestStoredBulletins=${JSON.stringify(latestStoredBulletins)}`);

        const bulletinInfosToUpdate: BulletinInfos[] = [];
        const massifsNew: string[] = []
        const massifsWithUpdate: string[] = []
        const massifsWithNoUpdate: string[] = []
        const failedMassifs: string[] = []

        // Fetch bulletin metadata one at a time with 1s gaps to avoid socket hang ups
        const results = await AsyncUtils.batchSettled(
            massifsWithSubscribers,
            async (massif) => {
                console.log(`Checking for new bulletin for massif=${massif}`);
                const metadata = await fetchBulletinMetadata(massif);
                return {massif, metadata};
            },
            1,
            1000,
        );

        // Process results
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const massif = massifsWithSubscribers[i];

            if (result.status === 'rejected') {
                console.error(`Failed to fetch bulletin for massif=${massif}: ${formatError(result.reason)}`);
                failedMassifs.push(massif);
                continue;
            }

            const {metadata: bulletinMeta} = result.value;

            if (!bulletinMeta) {
                console.log(`No bulletin metadata available for massif=${massif}`);
                failedMassifs.push(massif);
            } else {
                const {validFrom, validTo, riskLevel, metadata: enrichedMetadata} = bulletinMeta;
                const storedBulletin = latestStoredBulletins.find(value => value.massif === massif);

                if (storedBulletin == undefined) {
                    console.log(`No existing bulletin for massif=${massif}`);
                    bulletinInfosToUpdate.push({
                        massif: massif,
                        valid_from: validFrom,
                        valid_to: validTo,
                        risk_level: riskLevel,
                        metadata: enrichedMetadata,
                    });
                    massifsNew.push(massif);
                } else if (validFrom > storedBulletin.valid_from) {
                    console.log(`New bulletin for massif=${massif} ${validFrom} > ${storedBulletin.valid_from}`);
                    bulletinInfosToUpdate.push({
                        massif: massif,
                        valid_from: validFrom,
                        valid_to: validTo,
                        risk_level: riskLevel,
                        metadata: enrichedMetadata,
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

    async function fetchBulletin(massif: string, filename: string): Promise<string | null> {
        const provider = getProviderForRegion(massif);
        if (!provider) {
            console.error(`No provider found for region ${massif}`);
            return null;
        }
        return provider.fetchBulletin(massif, filename);
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
            return `/tmp/${massifName} ${toDateString} ${bulletin.risk_level}-5.pdf`;
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
                const massifName = massifNames.find(value => value.code === bulletin.massif)?.name
                if (!massifName) {
                    throw new Error(`Massif name not found for code ${bulletin.massif}`);
                }

                const filename = await generateFilename(bulletin, massifName);

                // Fetch PDF via provider
                const fetchResult = await fetchBulletin(bulletin.massif, filename);
                console.log(`fetchResult=${fetchResult}`);
                if (fetchResult == null) {
                    throw new Error(`Failed to fetch bulletin for massif=${bulletin.massif}`);
                }

                // Store PDF in GCS
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
        const failedBulletins: Array<{ massif: string; error: any }> = [];
        const dbInserts: Array<{
            massif: string;
            filename: string;
            publicUrl: string;
            validFrom: Date;
            validTo: Date;
            riskLevel?: number;
            metadata?: BulletinMetadata;
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
                    riskLevel: bulletin.risk_level,
                    metadata: bulletin.metadata,
                });
            } else {
                console.error(`Failed to process bulletin for massif ${bulletin.massif}: ${formatError(result.reason)}`);
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
