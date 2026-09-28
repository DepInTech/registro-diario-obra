import { brDateToIso } from './dateMask'

/**
 * Identifica se uma string de ID é provisória (gerada localmente em offline)
 */
export function isProvisionalId(id?: string | null): boolean {
  if (!id) return false
  const s = String(id).trim()
  if (
    s.startsWith('rdo_') ||
    s.startsWith('field_') ||
    s.startsWith('proj_') ||
    s.startsWith('user_') ||
    s.startsWith('photo_') ||
    s.startsWith('temp_') ||
    s.startsWith('p_') ||
    s.startsWith('well_')
  ) {
    return true
  }
  // PocketBase record IDs must be exactly 15 lowercase alphanumeric characters: [a-z0-9]{15}
  return !/^[a-z0-9]{15}$/.test(s)
}

/**
 * Retorna true se e somente se o ID for um ID de servidor válido PocketBase ([a-z0-9]{15})
 */
export function isValidPocketBaseId(id?: string | null): boolean {
  if (!id) return false
  return /^[a-z0-9]{15}$/.test(String(id).trim())
}

/**
 * Normaliza qualquer formato de data (DD/MM/AAAA ou ISO) para ISO YYYY-MM-DD
 * Preserva horário se já existir no formato ISO com time (YYYY-MM-DDTHH:mm:ss...).
 */
export function sanitizeDateToIso(raw: unknown): string {
  if (!raw) return ''
  const str = String(raw).trim()
  if (!str) return ''

  // Se já for ISO completo com datetime (ex.: 2025-05-28T14:30:00.000Z), mantém
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return str
  }

  // Se for DD/MM/AAAA ou DD/MM/AAAA HH:mm
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (brMatch) {
    const [, d, m, y] = brMatch
    const remainder = str.slice(10).trim()
    if (remainder) {
      return `${y}-${m}-${d} ${remainder}`
    }
    return `${y}-${m}-${d}`
  }

  // Fallback via brDateToIso
  return brDateToIso(str)
}

/**
 * Garante que admin_snapshot seja SEMPRE um objeto plano Javascript ({...}), NUNCA array ou nulo.
 * Se for string JSON, faz o parse e valida se é objeto.
 */
/**
 * Normaliza qualquer valor recebido para objeto plano seguro (Record<string, any>).
 * Suporta string JSON, múltiplos níveis de stringificação, nulos, undefined e Goja objects.
 * Retorna null se não houver payload válido em formato de objeto.
 */
export function parseAdminSnapshot(raw: unknown): Record<string, any> | null {
  if (raw === undefined || raw === null) return null

  let cur: any = raw
  // Trata casos em que a string JSON foi duplamente serializada
  let attempts = 0
  while (typeof cur === 'string' && attempts < 3) {
    const trimmed = cur.trim()
    if (
      !trimmed ||
      trimmed === '""' ||
      trimmed === '{}' ||
      trimmed === 'null' ||
      trimmed === 'undefined'
    ) {
      return null
    }
    try {
      cur = JSON.parse(trimmed)
      attempts++
    } catch {
      return null
    }
  }

  if (!cur || typeof cur !== 'object' || Array.isArray(cur)) {
    return null
  }

  // Normaliza sub-propriedades que também possam ter chegado como string JSON
  if (typeof cur.filled_fields === 'string') {
    try {
      const parsedFields = JSON.parse(cur.filled_fields.trim())
      if (parsedFields && typeof parsedFields === 'object' && !Array.isArray(parsedFields)) {
        cur.filled_fields = parsedFields
      } else {
        cur.filled_fields = {}
      }
    } catch {
      cur.filled_fields = {}
    }
  }

  if (typeof cur.wells === 'string') {
    try {
      const parsedWells = JSON.parse(cur.wells.trim())
      cur.wells = Array.isArray(parsedWells) ? parsedWells : []
    } catch {
      cur.wells = []
    }
  }

  return cur
}

/**
 * Garante que admin_snapshot seja SEMPRE um objeto plano Javascript ({...}), NUNCA array ou nulo.
 * Se for string JSON, faz o parse e valida se é objeto.
 */
export function sanitizeAdminSnapshot(raw: unknown): Record<string, unknown> | undefined {
  if (raw === undefined || raw === null) return undefined

  const obj = parseAdminSnapshot(raw)
  if (!obj) return {}

  // Se tiver preenchimento, clona para garantir objeto plano
  const sanitized: Record<string, unknown> = {}
  for (const k of Object.keys(obj)) {
    // Se supervisionado ou operador dentro do snapshot for provisório, sanitiza
    if (
      (k === 'supervised_by' || k === 'operator' || k === 'performed_by') &&
      isProvisionalId(obj[k])
    ) {
      sanitized[k] = ''
    } else {
      sanitized[k] = obj[k]
    }
  }
  return sanitized
}

/**
 * Sanitiza valores de campos livres de texto na Planilha de Campo:
 * waste_liquid_qty, waste_solid_qty, pluviometer, nutrient_map_kg, nutrient_ureia_kg.
 * Devem ser sempre string (nunca null, undefined ou objeto).
 */
export function sanitizeTextField(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number') return isNaN(val) ? '' : String(val)
  return String(val)
}

/**
 * Sanitiza ID de relation (project, operator, performed_by, supervised_by, deleted_by).
 * Garante que IDs provisórios locais (ex.: 'field_*', 'proj_*', 'user_*') NUNCA sejam enviados.
 */
export function sanitizeRelationId(id: unknown): string | undefined {
  if (!id) return undefined
  const str = String(id).trim()
  if (!str || isProvisionalId(str)) return undefined
  return str
}

/**
 * Sanitiza completion_date de poços de RDO:
 * - Vazio -> null
 * - DD/MM/AAAA -> YYYY-MM-DDTHH:mm:ss.sssZ ou YYYY-MM-DD
 */
export function sanitizeWellCompletionDate(dateVal: unknown): string | null {
  if (!dateVal) return null
  const str = String(dateVal).trim()
  if (!str) return null
  const iso = sanitizeDateToIso(str)
  if (!iso) return null
  return iso.includes('T') ? iso : `${iso}T12:00:00.000Z`
}

/**
 * Sanitiza payload completo antes de enviar para `reports_rdo` (POST ou PATCH)
 */
export function sanitizeRdoPayload(raw: Record<string, any>): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...raw }

  // 0. Remove id provisório se passado no payload (PocketBase DEVE gerar o ID no create)
  if ('id' in payload && isProvisionalId(payload.id as string)) {
    delete payload.id
  }

  // 1. Datas
  if ('report_date' in payload && payload.report_date) {
    payload.report_date = sanitizeDateToIso(payload.report_date)
  }
  if ('date' in payload && payload.date) {
    payload.date = sanitizeDateToIso(payload.date)
  }
  if ('submitted_at' in payload && payload.submitted_at) {
    payload.submitted_at = sanitizeDateToIso(payload.submitted_at)
  }
  if ('approved_at' in payload && payload.approved_at) {
    payload.approved_at = sanitizeDateToIso(payload.approved_at)
  }
  if ('returned_at' in payload && payload.returned_at) {
    payload.returned_at = sanitizeDateToIso(payload.returned_at)
  }
  if ('deleted_at' in payload && payload.deleted_at) {
    payload.deleted_at = sanitizeDateToIso(payload.deleted_at)
  }

  // 2. Relations — nunca provisórios
  if ('project' in payload) {
    const cleanProj = sanitizeRelationId(payload.project)
    if (cleanProj) payload.project = cleanProj
    else delete payload.project
  }
  if ('performed_by' in payload) {
    const cleanPerf = sanitizeRelationId(payload.performed_by)
    if (cleanPerf) payload.performed_by = cleanPerf
    else delete payload.performed_by
  }
  if ('supervised_by' in payload) {
    const cleanSup = sanitizeRelationId(payload.supervised_by)
    if (cleanSup) payload.supervised_by = cleanSup
    else delete payload.supervised_by
  }
  if ('deleted_by' in payload) {
    const cleanDel = sanitizeRelationId(payload.deleted_by)
    payload.deleted_by = cleanDel || null
  }

  // 3. admin_snapshot — sempre objeto plano ou removido se vazio
  if ('admin_snapshot' in payload) {
    const snap = sanitizeAdminSnapshot(payload.admin_snapshot)
    if (snap) {
      payload.admin_snapshot = snap
    } else {
      delete payload.admin_snapshot
    }
  }

  return payload
}

/**
 * Sanitiza payload completo antes de enviar para `field_spreadsheets` (POST ou PATCH)
 */
export function sanitizeFieldSpreadsheetPayload(raw: Record<string, any>): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...raw }

  // 0. Remove id provisório se passado no payload (PocketBase DEVE gerar o ID no create)
  if ('id' in payload && isProvisionalId(payload.id as string)) {
    delete payload.id
  }

  // 1. Datas
  if ('date' in payload && payload.date) {
    payload.date = sanitizeDateToIso(payload.date)
  }
  if ('submitted_at' in payload && payload.submitted_at) {
    payload.submitted_at = sanitizeDateToIso(payload.submitted_at)
  }
  if ('approved_at' in payload && payload.approved_at) {
    payload.approved_at = sanitizeDateToIso(payload.approved_at)
  }
  if ('returned_at' in payload && payload.returned_at) {
    payload.returned_at = sanitizeDateToIso(payload.returned_at)
  }
  if ('deleted_at' in payload && payload.deleted_at) {
    payload.deleted_at = sanitizeDateToIso(payload.deleted_at)
  }

  // 2. Relations — nunca provisórios
  if ('project' in payload) {
    const cleanProj = sanitizeRelationId(payload.project)
    if (cleanProj) payload.project = cleanProj
    else delete payload.project
  }
  if ('operator' in payload) {
    const cleanOp = sanitizeRelationId(payload.operator)
    if (cleanOp) payload.operator = cleanOp
    else delete payload.operator
  }
  if ('deleted_by' in payload) {
    const cleanDel = sanitizeRelationId(payload.deleted_by)
    payload.deleted_by = cleanDel || null
  }

  // 3. Campos livres de texto — sempre string
  if ('pluviometer' in payload) {
    payload.pluviometer = sanitizeTextField(payload.pluviometer)
  }
  if ('waste_liquid_qty' in payload) {
    payload.waste_liquid_qty = sanitizeTextField(payload.waste_liquid_qty)
  }
  if ('waste_solid_qty' in payload) {
    payload.waste_solid_qty = sanitizeTextField(payload.waste_solid_qty)
  }
  if ('nutrient_map_kg' in payload) {
    payload.nutrient_map_kg = sanitizeTextField(payload.nutrient_map_kg)
  }
  if ('nutrient_ureia_kg' in payload) {
    payload.nutrient_ureia_kg = sanitizeTextField(payload.nutrient_ureia_kg)
  }

  // 4. admin_snapshot — sempre objeto plano ou removido se vazio
  if ('admin_snapshot' in payload) {
    const snap = sanitizeAdminSnapshot(payload.admin_snapshot)
    if (snap) {
      payload.admin_snapshot = snap
    } else {
      delete payload.admin_snapshot
    }
  }

  return payload
}
