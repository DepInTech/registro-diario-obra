routerAdd(
  'POST',
  '/api/epa/audit-export',
  (e) => {
    const auth = e.auth
    if (!auth || auth.getString('role') !== 'admin' || !auth.getBool('active')) {
      throw new ForbiddenError('Somente administradores podem gerar documentos')
    }
    const body = e.requestInfo().body
    const action = body.action === 'export_excel' ? 'export_excel' : 'export_pdf'
    const logs = $app.findCollectionByNameOrId('audit_logs')
    const log = new Record(logs)
    log.set('actor', auth.id)
    log.set('action', action)
    log.set('entity', String(body.entity || 'document'))
    log.set('entity_record', String(body.entity_record || ''))
    log.set('details', {
      filename: String(body.filename || ''),
      format: action === 'export_excel' ? 'Excel' : 'PDF',
    })
    $app.save(log)
    return e.json(200, { success: true, audit_id: log.id })
  },
  $apis.requireAuth(),
)
