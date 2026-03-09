export type BulletinMetadata = {
    freezingLevel?: number,
    snowStability?: string,
    snowQuality?: string,
    windDescription?: string,
    precipitationForecast?: string,
}

export type Bulletin = {
    massif: string,
    filename: string,
    public_url: string,
    valid_from: Date,
    valid_to: Date,
    risk_level?: number,
    summary_text?: string,
    metadata?: BulletinMetadata,
}

export type GeoJSONGeometry =
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };

export type Massif = {
    name: string,
    code: string,
    mountain?: string,
    geometry?: GeoJSONGeometry,
    provider?: string,
    country?: string,
}

export type BulletinInfos = Pick<Bulletin, "massif" | "valid_from" | "valid_to" | "risk_level" | "metadata">

export type Platform = 'telegram' | 'whatsapp';

export type BulletinDestination = {
    recipients: string[],
    massif: string,
    filename: string,
    public_url: string,
    valid_from: Date,
    valid_to: Date,
    risk_level?: number,
    subscriptions: Subscription[],
}

export type ContentTypes = {
    bulletin: boolean,
    weather: boolean,
    snow_report: boolean,
    fresh_snow: boolean,
    last_7_days: boolean,
    rose_pentes: boolean,
    montagne_risques: boolean,
    conditions_report: boolean,
}

export type Subscription = {
    recipient: string,
    massif: string,
    platform: Platform,
} & ContentTypes
