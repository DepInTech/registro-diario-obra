migrate(
  (app) => {
    // 1. Apagar registros dependentes primeiro para respeitar integridade referencial:
    // a) report_photos
    app.db().newQuery('DELETE FROM report_photos').execute()

    // b) report_wells
    app.db().newQuery('DELETE FROM report_wells').execute()

    // 2. Apagar RDOs (reports_rdo) em qualquer status (inclusive arquivados e soft-deleted)
    app.db().newQuery('DELETE FROM reports_rdo').execute()

    // 3. Apagar Planilhas de Campo (field_spreadsheets) em qualquer status (inclusive arquivadas e soft-deleted)
    app.db().newQuery('DELETE FROM field_spreadsheets').execute()

    // 4. Limpar logs de auditoria correspondentes a essas entidades operacionais apagadas
    app
      .db()
      .newQuery(
        "DELETE FROM audit_logs WHERE entity IN ('reports_rdo', 'field_spreadsheets', 'report_wells', 'report_photos')",
      )
      .execute()

    // 5. Registrar log de auditoria com a data do reset do sistema
    const nowIso = new Date().toISOString()
    try {
      const logsCol = app.findCollectionByNameOrId('audit_logs')
      const resetLog = new Record(logsCol)
      resetLog.set('action', 'delete')
      resetLog.set('entity', 'system_reset')
      resetLog.set('entity_record', 'operation_reset')
      resetLog.set('details', {
        reason:
          'Zerar operacao solicitado pelo usuario (exclusao total de RDOs, Planilhas de Campo, fotos e registros dependentes)',
        wiped_at: nowIso,
        collections_wiped: ['reports_rdo', 'field_spreadsheets', 'report_wells', 'report_photos'],
      })
      app.save(resetLog)
    } catch (e) {
      console.log('Nao foi possivel gravar log de auditoria do reset:', e)
    }

    // 6. Criar ou atualizar a coleção system_settings para guardar a data de zeragem operacional
    let settingsCol
    try {
      settingsCol = app.findCollectionByNameOrId('system_settings')
    } catch (_) {
      settingsCol = new Collection({
        name: 'system_settings',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'key', type: 'text', required: true },
          { name: 'value', type: 'text' },
          { name: 'description', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_system_settings_key ON system_settings (key)'],
      })
      app.save(settingsCol)
    }

    // Gravar a data de zeragem da operação no system_settings
    try {
      let settingRec
      try {
        settingRec = app.findFirstRecordByData('system_settings', 'key', 'last_operation_wipe_at')
      } catch (_) {
        settingRec = new Record(settingsCol)
        settingRec.set('key', 'last_operation_wipe_at')
      }
      settingRec.set('value', nowIso)
      settingRec.set(
        'description',
        'Timestamp ISO da última zeragem operacional completa (RDOs e Planilhas)',
      )
      app.save(settingRec)
    } catch (setErr) {
      console.log('Erro ao salvar last_operation_wipe_at:', setErr)
    }
  },
  (app) => {
    // Reverter criação de system_settings se necessário
    try {
      const settingsCol = app.findCollectionByNameOrId('system_settings')
      app.delete(settingsCol)
    } catch (_) {}
  },
)
