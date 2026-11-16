/// <reference path="../pb_data/types.d.ts" />

// v0.0.157 — Expurgo DEFINITIVO de TODAS as Planilhas de Campo (ativas e excluídas)
// Solicitação do Admin: zerar os dados de teste para início do uso real.
// - Hard delete de TODOS os registros de field_spreadsheets, em qualquer status
//   (draft/submitted/approved/returned, ativas, arquivadas ou soft-deleted).
// - Limpeza dos logs de auditoria órfãos referentes a essas planilhas.
// - Registro de um ÚNICO log de expurgo descrevendo a solicitação do Admin.
// - Atualização de last_operation_wipe_at para que tablets com cache IndexedDB
//   não re-sincronizem as planilhas apagadas de volta ao servidor.
migrate(
  (app) => {
    const nowIso = new Date().toISOString()

    // 1. Hard delete: TODAS as planilhas de campo, ativas ou soft-deleted
    app.db().newQuery('DELETE FROM field_spreadsheets').execute()

    // 2. Limpar logs de auditoria órfãos das planilhas de campo
    //    (executado ANTES de inserir o log de expurgo, para que ele não seja apagado)
    app.db().newQuery("DELETE FROM audit_logs WHERE entity = 'field_spreadsheets'").execute()

    // 3. Atualizar o parâmetro de zeragem (mecanismo anti-ressincronização já consumido
    //    por SyncContext, FieldSpreadsheets, Rdos e Dashboard via purgePreWipeOperationalData)
    try {
      let settingsCol = null
      try {
        settingsCol = app.findCollectionByNameOrId('system_settings')
      } catch (_) {}

      if (settingsCol) {
        let settingRec = null
        try {
          settingRec = app.findFirstRecordByData('system_settings', 'key', 'last_operation_wipe_at')
        } catch (_) {
          settingRec = new Record(settingsCol)
          settingRec.set('key', 'last_operation_wipe_at')
        }
        settingRec.set('value', nowIso)
        settingRec.set(
          'description',
          'Timestamp ISO da zeragem definitiva das Planilhas de Campo (ativas e excluídas)',
        )
        app.save(settingRec)
      }
    } catch (setErr) {
      console.log('Erro ao atualizar last_operation_wipe_at:', setErr)
    }

    // 4. Registrar log único de expurgo da coleção de Planilhas de Campo
    try {
      const logsCol = app.findCollectionByNameOrId('audit_logs')
      const purgeLog = new Record(logsCol)
      purgeLog.set('action', 'delete')
      purgeLog.set('entity', 'system_reset')
      purgeLog.set('entity_record', 'field_spreadsheets_wipe')
      purgeLog.set('details', {
        label: 'Expurgo definitivo das Planilhas de Campo (ativas e excluídas)',
        reason:
          'Solicitação do Admin: apagar todas as Planilhas de Campo definitivamente (dados de teste) para início do uso real',
        purged_collection: 'field_spreadsheets',
        purged_at: nowIso,
        server_timestamp: nowIso,
      })
      app.save(purgeLog)
    } catch (logErr) {
      console.log('Erro ao registrar log de expurgo das planilhas de campo:', logErr)
    }
  },
  (app) => {
    // Operação irreversível (hard delete) — sem rollback
  },
)
