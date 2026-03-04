export interface MassifRow {
  name: string
  code: string
  departement?: string
  mountain?: string
  geometry?: object
  provider?: string
  country?: string
}

export interface BraSubscription {
  massifCode: string
  numbers: string[]
}