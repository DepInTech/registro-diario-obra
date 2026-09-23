onRecordDeleteRequest(
  (e) => {
    const entity = e.record.collection().name
    const recordId = e.record.id
    let label =
      e.record.getString('name') ||
      e.record.getString('code') ||
      e.record.getString('activity_title') ||
      recordId

    if (entity === 'reports_rdo') {
      const num = e.record.getInt('number')
      const act = e.record.getString('activity_title') || 'Sem título'
      label = `RDO Nº ${num > 0 ? num : recordId} · ${act}`
    } else if (entity === 'field_spreadsheets') {
      const num = e.record.getInt('number')
      const dt = e.record.getString('date') ? e.record.getString('date').slice(0, 10) : ''
      const area = e.record.getString('area') || ''
      label = `Planilha Nº ${num > 0 ? num : recordId} · ${dt} (${area})`
    }

    e.next()
    if (!e.auth) return
    try {
      const logs = $app.findCollectionByNameOrId('audit_logs')
      const log = new Record(logs)
      log.set('actor', e.auth.id)
      log.set('action', 'delete')
      log.set('entity', entity)
      log.set('entity_record', recordId)
      log.set('details', {
        label: label,
        server_timestamp: log.getString('created') || new Date().toISOString(),
      })
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
