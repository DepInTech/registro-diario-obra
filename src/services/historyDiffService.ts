import { ChangeDetail, ReturnCycle } from '@/types/epa'
import { OfflineFieldSheetItem, OfflineRdoItem } from '@/services/offlineStorage'

/**
 * Mapeamento e normalização de valores para comparação e exibição legível
 */
export function formatValueDisplay(val: unknown): string {
  if (val === null || val === undefined) return 'Não preenchido'
  if (typeof val === 'string') {
    const trimmed = val.trim()
    return trimmed === '' ? 'Não preenchido' : trimmed
  }
  if (typeof val === 'number') {
    return isNaN(val) ? 'Não preenchido' : String(val)
  }
  if (typeof val === 'boolean') {
    return val ? 'Sim' : 'Não'
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return 'Não preenchido'
    return JSON.stringify(val)
  }
  if (typeof val === 'object') {
    return JSON.stringify(val)
  }
  return String(val)
}

function normalizeCompare(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val.trim()
  if (typeof val === 'number') return String(val)
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

// ==========================================
// 1. SNAPSHOT E COMPARAÇÃO DE PLANILHA DE CAMPO
// ==========================================

export const FIELD_SHEET_RETURN_OPTIONS = [
  { id: 'hidrometro', label: 'Hidrômetro (Manhã/Tarde)' },
  { id: 'autopump', label: 'Autopump (Saída e Condição)' },
  { id: 'infiltracao', label: 'Infiltração (Leituras e Bombas)' },
  { id: 'nutrientes', label: 'Dosagem de Nutrientes (MAP / Ureia)' },
  { id: 'compressores', label: 'Compressores' },
  { id: 'oleo', label: 'Remoção de Óleo (SAO)' },
  { id: 'residuos', label: 'Resíduos (Líquido / Sólido)' },
  { id: 'controles_ambientais', label: 'Controles Ambientais e 5S' },
  { id: 'observacoes', label: 'Observações e Manutenções' },
  { id: 'dados_gerais', label: 'Dados Gerais (Área, Clima, Pluviômetro)' },
]

export function createFieldSheetSnapshot(sheet: OfflineFieldSheetItem): Record<string, any> {
  return {
    area: sheet.area || '',
    weather: sheet.weather || '',
    pluviometer: sheet.pluviometer ?? 0,
    morning_time: sheet.morning_time || '',
    afternoon_time: sheet.afternoon_time || '',
    infiltration_morning_time: sheet.infiltration_morning_time || '',
    infiltration_afternoon_time: sheet.infiltration_afternoon_time || '',
    nutrient_done: Boolean(sheet.nutrient_done),
    nutrient_map_kg: sheet.nutrient_map_kg ?? 0,
    nutrient_ureia_kg: sheet.nutrient_ureia_kg ?? 0,
    waste_liquid_qty: sheet.waste_liquid_qty ?? '',
    waste_solid_qty: sheet.waste_solid_qty ?? '',
    env_5s_check: Boolean(sheet.env_5s_check),
    env_checklist_monthly: Boolean(sheet.env_checklist_monthly),
    observations: sheet.observations || '',
    extraction_data: JSON.parse(JSON.stringify(sheet.extraction_data || [])),
    infiltration_data: JSON.parse(JSON.stringify(sheet.infiltration_data || {})),
    compressor_data: JSON.parse(JSON.stringify(sheet.compressor_data || {})),
    oil_removal_data: JSON.parse(JSON.stringify(sheet.oil_removal_data || {})),
  }
}

export function diffFieldSheet(
  snapshot: Record<string, any>,
  current: OfflineFieldSheetItem,
  changedBy?: string,
  changedByName?: string,
): ChangeDetail[] {
  const changes: ChangeDetail[] = []
  const now = new Date().toISOString()

  const checkField = (key: keyof OfflineFieldSheetItem, label: string) => {
    const prev = snapshot[key]
    const next = current[key]
    if (normalizeCompare(prev) !== normalizeCompare(next)) {
      changes.push({
        field: String(key),
        label,
        previousValue: formatValueDisplay(prev),
        newValue: formatValueDisplay(next),
        changedAt: now,
        changedBy,
        changedByName,
      })
    }
  }

  checkField('area', 'Área')
  checkField('weather', 'Clima')
  checkField('pluviometer', 'Pluviômetro (mm)')
  checkField('morning_time', 'Horário Hidrômetro Manhã')
  checkField('afternoon_time', 'Horário Hidrômetro Tarde')
  checkField('infiltration_morning_time', 'Horário Infiltração Manhã')
  checkField('infiltration_afternoon_time', 'Horário Infiltração Tarde')
  checkField('nutrient_done', 'Dosagem de Nutrientes Realizada')
  checkField('nutrient_map_kg', 'Nutriente MAP (Kg)')
  checkField('nutrient_ureia_kg', 'Nutriente Ureia (Kg)')
  checkField('waste_liquid_qty', 'Tambores Líquido (Qtd)')
  checkField('waste_solid_qty', 'Tambores Sólido (Qtd)')
  checkField('env_5s_check', 'Controle 5S')
  checkField('env_checklist_monthly', 'Checklist Mensal')
  checkField('observations', 'Observações e Manutenções')

  // Comparação granular da tabela de extração (Poços)
  const prevExt: Array<Record<string, any>> = snapshot.extraction_data || []
  const nextExt: Array<Record<string, any>> = current.extraction_data || []
  const maxExt = Math.max(prevExt.length, nextExt.length)

  for (let i = 0; i < maxExt; i++) {
    const p = prevExt[i]
    const n = nextExt[i]
    const wellName = n?.well || p?.well || `Poço Linha ${i + 1}`

    if (!p && n) {
      changes.push({
        field: `extraction_data[${i}]`,
        label: `Poço ${wellName} (Nova linha adicionada)`,
        previousValue: 'Não preenchido',
        newValue: `Manhã: ${n.morning || '—'}, Tarde: ${n.afternoon || '—'}, Bomba: ${n.pump || '—'}, Autopump: ${n.autopump || '—'}`,
        changedAt: now,
        changedBy,
        changedByName,
      })
      continue
    }
    if (p && !n) {
      changes.push({
        field: `extraction_data[${i}]`,
        label: `Poço ${wellName} (Linha removida)`,
        previousValue: `Manhã: ${p.morning || '—'}, Tarde: ${p.afternoon || '—'}, Bomba: ${p.pump || '—'}, Autopump: ${p.autopump || '—'}`,
        newValue: 'Não preenchido',
        changedAt: now,
        changedBy,
        changedByName,
      })
      continue
    }

    if (p && n) {
      if (normalizeCompare(p.morning) !== normalizeCompare(n.morning)) {
        changes.push({
          field: `extraction[${wellName}].morning`,
          label: `Hidrômetro Manhã — ${wellName}`,
          previousValue: formatValueDisplay(p.morning),
          newValue: formatValueDisplay(n.morning),
          changedAt: now,
          changedBy,
          changedByName,
        })
      }
      if (normalizeCompare(p.afternoon) !== normalizeCompare(n.afternoon)) {
        changes.push({
          field: `extraction[${wellName}].afternoon`,
          label: `Hidrômetro Tarde — ${wellName}`,
          previousValue: formatValueDisplay(p.afternoon),
          newValue: formatValueDisplay(n.afternoon),
          changedAt: now,
          changedBy,
          changedByName,
        })
      }
      if (normalizeCompare(p.pump) !== normalizeCompare(n.pump)) {
        changes.push({
          field: `extraction[${wellName}].pump`,
          label: `Altura da Bomba — ${wellName}`,
          previousValue: formatValueDisplay(p.pump),
          newValue: formatValueDisplay(n.pump),
          changedAt: now,
          changedBy,
          changedByName,
        })
      }
      if (normalizeCompare(p.autopump) !== normalizeCompare(n.autopump)) {
        changes.push({
          field: `extraction[${wellName}].autopump`,
          label: `Saída Autopump (500mL) — ${wellName}`,
          previousValue: formatValueDisplay(p.autopump),
          newValue: formatValueDisplay(n.autopump),
          changedAt: now,
          changedBy,
          changedByName,
        })
      }
      if (
        normalizeCompare(p.autopump_condition) !== normalizeCompare(n.autopump_condition) ||
        normalizeCompare(p.autopump_condition_other) !==
          normalizeCompare(n.autopump_condition_other)
      ) {
        const prevCond =
          p.autopump_condition === 'Outros' && p.autopump_condition_other
            ? `Outros (${p.autopump_condition_other})`
            : p.autopump_condition || ''
        const nextCond =
          n.autopump_condition === 'Outros' && n.autopump_condition_other
            ? `Outros (${n.autopump_condition_other})`
            : n.autopump_condition || ''

        changes.push({
          field: `extraction[${wellName}].autopump_condition`,
          label: `Condição Autopump — ${wellName}`,
          previousValue: formatValueDisplay(prevCond),
          newValue: formatValueDisplay(nextCond),
          changedAt: now,
          changedBy,
          changedByName,
        })
      }
    }
  }

  // Comparação granular da Infiltração
  const prevInf: Record<string, string> = snapshot.infiltration_data || {}
  const nextInf: Record<string, string> = current.infiltration_data || {}
  const infLabels: Record<string, string> = {
    geralMorning: 'Infiltração Geral (Manhã)',
    geralAfternoon: 'Infiltração Geral (Tarde)',
    out1Morning: 'Infiltração Saída 01 (Manhã)',
    out1Afternoon: 'Infiltração Saída 01 (Tarde)',
    out2Morning: 'Infiltração Saída 02 (Manhã)',
    out2Afternoon: 'Infiltração Saída 02 (Tarde)',
    out3Morning: 'Infiltração Saída 03 (Manhã)',
    out3Afternoon: 'Infiltração Saída 03 (Tarde)',
    bombaInfiltracao: 'Pressão da Bomba (Infiltração)',
    bombaGeral: 'Pressão da Bomba - Geral',
  }

  const allInfKeys = Array.from(new Set([...Object.keys(prevInf), ...Object.keys(nextInf)]))
  for (const k of allInfKeys) {
    if (normalizeCompare(prevInf[k]) !== normalizeCompare(nextInf[k])) {
      changes.push({
        field: `infiltration_data.${k}`,
        label: infLabels[k] || `Infiltração: ${k}`,
        previousValue: formatValueDisplay(prevInf[k]),
        newValue: formatValueDisplay(nextInf[k]),
        changedAt: now,
        changedBy,
        changedByName,
      })
    }
  }

  // Comparação granular dos Compressores
  const prevComp: Record<string, string> = snapshot.compressor_data || {}
  const nextComp: Record<string, string> = current.compressor_data || {}
  const compLabels: Record<string, string> = {
    horimetro1: 'Compressor 01 — Horímetro',
    horimetro2: 'Compressor 02 — Horímetro',
    pressao1: 'Compressor 01 — Pressão',
    pressao2: 'Compressor 02 — Pressão',
    drenagem1: 'Compressor 01 — Drenagem de água',
    drenagem2: 'Compressor 02 — Drenagem de água',
    tempoDesligado1: 'Compressor 01 — Tempo Desligado',
    tempoDesligado2: 'Compressor 02 — Tempo Desligado',
    filtroAr1: 'Compressor 01 — Filtro de Ar',
    filtroAr2: 'Compressor 02 — Filtro de Ar',
    nivelOleo1: 'Compressor 01 — Nível de Óleo',
    nivelOleo2: 'Compressor 02 — Nível de Óleo',
    trocaOleo1: 'Compressor 01 — Troca de Óleo',
    trocaOleo2: 'Compressor 02 — Troca de Óleo',
    linhaAr1: 'Pressão Linha de Ar — Comp. 01',
    linhaAr2: 'Pressão Linha de Ar — Comp. 02',
  }

  const allCompKeys = Array.from(new Set([...Object.keys(prevComp), ...Object.keys(nextComp)]))
  for (const k of allCompKeys) {
    if (normalizeCompare(prevComp[k]) !== normalizeCompare(nextComp[k])) {
      changes.push({
        field: `compressor_data.${k}`,
        label: compLabels[k] || `Compressor: ${k}`,
        previousValue: formatValueDisplay(prevComp[k]),
        newValue: formatValueDisplay(nextComp[k]),
        changedAt: now,
        changedBy,
        changedByName,
      })
    }
  }

  // Comparação granular de Remoção de Óleo
  const prevOil: Record<string, string> = snapshot.oil_removal_data || {}
  const nextOil: Record<string, string> = current.oil_removal_data || {}
  const oilLabels: Record<string, string> = {
    sao1Volume: 'SAO 01 — Volume de Óleo (mL)',
    sao1DataLimpeza: 'SAO 01 — Data da Limpeza',
    sao1Date: 'SAO 01 — Data da Limpeza',
    sao2Volume: 'SAO 02 — Volume de Óleo (mL)',
    sao2DataLimpeza: 'SAO 02 — Data da Limpeza',
    sao2Date: 'SAO 02 — Data da Limpeza',
  }

  const allOilKeys = Array.from(new Set([...Object.keys(prevOil), ...Object.keys(nextOil)]))
  for (const k of allOilKeys) {
    if (normalizeCompare(prevOil[k]) !== normalizeCompare(nextOil[k])) {
      changes.push({
        field: `oil_removal_data.${k}`,
        label: oilLabels[k] || `Remoção de Óleo: ${k}`,
        previousValue: formatValueDisplay(prevOil[k]),
        newValue: formatValueDisplay(nextOil[k]),
        changedAt: now,
        changedBy,
        changedByName,
      })
    }
  }

  return changes
}

// ==========================================
// 2. SNAPSHOT E COMPARAÇÃO DE RDO
// ==========================================

export const RDO_RETURN_OPTIONS = [
  { id: 'atividade', label: 'Título e Descrição das Atividades' },
  { id: 'horarios', label: 'Horários (Deslocamento / Espera)' },
  { id: 'interferencias', label: 'Interferências e Acidentes' },
  { id: 'mudancas_plano', label: 'Mudanças de Plano' },
  { id: 'pocos', label: 'Tabela de Poços' },
  { id: 'fotos', label: 'Fotografias e Legendas' },
  { id: 'clima_local', label: 'Clima e Localização' },
]

export function createRdoSnapshot(rdo: OfflineRdoItem): Record<string, any> {
  return {
    location: rdo.location || '',
    weather: rdo.weather || '',
    reportDate: rdo.reportDate || '',
    activityTitle: rdo.activityTitle || '',
    activityDescription: rdo.activityDescription || '',
    timeDisplacement: rdo.timeDisplacement || '',
    timeWaiting: rdo.timeWaiting || '',
    interferences: rdo.interferences || '',
    planChanges: rdo.planChanges || '',
    accidents: rdo.accidents || '',
    fieldPhotoCaption: rdo.fieldPhoto?.caption || '',
    hasFieldPhoto: Boolean(rdo.fieldPhoto?.dataUrl || rdo.fieldPhoto?.image),
    wells: JSON.parse(JSON.stringify(rdo.wells || [])),
    photosCount: (rdo.photos || []).length,
    photosCaptions: (rdo.photos || []).map((p) => p.caption || ''),
  }
}

export function diffRdo(
  snapshot: Record<string, any>,
  current: OfflineRdoItem,
  changedBy?: string,
  changedByName?: string,
): ChangeDetail[] {
  const changes: ChangeDetail[] = []
  const now = new Date().toISOString()

  const checkField = (key: keyof OfflineRdoItem, label: string) => {
    const prev = snapshot[key]
    const next = current[key]
    if (normalizeCompare(prev) !== normalizeCompare(next)) {
      changes.push({
        field: String(key),
        label,
        previousValue: formatValueDisplay(prev),
        newValue: formatValueDisplay(next),
        changedAt: now,
        changedBy,
        changedByName,
      })
    }
  }

  checkField('activityTitle', 'Título da Atividade')
  checkField('activityDescription', 'Descrição dos Serviços')
  checkField('location', 'Local da Obra')
  checkField('weather', 'Condições Climáticas')
  checkField('reportDate', 'Data do Relatório')
  checkField('timeDisplacement', 'Horário de Deslocamento')
  checkField('timeWaiting', 'Tempo de Espera')
  checkField('interferences', 'Interferências Encontradas')
  checkField('planChanges', 'Mudanças de Plano')
  checkField('accidents', 'Acidentes / Incidentes')

  // Foto de Campo / Local de Inspeção
  const prevHasFieldPhoto = Boolean(snapshot.hasFieldPhoto)
  const nextHasFieldPhoto = Boolean(current.fieldPhoto?.dataUrl || current.fieldPhoto?.image)
  if (prevHasFieldPhoto !== nextHasFieldPhoto) {
    changes.push({
      field: 'fieldPhoto',
      label: 'Foto do Campo / Local de Inspeção',
      previousValue: prevHasFieldPhoto ? 'Foto anexada' : 'Não preenchido',
      newValue: nextHasFieldPhoto ? 'Foto anexada' : 'Não preenchido',
      changedAt: now,
      changedBy,
      changedByName,
    })
  } else if (nextHasFieldPhoto) {
    const prevCaption = snapshot.fieldPhotoCaption || ''
    const nextCaption = current.fieldPhoto?.caption || ''
    if (normalizeCompare(prevCaption) !== normalizeCompare(nextCaption)) {
      changes.push({
        field: 'fieldPhoto.caption',
        label: 'Legenda da Foto do Campo',
        previousValue: formatValueDisplay(prevCaption),
        newValue: formatValueDisplay(nextCaption),
        changedAt: now,
        changedBy,
        changedByName,
      })
    }
  }

  // Poços
  const prevWells: Array<Record<string, any>> = snapshot.wells || []
  const nextWells: Array<Record<string, any>> = current.wells || []
  const maxWells = Math.max(prevWells.length, nextWells.length)

  for (let i = 0; i < maxWells; i++) {
    const p = prevWells[i]
    const n = nextWells[i]
    const wellId = n?.well_id || p?.well_id || `Poço ${i + 1}`

    if (!p && n) {
      changes.push({
        field: `wells[${i}]`,
        label: `Poço ${wellId} (Novo poço cadastrado)`,
        previousValue: 'Não preenchido',
        newValue: `Prof: ${n.depth || '—'}, Diâmetro: ${n.diameter || '—'}, Data: ${n.completion_date || '—'}`,
        changedAt: now,
        changedBy,
        changedByName,
      })
      continue
    }
    if (p && !n) {
      changes.push({
        field: `wells[${i}]`,
        label: `Poço ${wellId} (Poço removido)`,
        previousValue: `Prof: ${p.depth || '—'}, Diâmetro: ${p.diameter || '—'}, Data: ${p.completion_date || '—'}`,
        newValue: 'Não preenchido',
        changedAt: now,
        changedBy,
        changedByName,
      })
      continue
    }
    if (p && n) {
      if (normalizeCompare(p.well_id) !== normalizeCompare(n.well_id)) {
        changes.push({
          field: `wells[${i}].well_id`,
          label: `Identificação do Poço (Linha ${i + 1})`,
          previousValue: formatValueDisplay(p.well_id),
          newValue: formatValueDisplay(n.well_id),
          changedAt: now,
          changedBy,
          changedByName,
        })
      }
      if (normalizeCompare(p.depth) !== normalizeCompare(n.depth)) {
        changes.push({
          field: `wells[${wellId}].depth`,
          label: `Profundidade — ${wellId}`,
          previousValue: formatValueDisplay(p.depth),
          newValue: formatValueDisplay(n.depth),
          changedAt: now,
          changedBy,
          changedByName,
        })
      }
      if (normalizeCompare(p.diameter) !== normalizeCompare(n.diameter)) {
        changes.push({
          field: `wells[${wellId}].diameter`,
          label: `Diâmetro — ${wellId}`,
          previousValue: formatValueDisplay(p.diameter),
          newValue: formatValueDisplay(n.diameter),
          changedAt: now,
          changedBy,
          changedByName,
        })
      }
      if (normalizeCompare(p.completion_date) !== normalizeCompare(n.completion_date)) {
        changes.push({
          field: `wells[${wellId}].completion_date`,
          label: `Data de Finalização — ${wellId}`,
          previousValue: formatValueDisplay(p.completion_date),
          newValue: formatValueDisplay(n.completion_date),
          changedAt: now,
          changedBy,
          changedByName,
        })
      }
    }
  }

  // Fotos
  const prevCount = Number(snapshot.photosCount || 0)
  const nextCount = (current.photos || []).length
  if (prevCount !== nextCount) {
    changes.push({
      field: 'photos.count',
      label: 'Quantidade de Fotografias do Relatório',
      previousValue: `${prevCount} foto(s)`,
      newValue: `${nextCount} foto(s)`,
      changedAt: now,
      changedBy,
      changedByName,
    })
  }

  return changes
}

// ==========================================
// 3. GERENCIADOR DE CICLOS DE DEVOLUÇÃO
// ==========================================

export function appendOrUpdateReturnCycle(
  existingHistory: ReturnCycle[] | undefined,
  updatesOrCycleId?: string | Partial<ReturnCycle>,
  optionalUpdates?: Partial<ReturnCycle>,
): { history: ReturnCycle[]; activeCycleId: string } {
  let currentCycleId: string | undefined = undefined
  let updates: Partial<ReturnCycle> = {}

  if (typeof updatesOrCycleId === 'string') {
    currentCycleId = updatesOrCycleId
    updates = optionalUpdates || {}
  } else if (updatesOrCycleId !== undefined) {
    updates = updatesOrCycleId
  }
  const history: ReturnCycle[] = existingHistory ? [...existingHistory] : []
  let activeIndex = currentCycleId ? history.findIndex((c) => c.id === currentCycleId) : -1

  if (activeIndex === -1 && history.length > 0) {
    // Pega o ciclo mais recente se não foi informado explicitamente
    activeIndex = history.length - 1
  }

  if (activeIndex >= 0) {
    history[activeIndex] = {
      ...history[activeIndex],
      ...updates,
      changes: updates.changes !== undefined ? updates.changes : history[activeIndex].changes,
    }
    return { history, activeCycleId: history[activeIndex].id }
  }

  // Se não existe ciclo anterior, cria um novo
  const newCycle: ReturnCycle = {
    id: 'cycle_' + Date.now(),
    returnReason: updates.returnReason || 'Ajustes solicitados',
    returnedBy: updates.returnedBy,
    returnedByName: updates.returnedByName,
    returnedAt: updates.returnedAt || new Date().toISOString(),
    requestedFields: updates.requestedFields || [],
    requestedFieldsLabels: updates.requestedFieldsLabels || [],
    snapshot: updates.snapshot || {},
    changes: updates.changes || [],
    correctedBy: updates.correctedBy,
    correctedByName: updates.correctedByName,
    correctedAt: updates.correctedAt,
    submittedAt: updates.submittedAt,
  }
  history.push(newCycle)
  return { history, activeCycleId: newCycle.id }
}
