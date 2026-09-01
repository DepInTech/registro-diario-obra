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
      if (
        (entity === 'reports_rdo' || entity === 'field_spreadsheets') &&
        previousStatus !== e.record.getString('status')
      ) {
        if (e.record.getString('status') === 'approved') action = 'approve'
        if (e.record.getString('status') === 'returned') action = 'return'
      }
      log.set('action', action)
      log.set('entity', e.record.collection().name)
      log.set('entity_record', e.record.id)
      log.set('details', {
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
