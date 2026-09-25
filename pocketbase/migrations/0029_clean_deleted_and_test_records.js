/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Remover fotos operacionais (report_photos) vinculadas aos relatórios de teste ou órfãs
    app.db().newQuery('DELETE FROM report_photos').execute()

    // 2. Remover poços de relatórios RDO (report_wells)
    app.db().newQuery('DELETE FROM report_wells').execute()

    // 3. Remover todos os RDOs (reports_rdo) criados nos testes (tanto soft-deleted quanto criados por admin/tecnico)
    app.db().newQuery('DELETE FROM reports_rdo').execute()

    // 4. Remover todas as Planilhas de Campo (field_spreadsheets) de testes (soft-deleted ou ativas)
    app.db().newQuery('DELETE FROM field_spreadsheets').execute()

    // 5. Remover poços de projetos excluídos (soft-deleted) para não deixar poços órfãos
    // Mantém intactos os poços dos projetos ativos (como o projeto "Remediação" da Vale)
    app
      .db()
      .newQuery(
        'DELETE FROM wells WHERE project IN (SELECT id FROM projects WHERE deleted = 1 OR deleted = true)',
      )
      .execute()

    // 6. Remover projetos marcados como excluídos (soft-delete)
    // Mantém intactos os projetos ativos com deleted = false
    app.db().newQuery('DELETE FROM projects WHERE deleted = 1 OR deleted = true').execute()

    // 7. Limpar logs de auditoria correspondentes a entidades operacionais excluídas e ações de soft-delete de testes
    app
      .db()
      .newQuery(
        "DELETE FROM audit_logs WHERE entity IN ('reports_rdo', 'field_spreadsheets', 'report_wells', 'report_photos')",
      )
      .execute()

    // 8. Atualizar timestamp de zeragem operacional em system_settings para sincronização com tablets/clientes offline
    const nowIso = new Date().toISOString()
    try {
      let settingsCol
      try {
        settingsCol = app.findCollectionByNameOrId('system_settings')
      } catch (_) {
        settingsCol = null
      }

      if (settingsCol) {
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
          'Timestamp ISO da limpeza final de testes e dados operacionais pré-produção',
        )
        app.save(settingRec)
      }
    } catch (setErr) {
      console.log('Erro ao atualizar last_operation_wipe_at:', setErr)
    }

    // 9. Registrar log de auditoria do expurgo pré-produção
    try {
      const logsCol = app.findCollectionByNameOrId('audit_logs')
      const purgeLog = new Record(logsCol)
      purgeLog.set('action', 'delete')
      purgeLog.set('entity', 'system_reset')
      purgeLog.set('entity_record', 'pre_production_cleanup')
      purgeLog.set('details', {
        reason:
          'Limpeza final do banco antes de entrada em produção (excluídos e registros de teste de admin/técnico)',
        cleaned_at: nowIso,
        cleaned_collections: [
          'reports_rdo',
          'field_spreadsheets',
          'report_wells',
          'report_photos',
          'projects (soft-deleted)',
          'wells (de projetos soft-deleted)',
        ],
      })
      app.save(purgeLog)
    } catch (logErr) {
      console.log('Erro ao salvar log de auditoria de pre_production_cleanup:', logErr)
    }
  },
  () => {
    // Não há como restaurar dados de teste expurgados no revert
  },
)
