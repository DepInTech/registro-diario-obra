onRecordCreateRequest(
  (e) => {
    e.next()
    if (!e.auth) return
    try {
      const logs = $app.findCollectionByNameOrId('audit_logs')
      const log = new Record(logs)
      log.set('actor', e.auth.id)
      log.set('action', 'create')
      log.set('entity', e.record.collection().name)
      log.set('entity_record', e.record.id)
      log.set('details', {
        label:
          e.record.getString('name') ||
          e.record.getString('code') ||
          e.record.getString('activity_title') ||
          e.record.id,
      })
      $app.save(log)
    } catch (error) {
      console.error('audit create', error)
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
