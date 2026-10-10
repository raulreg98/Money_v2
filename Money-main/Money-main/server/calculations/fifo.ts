export interface FifoLot {
  units: number;
  costPerUnit: number;
  date: string;
}

export interface FifoResult {
  remainingUnits: number;
  totalCost: number;
  realizedGain: number;
  averageCost: number;
  lots: FifoLot[];
}

export function computeFifo(
  movements: { type: string; date: string; units: number; amount_eur: number }[],
): FifoResult {
  const lots: FifoLot[] = [];
  let realizedGain = 0;

  const sorted = [...movements].sort((a, b) => a.date.localeCompare(b.date));

  for (const m of sorted) {
    if (m.type === 'compra' || m.type === 'saldo') {
      if (m.units && m.units > 0) {
        lots.push({
          units: m.units,
          costPerUnit: m.amount_eur / m.units,
          date: m.date,
        });
      }
    } else if (m.type === 'venta') {
      if (!m.units || m.units <= 0) continue;
      let unitsToSell = m.units;
      const proceeds = m.amount_eur;

      while (unitsToSell > 0 && lots.length > 0) {
        const lot = lots[0];
        const sellFromLot = Math.min(unitsToSell, lot.units);
        const costBasis = sellFromLot * lot.costPerUnit;
        const saleProceeds = (sellFromLot / m.units) * proceeds;
        realizedGain += saleProceeds - costBasis;
        lot.units -= sellFromLot;
        unitsToSell -= sellFromLot;
        if (lot.units <= 0.000001) lots.shift();
      }
    }
  }

  const remainingUnits = lots.reduce((s, l) => s + l.units, 0);
  const totalCost = lots.reduce((s, l) => s + l.units * l.costPerUnit, 0);
  const averageCost = remainingUnits > 0 ? totalCost / remainingUnits : 0;

  return { remainingUnits, totalCost, realizedGain, averageCost, lots };
}
