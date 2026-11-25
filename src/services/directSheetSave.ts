// CORREÇÃO 1 — Gravação direta ao PocketBase ao Salvar/Finalizar a Planilha de Campo.
// O fluxo antigo gravava SOMENTE na fila offline (pending_create/pending_update) e
// dependia de syncNow disparado por focus/visibility — se nada disparasse, a ficha
// nunca chegava ao banco central. Aqui: quando há internet e sessão válida (ou
// recuperável via authRefresh), grava DIRETO no servidor com idempotência por
// client_token (mesma chave da fila); a fila continua como contingência offline.
//
// v0.0.175 — 404/401/403 num UPDATE de ID não-provisório = sessão rejeitada pelo
// servidor (o registro EXISTE, a regra falhou). Tratamento: authRefresh + retry ÚNICO
// antes de enfileirar. E 'synced' só é devolvido após CONFIRMAÇÃO POR RECONSULTA
// (getOne) — gravação confirmada pelo servidor, não apenas retorno 2xx do PATCH.
import pb from '@/lib/pocketbase/client'
import {
  isProvisionalId,
  sanitizeFieldSpreadsheetPayload,
  stripProtectedFieldsForUpdate,
} from '@/lib/payloadSanitizer'
import { offlineStorage, type OfflineFieldSheetItem } from '@/services/offlineStorage'
import { translateServerErrorMessage } from '@/context/SyncContext'

export interface DirectSaveOptions {
  isNew: boolean
  toast: (t: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
}

export type DirectSaveResult = 'synced' | 'queued' | 'blocked'

function errStatus(err: any): number {
  return err?.status ?? err?.statusCode ?? err?.response?.status ?? 0
}

async function tryAuthRefresh(): Promise<boolean> {
  try {
    await pb.collection('users').authRefresh()
    return true
  } catch (refreshErr) {
    console.warn('authRefresh falhou (sessão não recuperável):', refreshErr)
    return false
  }
}

async function confirmSheetOnServer(id: string): Promise<any | null> {
  try {
    // Confirmação por reconsulta: o registro precisa EXISTIR no servidor para que
    // o indicador local mostre "Sincronizado". Um 404 aqui é falha real.
    return await pb.collection('field_spreadsheets').getOne(id)
  } catch (confirmErr) {
    console.warn('Confirmação por reconsulta (getOne) falhou:', confirmErr)
    return null
  }
}

/**
 * Tenta gravar o item DIRETAMENTE no servidor. Em caso de sucesso confirmado por
 * reconsulta marca o item como 'synced' no cache offline e devolve 'synced'.
 * Em caso de falha de rede/servidor devolve 'queued' — o item segue para a fila
 * offline com o status pendente apropriado (nunca é descartado silenciosamente).
 */
export async function directSaveSheetToServer(
  item: OfflineFieldSheetItem,
  opts: DirectSaveOptions,
): Promise<DirectSaveResult> {
  // 1. Gate de sessão: se o authStore expirou, tenta renovar antes de desistir.
  let sessionOk = pb.authStore.isValid
  if (!sessionOk && navigator.onLine) {
    sessionOk = await tryAuthRefresh()
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
        // Atribuição de técnicos (admins gravam a lista; técnico preserva a que veio)
        ...(Array.isArray(item.assigned_technicians) && item.assigned_technicians.length > 0
          ? { assigned_technicians: item.assigned_technicians }
          : {}),
        ...(item.admin_snapshot ? { admin_snapshot: item.admin_snapshot } : {}),
        // Snapshot da Configuração de Áreas (migração 0046): viaja no create para que
        // o bloqueio condicional por preset sobreviva a salvar/sincronizar/reabrir
        ...(item.area_config_snapshot ? { area_config_snapshot: item.area_config_snapshot } : {}),
      }

      const sanitized = sanitizeFieldSpreadsheetPayload(payload)
      delete (sanitized as any).id // nenhum id provisório pode ir no create
      // O número sequencial é calculado PELO SERVIDOR (hook sequential_number_and_timestamps),
      // com idempotência por client_token — o cliente NUNCA envia number no create.
      const created = await pb.collection('field_spreadsheets').create(sanitized)

      // CONFIRMAÇÃO POR RECONSULTA: 'synced' só após reler o registro do servidor.
      const confirmed = await confirmSheetOnServer(created.id)
      if (!confirmed) {
        throw Object.assign(new Error('Falha ao confirmar gravação no servidor'), { status: 0 })
      }

      // Adoção atômica do ID oficial do servidor no cache offline
      const oldId = item.id
      await offlineStorage.deleteFieldSheet(oldId)
      item.id = confirmed.id
      item.number = confirmed.number
      item.submittedAt =
        confirmed.submitted_at || (confirmed.status === 'submitted' ? confirmed.updated : undefined)
      item.approvedAt =
        confirmed.approved_at || (confirmed.status === 'approved' ? confirmed.updated : undefined)
      item.returnedAt =
        confirmed.returned_at || (confirmed.status === 'returned' ? confirmed.updated : undefined)
      item.serverCreatedAt = confirmed.created
      item.serverUpdatedAt = confirmed.updated
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
        // Snapshot da Configuração de Áreas (migração 0046): viaja no update para que
        // o bloqueio condicional por preset sobreviva a salvar/sincronizar/reabrir
        ...(item.area_config_snapshot ? { area_config_snapshot: item.area_config_snapshot } : {}),
      }
      if (item.projectId && item.projectId.trim()) {
        payload.project = item.projectId
      }
      // Atribuição de técnicos: o técnico NUNCA envia o campo (a API rule de update
      // o protege de qualquer forma, e um array vazio apagaria a lista do Admin).
      // O Admin envia sempre — inclusive lista vazia, para poder remover todos.
      const authRole = (pb.authStore.model as any)?.role
      if (authRole === 'admin') {
        payload.assigned_technicians = Array.isArray(item.assigned_technicians)
          ? item.assigned_technicians
          : []
      } else if (Array.isArray(item.assigned_technicians) && item.assigned_technicians.length > 0) {
        payload.assigned_technicians = item.assigned_technicians
      }

      // CORREÇÃO RAIZ 404: a API rule de UPDATE exige que o corpo NÃO contenha
      // project/deleted*/archived — strip antes de enviar (tentativa inicial E retry).
      const sanitized = stripProtectedFieldsForUpdate(sanitizeFieldSpreadsheetPayload(payload))
      let updated: any
      try {
        updated = await pb.collection('field_spreadsheets').update(item.id, sanitized)
      } catch (upErr: any) {
        const status = errStatus(upErr)
        // 404/401/403 num ID não-provisório = sessão rejeitada pelo servidor
        // (o token local parece válido mas o servidor o recusa) — a evidência
        // real do bug: 6 PATCH 404 seguidos num registro que EXISTE no banco.
        if ((status === 404 || status === 401 || status === 403) && !isProvisionalId(item.id)) {
          console.warn(
            `PATCH ${status} em update direto — renovando sessão e repetindo UMA vez:`,
            upErr,
          )
          const refreshed = await tryAuthRefresh()
          if (!refreshed) throw upErr
          updated = await pb.collection('field_spreadsheets').update(item.id, sanitized)
        } else {
          throw upErr
        }
      }

      // CONFIRMAÇÃO POR RECONSULTA: 'synced' só após reler o registro do servidor.
      const confirmed = await confirmSheetOnServer(item.id)
      if (!confirmed) {
        throw Object.assign(new Error('Falha ao confirmar gravação no servidor'), { status: 0 })
      }

      if (confirmed.number) item.number = confirmed.number
      if (confirmed.submitted_at) item.submittedAt = confirmed.submitted_at
      if (confirmed.approved_at) item.approvedAt = confirmed.approved_at
      if (confirmed.returned_at) item.returnedAt = confirmed.returned_at
      if (confirmed.created) item.serverCreatedAt = confirmed.created
      item.syncStatus = 'synced'
      item.serverUpdatedAt = confirmed.updated
      delete item.syncError
      item.syncAttempts = 0
      await offlineStorage.saveFieldSheet(item)
      return 'synced'
    }
  } catch (err: any) {
    // Falhou rede/servidor/validação: NUNCA descartar — item cai na fila offline.
    console.warn('Gravação direta ao servidor falhou; enfileirando para retry:', err)
    item.syncStatus = isProvisionalId(item.id) ? 'pending_create' : 'pending_update'
    const status = errStatus(err)
    if (status === 400 || status === 0) {
      // 400 é erro de payload (não rede): guardamos a mensagem amigável para o painel de falhas.
      // status 0 = falha de confirmação (getOne não leu de volta) — mesma pista de sessão.
      const friendly = translateServerErrorMessage(err, 'field')
      item.syncError =
        (friendly || err?.message || 'erro de validação') +
        ' (o registro segue na fila e será reenviado)'
      item.syncAttempts = (item.syncAttempts || 0) + 1
    } else if (status === 401 || status === 403) {
      // Falha de sessão/autorização após o retry — orientar o usuário a relogar.
      item.syncError =
        'Não foi possível confirmar no servidor (falha de sessão/autorização). Faça login novamente se persistir.'
      item.syncAttempts = (item.syncAttempts || 0) + 1
    } else if (status === 404) {
      item.syncError =
        'Não foi possível confirmar no servidor (registro não localizado). A ficha segue na fila e será reenviada.'
      item.syncAttempts = (item.syncAttempts || 0) + 1
    }
    opts.toast({
      title: status === 401 || status === 403 ? 'Falha de sessão no servidor' : 'Salvo localmente',
      description:
        status === 401 || status === 403
          ? 'Não foi possível confirmar no servidor — faça login novamente se persistir. A ficha foi gravada no dispositivo e seguirá na fila de sincronização.'
          : 'Salvo localmente, será sincronizado. A ficha foi gravada no dispositivo e será reenviada automaticamente.',
      variant: 'destructive',
    })
    return 'queued'
  }
}
