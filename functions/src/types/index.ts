export type Bulletin = {
    massif: number,
    filename: string,
    public_url: string,
    valid_from: Date,
    valid_to: Date,
}

export type Massif = {
    name: string,
    code: number,
    mountain?: string
}

export type BulletinInfos = Pick<Bulletin, "massif" | "valid_from" | "valid_to">

export type BulletinDestination = {
    recipients: string[],
    massif: number,
    filename: string,
    public_url: string,
    valid_from: Date,
    valid_to: Date,
}
