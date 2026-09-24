onRecordAfterCreateSuccess(
  (e) => {
    // 1. Sempre prossegue com a cadeia do hook primeiro
    try {
      e.next()
    } catch (_) {}

    // 2. Blindagem total da auditoria assíncrona: executada fora da transação principal,
    // nenhuma falha aqui pode derrubar a criação nem gerar locks
    try {
      if (!e.record) return
      const logs = $app.findCollectionByNameOrId('audit_logs')
      if (!logs) return

      // Obter ator: e.auth (se presente no contexto da requisição) ou campos do próprio registro
      let actorId = ''
      try {
        if (e.auth && e.auth.id) {
          actorId = e.auth.id
        }
      } catch (_) {}

      if (!actorId) {
        try {
          actorId =
            e.record.getString('user') ||
            e.record.getString('created_by') ||
            e.record.getString('technician') ||
            ''
        } catch (_) {}
      }

      const log = new Record(logs)
      if (actorId) {
        log.set('actor', actorId)
      }
      log.set('action', 'create')
      const entity = e.record?.collection()?.name || 'unknown'
      log.set('entity', entity)
      log.set('entity_record', e.record?.id || '')
      let label = ''
      try {
        label =
          e.record.getString('name') ||
          e.record.getString('code') ||
          e.record.getString('activity_title') ||
          e.record.id
      } catch (_) {
        label = e.record?.id || ''
      }

      try {
        if (entity === 'reports_rdo') {
          const num = e.record.getInt('number')
          const act = e.record.getString('activity_title') || 'Sem título'
          label = `RDO Nº ${num > 0 ? num : e.record.id} · ${act}`
        } else if (entity === 'field_spreadsheets') {
          const num = e.record.getInt('number')
          const dt = e.record.getString('date') ? e.record.getString('date').slice(0, 10) : ''
          const area = e.record.getString('area') || ''
          label = `Planilha Nº ${num > 0 ? num : e.record.id} · ${dt} (${area})`
        }
      } catch (_) {}

      log.set('details', {
        label: label,
        server_timestamp: new Date().toISOString(),
      })
      $app.save(log)
    } catch (error) {
      console.warn('audit create (falha graciosa ignorada):', error)
    }
  },
  'clients',
  'companies',
  'areas',
  'contracts',
  'projects',
  'wells',
  'reports_rdo',
  'report_wells',
  'report_photos',
  'field_spreadsheets',
  'users',
)
