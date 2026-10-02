/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Apagar DEFINITIVAMENTE (hard delete) TODOS os registros da coleção audit_logs existentes
    // O usuário solicitou zerar completamente para começar a ver as ações reais.
    app.db().newQuery('DELETE FROM audit_logs').execute()

    // 2. Atualizar o parâmetro de controle last_operation_wipe_at em system_settings
    // para proteger tablets e clientes offline de re-sincronização de dados passados
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
          'Timestamp ISO do expurgo geral dos logs de auditoria e zeragem operacional',
        )
        app.save(settingRec)
      }
    } catch (setErr) {
      console.log('Erro ao atualizar last_operation_wipe_at:', setErr)
    }

    // 3. Registrar um único log auditável do expurgo definitivo realizado,
    // garantindo rastreabilidade institucional sem poluir com registros fictícios.
    try {
      const logsCol = app.findCollectionByNameOrId('audit_logs')
      if (logsCol) {
        const purgeLog = new Record(logsCol)
        purgeLog.set('action', 'delete')
        purgeLog.set('entity', 'system_reset')
        purgeLog.set('entity_record', 'audit_logs_wipe')
        purgeLog.set('details', {
          label: 'Expurgo definitivo do histórico de logs de auditoria',
          reason:
            'Solicitação do usuário: zerar logs de auditoria para começar a registrar apenas ações reais',
          wiped_at: nowIso,
          server_timestamp: nowIso,
        })
        app.save(purgeLog)
      }
    } catch (logErr) {
      console.log('Erro ao registrar log de auditoria do expurgo:', logErr)
    }
  },
  (app) => {
    // Operação irreversível (hard delete solicitado pelo usuário)
  },
)
