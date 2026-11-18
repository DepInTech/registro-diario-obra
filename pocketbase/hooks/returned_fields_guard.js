/// <reference path="../pb_data/types.d.ts" />
// FUNCIONALIDADE B — Guard no servidor para edição restrita por campo (devolução por campo).
//
// Quando a Planilha de Campo (field_spreadsheets) OU o RDO (reports_rdo) está com
// status = 'returned' e o campo returned_fields está preenchido, o Técnico só pode:
//   1. Alterar valores dos campos presentes na lista returned_fields (por grupo);
//   2. Manter returned_fields EXATAMENTE igual ao valor atual (só o Admin altera a lista);
//   3. Transicionar o status para 'submitted' (reenvio para aprovação).
// Qualquer outro campo alterado e não autorizado rejeita a operação INTEIRA (400), sem
// gravação parcial. Mensagens claras: "Campo X não está liberado para correção".
//
// Complementa os guards existentes em rdo_status_guard.js (que bloqueiam técnico em
// submitted/approved) sem alterá-los. IMPORTANTE (JSVM do PocketBase): callbacks rodam em
// um pool de VMs separado — TODO o código (helpers, mapas de grupos, auditoria) vive
// DENTRO de cada callback, sem declarações top-level compartilhadas.

// ============================================================
// field_spreadsheets
// ============================================================
onRecordUpdateRequest((e) => {
  // ---- helpers (inline: exigência da JSVM do PocketBase) ----
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
  const readReturnedFields = (recordLike) => {
    const parsed = parseJsonField(recordLike.get('returned_fields'))
    if (Array.isArray(parsed)) return parsed.map(String)
    return []
  }

  // Campos de sistema/controle: nunca são "campos liberados" para o técnico
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

  // Mapa de grupos de devolução (FIELD_SHEET_RETURN_OPTIONS do cliente) para os campos
  // do registro que compõem cada grupo — a mesma granularidade que o cliente usa para
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

  // Autorização por GRUPO (ex.: 'hidrometro' libera morning_time/afternoon_time/extraction_data)
  const isFieldAuthorizedForTech = (fieldName, returnedList) => {
    const groups = GROUP_OF_FIELD[fieldName] || []
    return groups.some((g) => returnedList.indexOf(g) !== -1)
  }

  // Nome legível do campo para a mensagem de erro
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

  // Registra tentativa em audit_logs (action 'rejected' — valor adicionado pela migração 0044)
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

  // ---- guard ----
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
  // O cliente legítimo reenvia a lista local (o Técnico remove da lista os grupos já
  // corrigidos — clearReturnedField em FieldSpreadsheets.tsx/Rdos.tsx). Rejeitar com 400
  // quebraria o ciclo de correção; em vez disso o servidor DESCARTA a versão do Técnico
  // e mantém a lista original do Admin: nada do Técnico persiste nessa lista e a
  // autorização abaixo já usa a lista do Admin (readReturnedFields(orig)).
  const origReturnedRaw = orig.get('returned_fields')
  const origReturned = normalizeVal(origReturnedRaw)
  const nextReturned = normalizeVal(e.record.get('returned_fields'))
  if (origReturned !== nextReturned) {
    e.record.set('returned_fields', origReturnedRaw)
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
    if (FS_SYSTEM_FIELDS.indexOf(key) !== -1) return // campos de controle, tratados acima
    if (normalizeVal(origData[key]) !== normalizeVal(nextData[key])) {
      changedFields.push(key)
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

// ============================================================
// reports_rdo — mesmo guard, granularidade de RDO_RETURN_OPTIONS
// ============================================================
onRecordUpdateRequest((e) => {
  // ---- helpers (inline: exigência da JSVM do PocketBase) ----
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
  const readReturnedFields = (recordLike) => {
    const parsed = parseJsonField(recordLike.get('returned_fields'))
    if (Array.isArray(parsed)) return parsed.map(String)
    return []
  }

  // Campos de sistema/controle do RDO (nunca liberados como "dados" para o técnico)
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
  const RDO_SYSTEM_FIELDS = FS_SYSTEM_FIELDS.concat(['empresa_executora'])

  // Mapa de grupos de devolução (RDO_RETURN_OPTIONS do cliente) para os campos do registro.
  const RDO_GROUP_FIELDS = {
    atividade: ['activity_title', 'activity_description', 'activityTitle', 'activityDescription'],
    horarios: ['time_displacement', 'time_waiting', 'timeDisplacement', 'timeWaiting'],
    interferencias: ['interferences', 'accidents'],
    mudancas_plano: ['plan_changes', 'planChanges'],
    pocos: ['wells'],
    fotos: ['photos', 'field_photo', 'fieldPhoto'],
    clima_local: ['weather', 'location', 'report_date', 'reportDate'],
  }
  const rdoGroupOfField = {}
  Object.keys(RDO_GROUP_FIELDS).forEach((group) => {
    RDO_GROUP_FIELDS[group].forEach((f) => {
      if (!rdoGroupOfField[f]) rdoGroupOfField[f] = []
      rdoGroupOfField[f].push(group)
    })
  })

  // Autorizado se: o grupo do campo está na lista OU o nome do campo está direto na lista
  const isRdoFieldAuthorizedForTech = (fieldName, returnedList) => {
    const groups = rdoGroupOfField[fieldName] || []
    if (groups.some((g) => returnedList.indexOf(g) !== -1)) return true
    return returnedList.indexOf(fieldName) !== -1
  }

  const RDO_FIELD_LABELS = {
    activity_title: 'Título da Atividade',
    activity_description: 'Descrição dos Serviços',
    time_displacement: 'Horário de Deslocamento',
    time_waiting: 'Tempo de Espera',
    interferences: 'Interferências Encontradas',
    accidents: 'Acidentes / Incidentes',
    plan_changes: 'Mudanças de Plano',
    wells: 'Tabela de Poços',
    photos: 'Fotografias do Relatório',
    field_photo: 'Foto do Campo',
    weather: 'Condições Climáticas',
    location: 'Local da Obra',
    report_date: 'Data do Relatório',
  }

  // Registra tentativa em audit_logs (action 'rejected' — valor adicionado pela migração 0044)
  const auditRdoReturnedFieldViolation = (e, fieldName, originalValue, nextValue) => {
    try {
      const logs = $app.findCollectionByNameOrId('audit_logs')
      if (!logs) return
      const log = new Record(logs)
      if (e.auth && e.auth.id) log.set('actor', e.auth.id)
      log.set('action', 'rejected')
      log.set('entity', 'reports_rdo')
      log.set('entity_record', e.record.id)
      log.set('details', {
        label: 'Tentativa de edição em campo não liberado (RDO)',
        rejected_field: fieldName,
        previous_value: normalizeVal(originalValue).slice(0, 500),
        attempted_value: normalizeVal(nextValue).slice(0, 500),
        returned_fields: readReturnedFields(e.record.original()),
        server_timestamp: new Date().toISOString(),
      })
      $app.save(log)
    } catch (auditErr) {
      console.warn(
        'returned_fields guard (rdo): falha ao registrar tentativa no audit_logs:',
        auditErr,
      )
    }
  }

  // ---- guard ----
  const auth = e.auth
  if (!auth) return e.next()
  const role = auth.getString('role')
  if (role === 'admin') return e.next()

  const orig = e.record.original()
  const currentStatus = orig.getString('status')

  if (currentStatus !== 'returned') return e.next()

  const returnedList = readReturnedFields(orig)
  if (returnedList.length === 0) return e.next() // lista vazia = legado, libera tudo

  // returned_fields NÃO pode ser alterado pelo Técnico (mesma semântica do guard de
  // field_spreadsheets acima: descarta a versão do Técnico e mantém a lista do Admin)
  const origReturnedRaw = orig.get('returned_fields')
  const origReturned = normalizeVal(origReturnedRaw)
  const nextReturned = normalizeVal(e.record.get('returned_fields'))
  if (origReturned !== nextReturned) {
    e.record.set('returned_fields', origReturnedRaw)
  }

  // Status: técnico só pode manter 'returned' ou reenviar ('submitted')
  const nextStatus = e.record.getString('status')
  if (nextStatus !== currentStatus && nextStatus !== 'submitted') {
    throw new BadRequestError(
      'Em correção, o Técnico só pode reenviar o RDO para aprovação (status submitted).',
    )
  }

  // Campos de dados: comparação original vs payload
  const origData = orig.data ? orig.data() : {}
  const nextData = e.record.data ? e.record.data() : {}
  const changedFields = []

  Object.keys(nextData).forEach((key) => {
    if (RDO_SYSTEM_FIELDS.indexOf(key) !== -1) return
    if (normalizeVal(origData[key]) !== normalizeVal(nextData[key])) {
      changedFields.push(key)
    }
  })

  const unauthorized = changedFields.filter((f) => !isRdoFieldAuthorizedForTech(f, returnedList))

  if (unauthorized.length > 0) {
    const detail = unauthorized.map((f) => `${RDO_FIELD_LABELS[f] || f} (${f})`).join(', ')
    auditRdoReturnedFieldViolation(
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
}, 'reports_rdo')

console.log(
  '[returned_fields_guard] guard de edição restrita por campo carregado (field_spreadsheets + reports_rdo)',
)
