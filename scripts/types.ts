export interface MassifRow {
  name: string
  code: number
  departement?: string
  mountain?: string
  geometry?: object
}

export interface BraSubscription {
  massifCode: number
  numbers: string[]
}