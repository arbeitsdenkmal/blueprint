export type BereichId = 'erfassung' | 'abrechnung' | 'stammdaten' | 'einstellungen'

export interface Bereich {
  id: BereichId
  titel: string
}

export const bereiche: readonly Bereich[] = [
  { id: 'erfassung', titel: 'Erfassung' },
  { id: 'abrechnung', titel: 'Abrechnung' },
  { id: 'stammdaten', titel: 'Stammdaten' },
  { id: 'einstellungen', titel: 'Einstellungen' }
]
