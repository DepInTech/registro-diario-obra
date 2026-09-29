/**
 * Utilitário de validação de leitura do hidrômetro.
 *
 * Regra obrigatória: A nova leitura do hidrômetro nunca poderá ser menor que a leitura anterior.
 *
 * Exemplo:
 * - Leitura anterior: 1.250 — Nova leitura: 1.280 -> Permitido
 * - Nova leitura: 1.250 -> Permitido, caso seja necessário repetir a leitura
 * - Nova leitura: 1.200 -> Não permitido
 *
 * Mensagem oficial:
 * "⚠️ Leitura inválida. O valor informado não pode ser menor que a leitura anterior deste hidrômetro."
 */

export const HYDROMETER_ERROR_MESSAGE =
  '⚠️ Leitura inválida. O valor informado não pode ser menor que a leitura anterior deste hidrômetro.'

/**
 * Converte valor de hidrômetro (string, number, etc.) para número decimal suportando formatos:
 * - PT-BR com milhar: "1.250,50" -> 1250.50
 * - PT-BR simples: "1250,5" -> 1250.5
 * - PT-BR inteiro com milhar: "1.250" -> 1250
 * - Padrão internacional: "1,250.50" -> 1250.50 ou "1250.5" -> 1250.5
 */
export function parseHydrometerValue(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  let s = String(val).trim()
  if (s === '') return null

  // Se contiver vírgula e ponto (ex: 1.250,5 ou 1,250.5)
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // PT-BR: 1.250,50 -> remove ponto de milhar e troca vírgula por ponto decimal
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // EN-US: 1,250.50 -> remove vírgula de milhar
      s = s.replace(/,/g, '')
    }
  } else if (s.includes(',')) {
    // Apenas vírgula: 1250,5 -> 1250.5
    s = s.replace(',', '.')
  } else if (s.includes('.')) {
    // Apenas ponto: pode ser milhar "1.250" ou decimal "1250.5"
    // Se o padrão for grupos de 3 dígitos após ponto (ex: 1.250 ou 12.345 ou 1.250.000)
    // No Brasil é muito comum o técnico digitar "1.250" significando mil e duzentos e cinquenta.
    const parts = s.split('.')
    if (parts.length > 2) {
      // Múltiplos pontos: ex 1.250.000
      s = s.replace(/\./g, '')
    } else if (parts.length === 2 && parts[1].length === 3) {
      // Exato 3 dígitos após o ponto: ex 1.250 -> 1250
      s = s.replace(/\./g, '')
    }
  }

  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

export function normalizeWellKey(well: unknown): string {
  return String(well || '')
    .trim()
    .toUpperCase()
}

export interface ExtractionRowLike {
  well?: string
  morning?: unknown
  afternoon?: unknown
  [key: string]: unknown
}

export interface SheetWithExtraction {
  id?: string
  projectId?: string
  date?: string
  lastModified?: number
  created?: string
  deleted?: boolean
  extraction_data?: ExtractionRowLike[] | string
}

export interface HydrometerValidationResult {
  valid: boolean
  message?: string
  failedWell?: string
  currentValue?: number
  previousValue?: number
}

/**
 * Validação completa de hidrômetro:
 * 1. Intra-ficha: se a leitura da tarde foi preenchida, não pode ser menor que a da manhã no mesmo poço.
 * 2. Inter-fichas: nem a leitura da manhã nem a da tarde podem ser menores que a leitura mais recente
 *    anteriormente registrada para o mesmo poço no mesmo projeto.
 * 3. Se igual: PERMITIDO (caso seja necessário repetir a leitura).
 */
export function validateHydrometerReadings(
  currentRows: ExtractionRowLike[] | undefined | null,
  previousSheets: SheetWithExtraction[] | undefined | null,
  currentSheetId?: string,
): HydrometerValidationResult {
  if (!currentRows || !Array.isArray(currentRows) || currentRows.length === 0) {
    return { valid: true }
  }

  // 1. Validação Intra-ficha: afternoon >= morning no mesmo poço
  for (const row of currentRows) {
    if (!row) continue
    const mVal = parseHydrometerValue(row.morning)
    const aVal = parseHydrometerValue(row.afternoon)

    if (mVal !== null && aVal !== null && aVal < mVal) {
      return {
        valid: false,
        message: HYDROMETER_ERROR_MESSAGE,
        failedWell: row.well,
        currentValue: aVal,
        previousValue: mVal,
      }
    }
  }

  // 2. Validação Inter-fichas
  if (!previousSheets || !Array.isArray(previousSheets) || previousSheets.length === 0) {
    return { valid: true }
  }

  // Mapeia o valor mais recente registrado para cada poço nas fichas anteriores
  const lastReadingsByWell: Record<string, number> = {}

  for (const sheet of previousSheets) {
    if (!sheet || sheet.deleted) continue
    if (currentSheetId && sheet.id === currentSheetId) continue

    let ext: ExtractionRowLike[] = []
    if (typeof sheet.extraction_data === 'string' && sheet.extraction_data.trim() !== '') {
      try {
        ext = JSON.parse(sheet.extraction_data)
      } catch {
        ext = []
      }
    } else if (Array.isArray(sheet.extraction_data)) {
      ext = sheet.extraction_data
    }

    if (!Array.isArray(ext)) continue

    for (const pRow of ext) {
      if (!pRow) continue
      const wKey = normalizeWellKey(pRow.well)
      if (!wKey) continue
      // Se já temos a leitura mais recente deste poço registrada, ignora fichas mais antigas
      if (lastReadingsByWell[wKey] !== undefined) continue

      const pA = parseHydrometerValue(pRow.afternoon)
      const pM = parseHydrometerValue(pRow.morning)
      const highestPast = pA !== null ? pA : pM !== null ? pM : null
      if (highestPast !== null) {
        lastReadingsByWell[wKey] = highestPast
      }
    }
  }

  // Compara os valores informados na ficha atual com a leitura anterior do poço
  for (const curRow of currentRows) {
    if (!curRow) continue
    const curKey = normalizeWellKey(curRow.well)
    if (!curKey) continue

    const baseline = lastReadingsByWell[curKey]
    if (baseline === undefined || baseline === null) continue

    const curM = parseHydrometerValue(curRow.morning)
    const curA = parseHydrometerValue(curRow.afternoon)

    if (curM !== null && curM < baseline) {
      return {
        valid: false,
        message: HYDROMETER_ERROR_MESSAGE,
        failedWell: curRow.well,
        currentValue: curM,
        previousValue: baseline,
      }
    }

    if (curA !== null && curA < baseline) {
      return {
        valid: false,
        message: HYDROMETER_ERROR_MESSAGE,
        failedWell: curRow.well,
        currentValue: curA,
        previousValue: baseline,
      }
    }
  }

  return { valid: true }
}
