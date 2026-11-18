/// <reference path="../pb_data/types.d.ts" />
// FUNCIONALIDADE B — Guard no servidor para edição restrita por campo (devolução por campo).
//
// Quando a Planilha de Campo está com status = 'returned' e o campo returned_fields está
// preenchido, o Técnico só pode:
//   1. Alterar valores dos campos presentes na lista returned_fields;
//   2. Manter returned_fields EXATAMENTE igual ao valor atual (só o Admin altera a lista);
//   3. Transicionar o status para 'submitted' (reenvio para aprovação).
// Qualquer outro campo alterado e não autorizado rejeita a operação INTEIRA (400), sem
// gravação parcial. Mensagens claras: "Campo X não está liberado para correção".
//
// Complementa os guards existentes em rdo_status_guard.js (que bloqueiam técnico em
// submitted/approved) sem alterá-los. Comparação campo a campo entre
// e.record.original() (estado gravado no servidor) e o payload da requisição
// (@request.body / e.record), o mesmo padrão dos guards existentes.

// Campos de sistema/controle: nunca são "campos liberados" para o técnico e a alteração
// deles é tratada de forma específica (status, returned_fields, histórico, auditoria...).
const FS_SYSTEM_FIELDS = [
  'id',
  'created',
  'updated',
  'status',
  'returned_fields',
  'review_notes',
  'change_history',
  'admin_snapshot',
  'archived',
  'deleted',
  'deleted_reason',
  'deleted_by',
  'deleted_at',
  'client_token',
  'number',
  'project',
  'operator',
  'assigned_technicians',
  'submitted_at',
  'approved_at',
  'returned_at',
  'returned_by',
  'returned_by_name',
]

// Função de normalização para comparação de valores (espelha normalizeCompare do cliente,
// src/services/historyDiffService.ts)
const normalizeVal = (v) => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (Array.isArray(v) || typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

const parseJsonField = (raw) => {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      return JSON.parse(raw)
    } catch (_) {
      return raw
    }
  }
  return null
}

// Mapeia grupos de devolução (FIELD_SHEET_RETURN_OPTIONS do cliente) para os campos do
// registro que compõem cada grupo — a mesma granularidade que o cliente usa para
// bloquear/desbloquear inputs em handleFieldChange/isExtractionCellEditable.
const FS_GROUP_FIELDS = {
  hidrometro: ['morning_time', 'afternoon_time', 'extraction_data'],
  autopump: ['extraction_data'],
  infiltracao: ['infiltration_morning_time', 'infiltration_afternoon_time', 'infiltration_data'],
  nutrientes: ['nutrient_done', 'nutrient_map_kg', 'nutrient_ureia_kg'],
  compressores: ['compressor_data'],
  oleo: ['oil_removal_data'],
  residuos: ['waste_liquid_qty', 'waste_solid_qty'],
  controles_ambientais: ['env_5s_check', 'env_checklist_monthly'],
  observacoes: ['observations'],
  dados_gerais: ['area', 'weather', 'pluviometer'],
}

const GROUP_OF_FIELD = {}
Object.keys(FS_GROUP_FIELDS).forEach((group) => {
  FS_GROUP_FIELDS[group].forEach((f) => {
    if (!GROUP_OF_FIELD[f]) GROUP_OF_FIELD[f] = []
    GROUP_OF_FIELD[f].push(group)
  })
})

// Normaliza a lista returned_fields (json pode vir como array, string JSON ou objeto)
const readReturnedFields = (recordLike) => {
  const parsed = parseJsonField(recordLike.get('returned_fields'))
  if (Array.isArray(parsed)) return parsed.map(String)
  return []
}

// Verifica se um campo do registro está autorizado pela lista returned_fields do Admin.
// Autorização por GRUPO (ex.: 'hidrometro' libera morning_time/afternoon_time/extraction_data),
// igual ao comportamento da UI do técnico.
const isFieldAuthorizedForTech = (fieldName, returnedList) => {
  const groups = GROUP_OF_FIELD[fieldName] || []
  return groups.some((g) => returnedList.indexOf(g) !== -1)
}

// Gera mensagem legível de campo para o erro (ex.: 'extraction_data[0].morning')
const friendlyFieldName = (fieldName) => {
  const base = fieldName.split('[')[0].split('.')[0]
  const labels = {
    area: 'Área',
    weather: 'Clima',
    pluviometer: 'Pluviômetro (mm)',
    morning_time: 'Horário Hidrômetro Manhã',
    afternoon_time: 'Horário Hidrômetro Tarde',
    infiltration_morning_time: 'Horário Infiltração Manhã',
    infiltration_afternoon_time: 'Horário Infiltração Tarde',
    nutrient_done: 'Dosagem de Nutrientes Realizada',
    nutrient_map_kg: 'Nutriente MAP (Kg)',
    nutrient_ureia_kg: 'Nutriente Ureia (Kg)',
    waste_liquid_qty: 'Tambores Líquido (Qtd)',
    waste_solid_qty: 'Tambores Sólido (Qtd)',
    env_5s_check: 'Controle 5S',
    env_checklist_monthly: 'Checklist Mensal',
    observations: 'Observações e Manutenções',
    extraction_data: 'Tabela de Extração (Poços)',
    infiltration_data: 'Infiltração',
    compressor_data: 'Compressores',
    oil_removal_data: 'Remoção de Óleo (SAO)',
  }
  return labels[base] || base
}

const auditReturnedFieldViolation = (e, fieldName, originalValue, nextValue) => {
  try {
    const logs = $app.findCollectionByNameOrId('audit_logs')
    if (!logs) return
    const log = new Record(logs)
    if (e.auth && e.auth.id) log.set('actor', e.auth.id)
    log.set('action', 'rejected')
    log.set('entity', 'field_spreadsheets')
    log.set('entity_record', e.record.id)
    log.set('details', {
      label: 'Tentativa de edição em campo não liberado',
      rejected_field: fieldName,
      previous_value: normalizeVal(originalValue).slice(0, 500),
      attempted_value: normalizeVal(nextValue).slice(0, 500),
      returned_fields: readReturnedFields(e.record.original()),
      server_timestamp: new Date().toISOString(),
    })
    $app.save(log)
  } catch (auditErr) {
    console.warn('returned_fields guard: falha ao registrar tentativa no audit_logs:', auditErr)
  }
}

// Guard de UPDATE em field_spreadsheets (roda ANTES do guard genérico de status)
onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth) return e.next()
  const role = auth.getString('role')
  if (role === 'admin') return e.next() // Admin pode tudo (lista, status, aprovação)

  const orig = e.record.original()
  const currentStatus = orig.getString('status')

  // Guard só se aplica quando o registro está devolvido e com lista de campos preenchida
  if (currentStatus !== 'returned') return e.next()

  const returnedList = readReturnedFields(orig)
  if (returnedList.length === 0) return e.next() // lista vazia = legado, libera tudo

  // ---- 2. returned_fields NÃO pode ser alterado pelo Técnico ----
  const origReturned = normalizeVal(orig.get('returned_fields'))
  const nextReturned = normalizeVal(e.record.get('returned_fields'))
  if (origReturned !== nextReturned) {
    throw new BadRequestError(
      'A lista de campos liberados para correção só pode ser alterada pelo Administrador.',
    )
  }

  // ---- 3. Status: técnico só pode reenviar ('submitted') ----
  // Manter o status atual ('returned' → 'returned', salvamento de progresso) é permitido;
  // apenas uma MUDANÇA de status para valor diferente de 'submitted' é rejeitada.
  const nextStatus = e.record.getString('status')
  if (nextStatus !== currentStatus && nextStatus !== 'submitted') {
    throw new BadRequestError(
      'Em correção, o Técnico só pode reenviar a planilha para aprovação (status submitted).',
    )
  }

  // ---- 1 e 4. Campos de dados: comparar original vs payload, campo a campo ----
  const origData = orig.data ? orig.data() : {}
  const nextData = e.record.data ? e.record.data() : {}
  const changedFields = []

  Object.keys(nextData).forEach((key) => {
    if (FS_SYSTEM_FIELDS.indexOf(key) !== -1) return // tratados acima / campos de controle
    const origVal = origData[key]
    const nextVal = nextData[key]
    if (normalizeVal(origVal) !== normalizeVal(nextVal)) {
      changedFields.push(key)
    }
  })

  // Campos enviados mas omitidos do payload (ex.: payload parcial via PATCH):
  // compara também campos significativos do original ausentes no payload
  Object.keys(origData).forEach((key) => {
    if (FS_SYSTEM_FIELDS.indexOf(key) !== -1) return
    if (changedFields.indexOf(key) !== -1) return
    if (!(key in nextData)) {
      // campo não enviado no PATCH: sem alteração, ignora
    }
  })

  const unauthorized = changedFields.filter((f) => !isFieldAuthorizedForTech(f, returnedList))

  if (unauthorized.length > 0) {
    const detail = unauthorized.map((f) => `${friendlyFieldName(f)} (${f})`).join(', ')
    auditReturnedFieldViolation(
      e,
      unauthorized.join(', '),
      origData[unauthorized[0]],
      nextData[unauthorized[0]],
    )
    throw new BadRequestError(
      `Campo ${detail} não está liberado para correção. Solicite ao Administrador.`,
    )
  }

  e.next()
}, 'field_spreadsheets')

console.log('[returned_fields_guard] guard de edição restrita por campo carregado')
