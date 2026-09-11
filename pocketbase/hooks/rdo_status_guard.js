onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth) return e.next()
  const current = e.record.original().getString('status')
  const next = e.record.getString('status')
  const role = auth.getString('role')
  const prevArchived = e.record.original().getBool('archived')
  const nextArchived = e.record.getBool('archived')

  // Se a única alteração for arquivar/desarquivar, permitir para usuários autorizados mesmo se aprovado
  if (prevArchived !== nextArchived && current === next && role !== 'admin') {
    return e.next()
  }

  if (current === 'approved' && role !== 'admin')
    throw new ForbiddenError('RDO aprovado está bloqueado para edição')
  if ((next === 'approved' || next === 'returned') && role !== 'admin')
    throw new ForbiddenError('Somente administradores podem aprovar ou devolver RDOs')
  // Operador e Admin podem submeter RDO
  e.next()
}, 'reports_rdo')
