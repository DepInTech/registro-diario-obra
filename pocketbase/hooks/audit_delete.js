onRecordAfterDeleteSuccess(
  (e) => {
    try {
      e.next()
    } catch (_) {}

    try {
      if (!e.record) return
      const logs = $app.findCollectionByNameOrId('audit_logs')
      if (!logs) return

      let actorId = ''
      try {
        if (e.auth && e.auth.id) {
          actorId = e.auth.id
        }
      } catch (_) {}

      if (!actorId) {
        try {
          actorId =
            e.record.getString('deleted_by') ||
            e.record.getString('user') ||
            e.record.getString('created_by') ||
            e.record.getString('technician') ||
            ''
        } catch (_) {}
      }

      const entity = e.record.collection().name
      const recordId = e.record.id
      let label = ''
      try {
        label =
          e.record.getString('name') ||
          e.record.getString('code') ||
          e.record.getString('activity_title') ||
          recordId
      } catch (_) {
        label = recordId
      }

      try {
        if (entity === 'reports_rdo') {
          const num = e.record.getInt('number')
          const act = e.record.getString('activity_title') || 'Sem título'
          label = `RDO Nº ${num > 0 ? num : recordId} · ${act}`
        } else if (entity === 'field_spreadsheets') {
          const num = e.record.getInt('number')
          const dt = e.record.getString('date') ? e.record.getString('date').slice(0, 10) : ''
          const area = e.record.getString('area') || ''
          label = `Planilha Nº ${num > 0 ? num : recordId} · ${dt} (${area})`
        } else if (entity === 'in_situ_sheets') {
          const proj = e.record.getString('project_name') || ''
          const sys = e.record.getString('system_name') || ''
          label = `Medição In-Situ · ${proj}${sys ? ` (${sys})` : ''}`
        } else if (entity === 'na_sheets') {
          const area = e.record.getString('area_name') || ''
          const dt = e.record.getString('date') ? e.record.getString('date').slice(0, 10) : ''
          label = `Planilha de NA · ${area}${dt ? ` (${dt})` : ''}`
        }
      } catch (_) {}

      const log = new Record(logs)
      if (actorId) {
        log.set('actor', actorId)
      }
      log.set('action', 'delete')
      log.set('entity', entity)
      log.set('entity_record', recordId)
      log.set('details', {
        label: label,
        server_timestamp: new Date().toISOString(),
      })
      $app.save(log)
    } catch (error) {
      console.warn('audit delete (falha graciosa ignorada):', error)
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
  'in_situ_sheets',
  'na_sheets',
  'na_area_configs',
  'users',
)
