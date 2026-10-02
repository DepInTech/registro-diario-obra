/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Remover permanentemente as 3 planilhas soft-deletadas de campo
    // IDs identificados: 'n8gmjez4a6wpwrp' (Nº 1), 'ukmzt4m8la0p5wb' (Nº 2), 'yxvdhtmzd7kgu9b' (Nº 3)
    app
      .db()
      .newQuery(
        "DELETE FROM field_spreadsheets WHERE deleted = 1 OR deleted = true OR id IN ('n8gmjez4a6wpwrp', 'ukmzt4m8la0p5wb', 'yxvdhtmzd7kgu9b')",
      )
      .execute()

    // 2. Limpar logs de auditoria órfãos ligados a essas planilhas excluídas
    app
      .db()
      .newQuery(
        "DELETE FROM audit_logs WHERE entity = 'field_spreadsheets' AND entity_record IN ('n8gmjez4a6wpwrp', 'ukmzt4m8la0p5wb', 'yxvdhtmzd7kgu9b')",
      )
      .execute()

    // 3. Atualizar last_operation_wipe_at para alertar clientes e evitar anti-ressincronização de cache offline antigo
    const nowIso = new Date().toISOString()
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
          'Timestamp ISO da exclusão definitiva das planilhas de campo desativadas',
        )
        app.save(settingRec)
      }
    } catch (setErr) {
      console.log('Erro ao atualizar last_operation_wipe_at:', setErr)
    }

    // 4. Registrar log de auditoria da exclusão definitiva das planilhas
    try {
      const logsCol = app.findCollectionByNameOrId('audit_logs')
      const purgeLog = new Record(logsCol)
      purgeLog.set('action', 'delete')
      purgeLog.set('entity', 'field_spreadsheets')
      purgeLog.set('entity_record', 'hard_delete_purged')
      purgeLog.set('details', {
        label: 'Exclusão definitiva das 3 planilhas de campo desativadas (Nº 1, 2 e 3)',
        reason: 'Solicitação do usuário: apagar as três planilhas excluídas definitivamente',
        purged_ids: ['n8gmjez4a6wpwrp', 'ukmzt4m8la0p5wb', 'yxvdhtmzd7kgu9b'],
        purged_at: nowIso,
      })
      app.save(purgeLog)
    } catch (logErr) {
      console.log('Erro ao registrar log de auditoria do expurgo de planilhas:', logErr)
    }
  },
  (app) => {
    // Operação irreversível (hard delete)
  },
)
