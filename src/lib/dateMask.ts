/**
 * Utilitários para máscara e validação de datas no padrão brasileiro (DD/MM/AAAA)
 */

export const INVALID_BR_DATE_MESSAGE =
  '⚠️ Data inválida. Por favor, informe uma data válida no formato DD/MM/AAAA.'

/**
 * Remove não-números, limita a 8 dígitos e formata:
 * DD -> DD/MM -> DD/MM/AAAA conforme o usuário digita.
 */
export function applyDateMask(val: unknown): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  // Se for ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.slice(0, 10).split('-')
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }

  // Apenas dígitos, no máximo 8
  const digits = str.replace(/\D/g, '').slice(0, 8)
  if (!digits) return ''

  if (digits.length <= 2) {
    return digits
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/**
 * Máscara específica para data curta (DD/MM/AA) com barras fixas.
 * Ao digitar "150726", formata progressivamente:
 * "1" -> "1"
 * "15" -> "15/"
 * "150" -> "15/0"
 * "1507" -> "15/07/"
 * "150726" -> "15/07/26"
 * As barras são geradas automaticamente e não podem ser apagadas pelo usuário.
 */
export function applyShortDateMask(val: unknown): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  // Apenas dígitos, no máximo 6 (DDMMAA)
  const digits = str.replace(/\D/g, '').slice(0, 6)
  if (!digits) return ''

  if (digits.length < 2) {
    return digits
  }
  if (digits.length === 2) {
    return `${digits}/`
  }
  if (digits.length < 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }
  if (digits.length === 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}/`
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/**
 * Converte data em DD/MM/AAAA para YYYY-MM-DD (se aplicável), ou preserva.
 */
export function brDateToIso(dateStr: string): string {
  if (!dateStr) return ''
  const trimmed = dateStr.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (match) {
    const [, d, m, y] = match
    return `${y}-${m}-${d}`
  }
  return dateStr
}

/**
 * Converte data ISO YYYY-MM-DD para DD/MM/AAAA (se aplicável), ou preserva.
 */
export function isoToBrDate(isoStr: string): string {
  if (!isoStr) return ''
  const trimmed = isoStr.trim()
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const [, y, m, d] = match
    return `${d}/${m}/${y}`
  }
  return isoStr
}

/**
 * Valida dia/mês/ano no formato DD/MM/AAAA, inclusive fevereiro e anos bissextos.
 * Retorna true se a string estiver vazia (opcional) ou se for uma data válida.
 * Se passada uma data parcial ou com números inválidos, retorna false.
 */
export function isValidBrDate(dateStr: unknown): boolean {
  if (dateStr === null || dateStr === undefined) return true
  const str = String(dateStr).trim()
  if (str === '') return true

  // Se vier em formato ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [yStr, mStr, dStr] = str.split('-')
    const y = parseInt(yStr, 10)
    const m = parseInt(mStr, 10)
    const d = parseInt(dStr, 10)
    return checkDateNumbers(d, m, y)
  }

  // Formato DD/MM/AA (ano com 2 dígitos, ex: 15/07/26)
  const matchShort = str.match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (matchShort) {
    const day = parseInt(matchShort[1], 10)
    const month = parseInt(matchShort[2], 10)
    const shortYear = parseInt(matchShort[3], 10)
    // Assume século 2000 para anos de 2 dígitos
    const year = 2000 + shortYear
    return checkDateNumbers(day, month, year)
  }

  // Espera DD/MM/AAAA
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return false

  const day = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const year = parseInt(match[3], 10)

  return checkDateNumbers(day, month, year)
}

function checkDateNumbers(day: number, month: number, year: number): boolean {
  if (year < 1900 || year > 2100) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false

  // Meses com 30 dias
  if ([4, 6, 9, 11].includes(month) && day > 30) {
    return false
  }

  // Fevereiro e bissexto
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    if (isLeap && day > 29) return false
    if (!isLeap && day > 28) return false
  }

  return true
}
