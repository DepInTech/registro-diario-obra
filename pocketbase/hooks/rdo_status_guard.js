// Interceptador e guardião de integridade para RDOs e Planilhas de Campo (RBAC e Status)

onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth) return e.next()
  const role = auth.getString('role')
  if (role === 'admin') return e.next()

  const currentStatus = e.record.original().getString('status')
  const nextStatus = e.record.getString('status')
  const prevArchived = e.record.original().getBool('archived')
  const nextArchived = e.record.getBool('archived')

  // 1. Técnico NÃO pode arquivar ou desarquivar
  if (prevArchived !== nextArchived) {
    throw new ForbiddenError('Apenas o Administrador pode arquivar ou desarquivar RDOs')
  }

  // 2. Trava de status
  if (currentStatus === 'approved') {
    throw new ForbiddenError('RDO aprovado está bloqueado para edição')
  }
  if (currentStatus === 'submitted' && nextStatus !== 'submitted') {
    throw new ForbiddenError('RDO enviado para aprovação está bloqueado para edição')
  }
  if (nextStatus === 'approved' || nextStatus === 'returned') {
    throw new ForbiddenError('Somente administradores podem aprovar ou devolver RDOs')
  }

  // 3. Campos controlados pelo Administrador: número do RDO e projeto
  if (e.record.original().getInt('number') !== e.record.getInt('number')) {
    throw new ForbiddenError(
      'O número do RDO é controlado pelo Administrador e não pode ser alterado por técnicos',
    )
  }
  if (e.record.original().getString('project') !== e.record.getString('project')) {
    throw new ForbiddenError(
      'O projeto associado ao RDO é controlado pelo Administrador e não pode ser alterado por técnicos',
    )
  }

  e.next()
}, 'reports_rdo')

onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth) return e.next()
  const role = auth.getString('role')
  if (role === 'admin') return e.next()

  const currentStatus = e.record.original().getString('status')
  const nextStatus = e.record.getString('status')
  const prevArchived = e.record.original().getBool('archived')
  const nextArchived = e.record.getBool('archived')

  // 1. Técnico NÃO pode arquivar ou desarquivar
  if (prevArchived !== nextArchived) {
    throw new ForbiddenError(
      'Apenas o Administrador pode arquivar ou desarquivar planilhas de campo',
    )
  }

  // 2. Trava de status
  if (currentStatus === 'approved') {
    throw new ForbiddenError('Planilha aprovada está bloqueada para edição')
  }
  if (currentStatus === 'submitted' && nextStatus !== 'submitted') {
    throw new ForbiddenError('Planilha enviada para aprovação está bloqueada para edição')
  }
  if (nextStatus === 'approved' || nextStatus === 'returned') {
    throw new ForbiddenError('Somente administradores podem aprovar ou devolver planilhas')
  }

  // 3. Campos controlados pelo Administrador: projeto associado
  if (e.record.original().getString('project') !== e.record.getString('project')) {
    throw new ForbiddenError(
      'O projeto associado à planilha é controlado pelo Administrador e não pode ser alterado por técnicos',
    )
  }

  e.next()
}, 'field_spreadsheets')

onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth) return e.next()
  const role = auth.getString('role')
  if (role === 'admin') return e.next()

  const prevArchived = e.record.original().getBool('archived')
  const nextArchived = e.record.getBool('archived')

  // Técnico NÃO pode arquivar ou desarquivar projetos
  if (prevArchived !== nextArchived) {
    throw new ForbiddenError('Apenas o Administrador pode arquivar ou desarquivar projetos')
  }

  e.next()
}, 'projects')
