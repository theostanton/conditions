export type Bulletin = {
    massif: number,
    filename: string,
    public_url: string,
    valid_from: Date,
    valid_to: Date,
    risk_level?: number,
}

export type Massif = {
    name: string,
    code: number,
    mountain?: string
}

export type BulletinInfos = Pick<Bulletin, "massif" | "valid_from" | "valid_to" | "risk_level">

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
    snow_report: boolean,
    fresh_snow: boolean,
    weather: boolean,
    last_7_days: boolean,
}

export type Subscription = {
    recipient: number,
    massif: number,
} & ContentTypes
