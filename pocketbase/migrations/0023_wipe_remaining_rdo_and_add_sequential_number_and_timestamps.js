migrate(
  (app) => {
    // 1. Limpar integralmente qualquer RDO, planilha, poços de relatório e fotos restantes
    app.db().newQuery('DELETE FROM report_photos').execute()
    app.db().newQuery('DELETE FROM report_wells').execute()
    app.db().newQuery('DELETE FROM reports_rdo').execute()
    app.db().newQuery('DELETE FROM field_spreadsheets').execute()

    // 2. Limpar logs de auditoria correspondentes a entidades operacionais excluídas
    app
      .db()
      .newQuery(
        "DELETE FROM audit_logs WHERE entity IN ('reports_rdo', 'field_spreadsheets', 'report_wells', 'report_photos')",
      )
      .execute()

    // 3. Atualizar last_operation_wipe_at em system_settings com timestamp agora
    const nowIso = new Date().toISOString()
    try {
      const settingsCol = app.findCollectionByNameOrId('system_settings')
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
      console.log('Erro ao atualizar last_operation_wipe_at:', setErr)
    }

    // 4. Registrar log de auditoria no servidor do reset operacional definitivo
    try {
      const logsCol = app.findCollectionByNameOrId('audit_logs')
      const resetLog = new Record(logsCol)
      resetLog.set('action', 'delete')
      resetLog.set('entity', 'system_reset')
      resetLog.set('entity_record', 'operation_reset')
      resetLog.set('details', {
        reason: 'Zeragem operacional definitiva solicitada pelo usuário (RDOs e Planilhas)',
        wiped_at: nowIso,
        collections_wiped: ['reports_rdo', 'field_spreadsheets', 'report_wells', 'report_photos'],
      })
      app.save(resetLog)
    } catch (logErr) {
      console.log('Erro ao salvar log de reset:', logErr)
    }

    // 5. Adicionar campos de data/hora sincronizados (submitted_at, approved_at, returned_at) em reports_rdo
    const reportsCol = app.findCollectionByNameOrId('reports_rdo')
    if (!reportsCol.fields.getByName('submitted_at')) {
      reportsCol.fields.add(new DateField({ name: 'submitted_at' }))
    }
    if (!reportsCol.fields.getByName('approved_at')) {
      reportsCol.fields.add(new DateField({ name: 'approved_at' }))
    }
    if (!reportsCol.fields.getByName('returned_at')) {
      reportsCol.fields.add(new DateField({ name: 'returned_at' }))
    }
    app.save(reportsCol)

    // 6. Adicionar campo number (numeração sequencial) e campos de data/hora (submitted_at, approved_at, returned_at) em field_spreadsheets
    const sheetsCol = app.findCollectionByNameOrId('field_spreadsheets')
    if (!sheetsCol.fields.getByName('number')) {
      sheetsCol.fields.add(new NumberField({ name: 'number', onlyInt: true, min: 1 }))
    }
    if (!sheetsCol.fields.getByName('submitted_at')) {
      sheetsCol.fields.add(new DateField({ name: 'submitted_at' }))
    }
    if (!sheetsCol.fields.getByName('approved_at')) {
      sheetsCol.fields.add(new DateField({ name: 'approved_at' }))
    }
    if (!sheetsCol.fields.getByName('returned_at')) {
      sheetsCol.fields.add(new DateField({ name: 'returned_at' }))
    }
    app.save(sheetsCol)
  },
  (app) => {
    // Reverter campos adicionados se necessário
    try {
      const reportsCol = app.findCollectionByNameOrId('reports_rdo')
      const sub = reportsCol.fields.getByName('submitted_at')
      if (sub) reportsCol.fields.removeById(sub.id)
      const appField = reportsCol.fields.getByName('approved_at')
      if (appField) reportsCol.fields.removeById(appField.id)
      const ret = reportsCol.fields.getByName('returned_at')
      if (ret) reportsCol.fields.removeById(ret.id)
      app.save(reportsCol)
    } catch (_) {}

    try {
      const sheetsCol = app.findCollectionByNameOrId('field_spreadsheets')
      const num = sheetsCol.fields.getByName('number')
      if (num) sheetsCol.fields.removeById(num.id)
      const sub = sheetsCol.fields.getByName('submitted_at')
      if (sub) sheetsCol.fields.removeById(sub.id)
      const appField = sheetsCol.fields.getByName('approved_at')
      if (appField) sheetsCol.fields.removeById(appField.id)
      const ret = sheetsCol.fields.getByName('returned_at')
      if (ret) sheetsCol.fields.removeById(ret.id)
      app.save(sheetsCol)
    } catch (_) {}
  },
)
