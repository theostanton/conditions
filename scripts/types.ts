export interface MassifRow {
  name: string
  code: number
  departement?: string
  mountain?: string
}

export interface BraSubscription {
  massifCode: number
  numbers: string[]
}