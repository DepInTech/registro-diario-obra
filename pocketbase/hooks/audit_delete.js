onRecordDeleteRequest(
  (e) => {
    const entity = e.record.collection().name
    const recordId = e.record.id
    const label =
      e.record.getString('name') ||
      e.record.getString('code') ||
      e.record.getString('activity_title') ||
      recordId
    e.next()
    if (!e.auth) return
    try {
      const logs = $app.findCollectionByNameOrId('audit_logs')
      const log = new Record(logs)
      log.set('actor', e.auth.id)
      log.set('action', 'delete')
      log.set('entity', entity)
      log.set('entity_record', recordId)
      log.set('details', { label: label })
      $app.save(log)
    } catch (error) {
      console.error('audit delete', error)
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
