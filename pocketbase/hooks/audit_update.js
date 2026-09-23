onRecordUpdateRequest(
  (e) => {
    const previousStatus = e.record.original().getString('status')
    e.next()
    if (!e.auth) return
    try {
      const logs = $app.findCollectionByNameOrId('audit_logs')
      const log = new Record(logs)
      log.set('actor', e.auth.id)
      let action = 'update'
      const entity = e.record.collection().name

      const previousDeleted = e.record.original().getBool('deleted')
      const currentDeleted = e.record.getBool('deleted')
      const previousArchived = e.record.original().getBool('archived')
      const currentArchived = e.record.getBool('archived')
      const currentStatus = e.record.getString('status')

      if (previousDeleted !== currentDeleted) {
        action = currentDeleted ? 'soft_delete' : 'restore'
      } else if (previousArchived !== currentArchived) {
        action = currentArchived ? 'archive' : 'unarchive'
      } else if (
        (entity === 'reports_rdo' || entity === 'field_spreadsheets') &&
        previousStatus !== currentStatus
      ) {
        if (currentStatus === 'approved') action = 'approve'
        else if (currentStatus === 'returned') action = 'return'
        else if (currentStatus === 'submitted') action = 'update'
      }

      let label =
        e.record.getString('name') ||
        e.record.getString('code') ||
        e.record.getString('activity_title') ||
        e.record.id

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

      log.set('action', action)
      log.set('entity', entity)
      log.set('entity_record', e.record.id)
      log.set('details', {
        label: label,
        deleted: currentDeleted,
        previousDeleted: previousDeleted,
        deleted_reason: e.record.getString('deleted_reason') || '',
        deleted_by: e.record.getString('deleted_by') || '',
        deleted_at: e.record.getString('deleted_at') || '',
        archived: currentArchived,
        previousArchived: previousArchived,
        status: currentStatus || '',
        previousStatus: previousStatus,
        server_timestamp: log.getString('created') || new Date().toISOString(),
      })
      $app.save(log)
    } catch (error) {
      console.error('audit update', error)
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
