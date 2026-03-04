import type {ContentTypes} from "@app-types";

export type DeliveryMode = 'pdf' | 'summary';

export interface BulletinMetadata {
    validFrom: Date;
    validTo: Date;
    riskLevel?: number;
    summaryText?: string;
}

export interface FetchedBulletin {
    filepath: string;
    publicUrl: string;
}

export interface BulletinProvider {
    readonly id: string;
    readonly deliveryMode: DeliveryMode;

    /** Fetch metadata (validity dates, danger rating) for a region. */
    fetchBulletinMetadata(regionCode: string): Promise<BulletinMetadata | undefined>;

    /**
     * Download the bulletin file (PDF) and return its local path.
     * Only called for `deliveryMode: 'pdf'` providers.
     */
    fetchBulletin(regionCode: string, filename: string): Promise<string | null>;

    /** Content types available for this provider (controls UI toggles). */
    getAvailableContentTypes(): Array<keyof ContentTypes>;
}
