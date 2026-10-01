routerAdd(
  'POST',
  '/backend/v1/epa/audit-export',
  (e) => {
    const auth = e.auth
    const role = auth?.getString('role')
    if (!auth || !auth.getBool('active') || (role !== 'admin' && role !== 'technician')) {
      throw new ForbiddenError('Acesso não autorizado para auditoria de exportação')
    }
    const body = e.requestInfo().body
    let action = body.action === 'export_excel' ? 'export_excel' : 'export_pdf'
    if (body.action === 'add_well') action = 'add_well'
    const logs = $app.findCollectionByNameOrId('audit_logs')
    const log = new Record(logs)
    log.set('actor', auth.id)
    log.set('action', action)
    log.set('entity', String(body.entity || 'document'))
    log.set('entity_record', String(body.entity_record || ''))
    log.set('details', {
      filename: String(body.filename || ''),
      format: action === 'export_excel' ? 'Excel' : action === 'add_well' ? 'Well' : 'PDF',
      well_code: String(body.well_code || ''),
      label: String(body.label || ''),
      server_timestamp: log.getString('created') || new Date().toISOString(),
    })
    $app.save(log)
    return e.json(200, { success: true, audit_id: log.id })
  },
  $apis.requireAuth(),
)
