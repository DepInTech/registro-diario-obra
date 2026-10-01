onRecordAfterUpdateSuccess(
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

      const log = new Record(logs)
      if (actorId) {
        log.set('actor', actorId)
      }

      let action = 'update'
      const entity = e.record.collection().name

      let previousDeleted = false
      let currentDeleted = false
      let previousArchived = false
      let currentArchived = false
      let currentStatus = ''
      let previousStatus = ''

      try {
        previousDeleted = e.record.original().getBool('deleted')
      } catch (_) {}
      try {
        currentDeleted = e.record.getBool('deleted')
      } catch (_) {}
      try {
        previousArchived = e.record.original().getBool('archived')
      } catch (_) {}
      try {
        currentArchived = e.record.getBool('archived')
      } catch (_) {}
      try {
        previousStatus = e.record.original().getString('status')
      } catch (_) {}
      try {
        currentStatus = e.record.getString('status')
      } catch (_) {}

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
        server_timestamp: new Date().toISOString(),
      })
      $app.save(log)
    } catch (error) {
      console.warn('audit update (falha graciosa ignorada):', error)
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
