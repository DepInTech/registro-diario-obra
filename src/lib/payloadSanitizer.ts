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
      // No fluxo offline / sanitização: garantir que valores do admin_snapshot têm prioridade
      // sobre alterações indevidas em campos bloqueados pelo Admin
      const ff =
        snap.filled_fields && typeof snap.filled_fields === 'object' ? snap.filled_fields : {}
      const mappings: Record<string, string[]> = {
        supervised_by: ['supervised_by', 'supervisedBy'],
        performed_by: ['performed_by', 'performedBy'],
        empresa_executora: ['empresa_executora', 'companyName'],
        report_date: ['report_date', 'reportDate', 'date'],
        weather: ['weather'],
        activity_title: ['activity_title', 'activityTitle'],
        activity_description: ['activity_description', 'activityDescription'],
        time_displacement: ['time_displacement', 'timeDisplacement'],
        time_waiting: ['time_waiting', 'timeWaiting'],
        interferences: ['interferences'],
        plan_changes: ['plan_changes', 'planChanges'],
        accidents: ['accidents'],
      }

      for (const [col, aliases] of Object.entries(mappings)) {
        let snapVal: any = undefined
        for (const alias of aliases) {
          if (
            snap[alias] !== undefined &&
            snap[alias] !== null &&
            String(snap[alias]).trim() !== ''
          ) {
            snapVal = snap[alias]
            break
          }
          if (ff[alias] !== undefined && ff[alias] !== null && String(ff[alias]).trim() !== '') {
            snapVal = ff[alias]
            break
          }
        }
        if (snapVal !== undefined && snapVal !== null && String(snapVal).trim() !== '') {
          payload[col] = snapVal
        }
      }
    } else {
      delete payload.admin_snapshot
    }
  }

  return payload
}

/**
 * Campos PROTEGIDOS pela API rule de UPDATE da coleção field_spreadsheets.
 * A rule exige @request.body.X:isset = false para esses campos — enviá-los
 * num PATCH faz o servidor recusar a operação (e o SDK resolve como 404),
 * mesmo com sessão válida. Esta função remove-os do corpo de update,
 * preservando TODOS os campos operacionais (extraction_data, infiltration_data,
 * nutrient_*, compressor_data, oil_removal_data, env_*, observations, weather,
 * morning_time, afternoon_time, infiltration_*_time, waste_*, pluviometer,
 * status, submitted_at, client_token, area, date, review_notes).
 */
const FIELD_SHEET_UPDATE_PROTECTED_FIELDS = [
  'id',
  'project',
  'operator',
  'created',
  'updated',
  'deleted',
  'deleted_reason',
  'deleted_by',
  'deleted_at',
  'archived',
  'change_history',
  'admin_snapshot',
  'returned_fields',
  'number',
  'collectionId',
  'collectionName',
  'expand',
] as const

export function stripProtectedFieldsForUpdate(
  payload: Record<string, any>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (!(FIELD_SHEET_UPDATE_PROTECTED_FIELDS as readonly string[]).includes(key)) {
      body[key] = value
    }
  }
  return body
}

/**
 * Campos PROTEGIDOS pela API rule de UPDATE da coleção reports_rdo.
 * A rule exige @request.body.X:isset = false para number/project/archived/deleted
 * (e também deleted_reason/by/at, para o Técnico) — enviá-los num PATCH faz o
 * servidor recusar a operação com 400, mesmo com sessão válida. Esta função
 * remove-os do corpo de update APENAS (o registro no servidor mantém o número,
 * o projeto e o snapshot do Admin; o CREATE é cuidada pelo hook de numeração).
 */
const RDO_UPDATE_PROTECTED_FIELDS = [
  'id',
  'number',
  'project',
  'archived',
  'deleted',
  'deleted_reason',
  'deleted_by',
  'deleted_at',
] as const

export function stripProtectedFieldsForRdoUpdate(
  payload: Record<string, any>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (!(RDO_UPDATE_PROTECTED_FIELDS as readonly string[]).includes(key)) {
      body[key] = value
    }
  }
  return body
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
      const ff =
        snap.filled_fields && typeof snap.filled_fields === 'object' ? snap.filled_fields : {}

      // No fluxo offline / sanitização: garantir que valores do admin_snapshot têm prioridade
      // sobre alterações indevidas em campos bloqueados pelo Admin
      const scalarMappings: Record<string, string[]> = {
        operator: ['operator'],
        date: ['date'],
        weather: ['weather'],
        pluviometer: ['pluviometer'],
        nutrient_done: ['nutrient_done'],
        nutrient_map_kg: ['nutrient_map_kg'],
        nutrient_ureia_kg: ['nutrient_ureia_kg'],
        waste_liquid_qty: ['waste_liquid_qty'],
        waste_solid_qty: ['waste_solid_qty'],
        env_5s_check: ['env_5s_check'],
        env_checklist_monthly: ['env_checklist_monthly'],
        observations: ['observations'],
        morning_time: ['morning_time'],
        afternoon_time: ['afternoon_time'],
        infiltration_morning_time: ['infiltration_morning_time'],
        infiltration_afternoon_time: ['infiltration_afternoon_time'],
      }

      for (const [col, aliases] of Object.entries(scalarMappings)) {
        let snapVal: any = undefined
        for (const alias of aliases) {
          if (snap[alias] !== undefined && snap[alias] !== null) {
            if (typeof snap[alias] === 'boolean' || String(snap[alias]).trim() !== '') {
              snapVal = snap[alias]
              break
            }
          }
          if (ff[alias] !== undefined && ff[alias] !== null) {
            if (typeof ff[alias] === 'boolean' || String(ff[alias]).trim() !== '') {
              snapVal = ff[alias]
              break
            }
          }
        }
        if (snapVal !== undefined && snapVal !== null) {
          if (typeof snapVal === 'boolean') {
            if (snapVal === true) payload[col] = true
          } else if (String(snapVal).trim() !== '') {
            payload[col] = snapVal
          }
        }
      }

      // Proteger poços e alturas de bomba em extraction_data
      if (Array.isArray(snap.wells) && snap.wells.length > 0 && payload.extraction_data) {
        let curExt: any[] = []
        try {
          if (typeof payload.extraction_data === 'string') {
            curExt = JSON.parse(payload.extraction_data)
          } else if (Array.isArray(payload.extraction_data)) {
            curExt = [...payload.extraction_data]
          }
        } catch {
          /* intentionally ignored */
        }

        if (Array.isArray(curExt) && curExt.length > 0) {
          const mergedExt = curExt.map((row, idx) => {
            const snapRow = snap.wells[idx]
            if (!snapRow) return row
            const nextRow = { ...row }
            if (snapRow.well && String(snapRow.well).trim() !== '') {
              nextRow.well = snapRow.well
            }
            if (
              snapRow.pump !== undefined &&
              snapRow.pump !== null &&
              String(snapRow.pump).trim() !== ''
            ) {
              nextRow.pump = snapRow.pump
            }
            return nextRow
          })
          payload.extraction_data = mergedExt
        }
      }

      // Proteger objetos estruturais: compressor_data, oil_removal_data, infiltration_data
      const jsonKeys = ['compressor_data', 'oil_removal_data', 'infiltration_data']
      for (const jk of jsonKeys) {
        const snapObj = snap[jk] || ff[jk]
        if (snapObj && typeof snapObj === 'object' && !Array.isArray(snapObj)) {
          let curObj: Record<string, any> = {}
          try {
            const raw = payload[jk]
            if (typeof raw === 'string' && raw.trim() !== '') curObj = JSON.parse(raw)
            else if (raw && typeof raw === 'object' && !Array.isArray(raw)) curObj = { ...raw }
          } catch {
            /* intentionally ignored */
          }

          for (const [subK, subV] of Object.entries(snapObj)) {
            if (subV !== undefined && subV !== null && String(subV).trim() !== '') {
              curObj[subK] = subV
            }
          }
          payload[jk] = curObj
        }
      }
    } else {
      delete payload.admin_snapshot
    }
  }

  return payload
}
