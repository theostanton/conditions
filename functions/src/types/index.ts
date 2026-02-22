export type Bulletin = {
    massif: number,
    filename: string,
    public_url: string,
    valid_from: Date,
    valid_to: Date,
    risk_level?: number,
}

export type GeoJSONGeometry =
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };

export type Massif = {
    name: string,
    code: number,
    mountain?: string,
    geometry?: GeoJSONGeometry,
}

export type BulletinInfos = Pick<Bulletin, "massif" | "valid_from" | "valid_to" | "risk_level">

export type Platform = 'telegram' | 'whatsapp';

export type BulletinDestination = {
    recipients: string[],
    massif: number,
    filename: string,
    public_url: string,
    valid_from: Date,
    valid_to: Date,
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
}

export type Subscription = {
    recipient: string,
    massif: number,
    platform: Platform,
} & ContentTypes
