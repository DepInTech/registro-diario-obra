// CORREÇÃO 1 — Gravação direta ao PocketBase ao Salvar/Finalizar a Planilha de Campo.
// O fluxo antigo gravava SOMENTE na fila offline (pending_create/pending_update) e
// dependia de syncNow disparado por focus/visibility — se nada disparasse, a ficha
// nunca chegava ao banco central. Aqui: quando há internet e sessão válida (ou
// recuperável via authRefresh), grava DIRETO no servidor com idempotência por
// client_token (mesma chave da fila); a fila continua como contingência offline.
import pb from '@/lib/pocketbase/client'
import { isProvisionalId, sanitizeFieldSpreadsheetPayload } from '@/lib/payloadSanitizer'
import { offlineStorage, type OfflineFieldSheetItem } from '@/services/offlineStorage'
import { translateServerErrorMessage } from '@/context/SyncContext'

export interface DirectSaveOptions {
  isNew: boolean
  toast: (t: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
}

export type DirectSaveResult = 'synced' | 'queued' | 'blocked'

/**
 * Tenta gravar o item DIRETAMENTE no servidor. Em caso de sucesso marca o item
 * como 'synced' no cache offline e devolve 'synced'. Em caso de falha de
 * rede/servidor/devolve 'queued' — o item segue para a fila offline com o status
 * pendente apropriado (nunca é descartado silenciosamente).
 */
export async function directSaveSheetToServer(
  item: OfflineFieldSheetItem,
  opts: DirectSaveOptions,
): Promise<DirectSaveResult> {
  // 1. Gate de sessão: se o authStore expirou, tenta renovar antes de desistir.
  let sessionOk = pb.authStore.isValid
  if (!sessionOk && navigator.onLine) {
    try {
      await pb.collection('users').authRefresh()
      sessionOk = true
    } catch {
      sessionOk = false
    }
  }

  // 2. Sem rede ou sem sessão recuperável: cai no caminho da fila offline atual.
  if (!navigator.onLine || !sessionOk) {
    item.syncStatus = isProvisionalId(item.id) ? 'pending_create' : 'pending_update'
    return 'queued'
  }

  try {
    if (isProvisionalId(item.id)) {
      // ----- CREATE direto com idempotência por client_token -----
      // Mesmo token usado pela fila em syncNow ('sheet_${id}') — se a fila já
      // tiver criado o registro em outra janela, aqui apenas ADOPTAMOS o ID do
      // servidor em vez de duplicar.
      const clientToken = item.client_token || `sheet_${item.id}`
      item.client_token = clientToken

      let existing: any = null
      try {
        existing = await pb
          .collection('field_spreadsheets')
          .getFirstListItem(`client_token = "${clientToken}"`)
      } catch {
        // não existe ainda no servidor — prossegue com a criação
      }

      if (existing) {
        // Já sincronizado por outra janela: adota o ID do servidor, nada a criar.
        await offlineStorage.deleteFieldSheet(item.id)
        item.id = existing.id
        item.number = existing.number
        item.syncStatus = 'synced'
        item.serverUpdatedAt = existing.updated
        delete item.syncError
        item.syncAttempts = 0
        await offlineStorage.saveFieldSheet(item)
        return 'synced'
      }

      const payload: Record<string, unknown> = {
        project: item.projectId,
        operator: item.operator,
        date: item.date,
        area: item.area || 'Geral',
        weather: item.weather || 'Sol',
        pluviometer:
          item.pluviometer === null || item.pluviometer === undefined
            ? ''
            : String(item.pluviometer),
        morning_time: item.morning_time || '',
        afternoon_time: item.afternoon_time || '',
        infiltration_morning_time: item.infiltration_morning_time || '',
        infiltration_afternoon_time: item.infiltration_afternoon_time || '',
        extraction_data: item.extraction_data || [],
        infiltration_data: item.infiltration_data || {},
        nutrient_done: Boolean(item.nutrient_done),
        nutrient_map_kg:
          item.nutrient_map_kg === null || item.nutrient_map_kg === undefined
            ? ''
            : String(item.nutrient_map_kg),
        nutrient_ureia_kg:
          item.nutrient_ureia_kg === null || item.nutrient_ureia_kg === undefined
            ? ''
            : String(item.nutrient_ureia_kg),
        compressor_data: item.compressor_data || {},
        oil_removal_data: item.oil_removal_data || {},
        waste_liquid_qty:
          item.waste_liquid_qty === null || item.waste_liquid_qty === undefined
            ? ''
            : String(item.waste_liquid_qty),
        waste_solid_qty:
          item.waste_solid_qty === null || item.waste_solid_qty === undefined
            ? ''
            : String(item.waste_solid_qty),
        env_5s_check: Boolean(item.env_5s_check),
        env_checklist_monthly: Boolean(item.env_checklist_monthly),
        observations: item.observations || '',
        status: item.status || 'draft',
        review_notes: item.reviewNotes || '',
        returned_fields: item.returned_fields || [],
        change_history: item.change_history || [],
        archived: Boolean(item.archived),
        deleted: Boolean(item.deleted),
        deleted_reason: item.deletedReason || '',
        deleted_by: item.deletedBy || undefined,
        deleted_at: item.deletedAt || undefined,
        client_token: clientToken,
        ...(item.admin_snapshot ? { admin_snapshot: item.admin_snapshot } : {}),
      }

      const sanitized = sanitizeFieldSpreadsheetPayload(payload)
      delete (sanitized as any).id // nenhum id provisório pode ir no create
      // O número sequencial é calculado PELO SERVIDOR (hook sequential_number_and_timestamps),
      // com idempotência por client_token — o cliente NUNCA envia number no create.
      const created = await pb.collection('field_spreadsheets').create(sanitized)

      // Adoção atômica do ID oficial do servidor no cache offline
      const oldId = item.id
      await offlineStorage.deleteFieldSheet(oldId)
      item.id = created.id
      item.number = created.number
      item.submittedAt =
        created.submitted_at || (created.status === 'submitted' ? created.updated : undefined)
      item.approvedAt =
        created.approved_at || (created.status === 'approved' ? created.updated : undefined)
      item.returnedAt =
        created.returned_at || (created.status === 'returned' ? created.updated : undefined)
      item.serverCreatedAt = created.created
      item.serverUpdatedAt = created.updated
      item.syncStatus = 'synced'
      delete item.syncError
      item.syncAttempts = 0
      await offlineStorage.saveFieldSheet(item)
      return 'synced'
    } else {
      // ----- UPDATE direto do registro existente no servidor -----
      const payload: Record<string, unknown> = {
        operator: item.operator,
        date: item.date,
        area: item.area || 'Geral',
        weather: item.weather || 'Sol',
        pluviometer:
          item.pluviometer === null || item.pluviometer === undefined
            ? ''
            : String(item.pluviometer),
        morning_time: item.morning_time || '',
        afternoon_time: item.afternoon_time || '',
        infiltration_morning_time: item.infiltration_morning_time || '',
        infiltration_afternoon_time: item.infiltration_afternoon_time || '',
        extraction_data: item.extraction_data || [],
        infiltration_data: item.infiltration_data || {},
        nutrient_done: Boolean(item.nutrient_done),
        nutrient_map_kg:
          item.nutrient_map_kg === null || item.nutrient_map_kg === undefined
            ? ''
            : String(item.nutrient_map_kg),
        nutrient_ureia_kg:
          item.nutrient_ureia_kg === null || item.nutrient_ureia_kg === undefined
            ? ''
            : String(item.nutrient_ureia_kg),
        compressor_data: item.compressor_data || {},
        oil_removal_data: item.oil_removal_data || {},
        waste_liquid_qty:
          item.waste_liquid_qty === null || item.waste_liquid_qty === undefined
            ? ''
            : String(item.waste_liquid_qty),
        waste_solid_qty:
          item.waste_solid_qty === null || item.waste_solid_qty === undefined
            ? ''
            : String(item.waste_solid_qty),
        env_5s_check: Boolean(item.env_5s_check),
        env_checklist_monthly: Boolean(item.env_checklist_monthly),
        observations: item.observations || '',
        status: item.status,
        review_notes: item.reviewNotes || '',
        returned_fields: item.returned_fields || [],
        change_history: item.change_history || [],
        archived: Boolean(item.archived),
        deleted: Boolean(item.deleted),
        deleted_reason: item.deletedReason || '',
        deleted_by: item.deletedBy || undefined,
        deleted_at: item.deletedAt || undefined,
        ...(item.admin_snapshot ? { admin_snapshot: item.admin_snapshot } : {}),
      }
      if (item.projectId && item.projectId.trim()) {
        payload.project = item.projectId
      }

      const sanitized = sanitizeFieldSpreadsheetPayload(payload)
      const updated = await pb.collection('field_spreadsheets').update(item.id, sanitized)

      if (updated.number) item.number = updated.number
      if (updated.submitted_at) item.submittedAt = updated.submitted_at
      if (updated.approved_at) item.approvedAt = updated.approved_at
      if (updated.returned_at) item.returnedAt = updated.returned_at
      if (updated.created) item.serverCreatedAt = updated.created
      item.syncStatus = 'synced'
      item.serverUpdatedAt = updated.updated
      delete item.syncError
      item.syncAttempts = 0
      await offlineStorage.saveFieldSheet(item)
      return 'synced'
    }
  } catch (err: any) {
    // Falhou rede/servidor/validação: NUNCA descartar — item cai na fila offline.
    console.warn('Gravação direta ao servidor falhou; enfileirando para retry:', err)
    item.syncStatus = isProvisionalId(item.id) ? 'pending_create' : 'pending_update'
    if (err?.status === 400 || err?.statusCode === 400) {
      // 400 é erro de payload (não rede): guardamos a mensagem amigável para o painel de falhas.
      const friendly = translateServerErrorMessage(err, 'field')
      item.syncError =
        (friendly || err?.message || 'erro de validação') +
        ' (o registro segue na fila e será reenviado)'
      item.syncAttempts = (item.syncAttempts || 0) + 1
    }
    opts.toast({
      title: 'Salvo localmente',
      description:
        'Sem comunicação com o servidor no momento. A ficha foi gravada no dispositivo e será sincronizada automaticamente.',
      variant: 'destructive',
    })
    return 'queued'
  }
}
