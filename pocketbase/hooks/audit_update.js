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

      if (previousDeleted !== currentDeleted) {
        action = currentDeleted ? 'soft_delete' : 'restore'
      } else if (previousArchived !== currentArchived) {
        action = currentArchived ? 'archive' : 'unarchive'
      } else if (
        (entity === 'reports_rdo' || entity === 'field_spreadsheets') &&
        previousStatus !== e.record.getString('status')
      ) {
        if (e.record.getString('status') === 'approved') action = 'approve'
        if (e.record.getString('status') === 'returned') action = 'return'
      }
      log.set('action', action)
      log.set('entity', entity)
      log.set('entity_record', e.record.id)
      log.set('details', {
        deleted: currentDeleted,
        previousDeleted: previousDeleted,
        deleted_reason: e.record.getString('deleted_reason') || '',
        deleted_by: e.record.getString('deleted_by') || '',
        deleted_at: e.record.getString('deleted_at') || '',
        archived: currentArchived,
        previousArchived: previousArchived,
        status: e.record.getString('status') || '',
        previousStatus: previousStatus,
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
