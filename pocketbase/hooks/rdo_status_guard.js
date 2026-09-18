// Interceptador e guardião de integridade para RDOs e Planilhas de Campo (RBAC e Status)

// 1. reports_rdo UPDATE guard
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

  // 2. Trava de status para Técnico:
  // Se o RDO está 'approved', bloqueado definitivamente para Técnico
  if (currentStatus === 'approved') {
    throw new ForbiddenError('RDO aprovado está bloqueado para edição')
  }

  // Se o RDO está 'submitted' ("Enviado para aprovação"), o Técnico NÃO pode alterar nada
  // (nem manter submitted com modificação de dados, nem trocar status). Apenas o Admin pode devolver ou aprovar.
  if (currentStatus === 'submitted') {
    throw new ForbiddenError(
      'RDO enviado para aprovação está bloqueado para edição. Aguarde a liberação do Administrador.',
    )
  }

  // O Técnico só pode transicionar para 'submitted' a partir de 'draft' ou 'returned'
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

// 2. field_spreadsheets UPDATE guard
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

  // 2. Trava de status para Técnico:
  // Se a Planilha está 'approved', bloqueada definitivamente para Técnico
  if (currentStatus === 'approved') {
    throw new ForbiddenError('Planilha aprovada está bloqueada para edição')
  }

  // Se a Planilha está 'submitted' ("Enviada para aprovação"), o Técnico NÃO pode alterar nada
  // (nem manter submitted com modificação de dados, nem trocar status). Apenas o Admin pode devolver ou aprovar.
  if (currentStatus === 'submitted') {
    throw new ForbiddenError(
      'Planilha enviada para aprovação está bloqueada para edição. Aguarde a liberação do Administrador.',
    )
  }

  // O Técnico só pode transicionar para 'submitted' a partir de 'draft' ou 'returned'
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

// 3. report_photos CREATE, UPDATE, DELETE guards
// Não permitir que Técnico adicione, altere ou exclua fotos de RDO enviado ou aprovado
onRecordCreateRequest((e) => {
  const auth = e.auth
  if (!auth) return e.next()
  const role = auth.getString('role')
  if (role === 'admin') return e.next()

  const reportId = e.record.getString('report')
  if (reportId) {
    try {
      const parentReport = $app.findRecordById('reports_rdo', reportId)
      const st = parentReport.getString('status')
      if (st === 'submitted' || st === 'approved') {
        throw new ForbiddenError(
          'Não é permitido adicionar fotos a um RDO enviado para aprovação ou aprovado.',
        )
      }
    } catch (err) {
      if (err instanceof ForbiddenError) throw err
    }
  }

  e.next()
}, 'report_photos')

onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth) return e.next()
  const role = auth.getString('role')
  if (role === 'admin') return e.next()

  const reportId = e.record.getString('report') || e.record.original().getString('report')
  if (reportId) {
    try {
      const parentReport = $app.findRecordById('reports_rdo', reportId)
      const st = parentReport.getString('status')
      if (st === 'submitted' || st === 'approved') {
        throw new ForbiddenError(
          'Não é permitido alterar fotos de um RDO enviado para aprovação ou aprovado.',
        )
      }
    } catch (err) {
      if (err instanceof ForbiddenError) throw err
    }
  }

  e.next()
}, 'report_photos')

onRecordDeleteRequest((e) => {
  const auth = e.auth
  if (!auth) return e.next()
  const role = auth.getString('role')
  if (role === 'admin') return e.next()

  const reportId = e.record.getString('report')
  if (reportId) {
    try {
      const parentReport = $app.findRecordById('reports_rdo', reportId)
      const st = parentReport.getString('status')
      if (st === 'submitted' || st === 'approved') {
        throw new ForbiddenError(
          'Não é permitido excluir fotos de um RDO enviado para aprovação ou aprovado.',
        )
      }
    } catch (err) {
      if (err instanceof ForbiddenError) throw err
    }
  }

  e.next()
}, 'report_photos')

// 4. report_wells UPDATE, DELETE guards
// Não permitir que Técnico altere ou remova poços de RDO enviado ou aprovado
onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth) return e.next()
  const role = auth.getString('role')
  if (role === 'admin') return e.next()

  const reportId = e.record.getString('report') || e.record.original().getString('report')
  if (reportId) {
    try {
      const parentReport = $app.findRecordById('reports_rdo', reportId)
      const st = parentReport.getString('status')
      if (st === 'submitted' || st === 'approved') {
        throw new ForbiddenError(
          'Não é permitido alterar dados de poços em um RDO enviado para aprovação ou aprovado.',
        )
      }
    } catch (err) {
      if (err instanceof ForbiddenError) throw err
    }
  }

  e.next()
}, 'report_wells')

onRecordDeleteRequest((e) => {
  const auth = e.auth
  if (!auth) return e.next()
  const role = auth.getString('role')
  if (role === 'admin') return e.next()

  const reportId = e.record.getString('report')
  if (reportId) {
    try {
      const parentReport = $app.findRecordById('reports_rdo', reportId)
      const st = parentReport.getString('status')
      if (st === 'submitted' || st === 'approved') {
        throw new ForbiddenError(
          'Não é permitido remover poços de um RDO enviado para aprovação ou aprovado.',
        )
      }
    } catch (err) {
      if (err instanceof ForbiddenError) throw err
    }
  }

  e.next()
}, 'report_wells')

// 5. projects UPDATE guard
onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth) return e.next()
  const role = auth.getString('role')
  if (role === 'admin') return e.next()

  const prevArchived = e.record.original().getBool('archived')
  const nextArchived = e.record.getBool('archived')

  // Técnico NÃO pode arquivar ou desarquivar projetos
  if (prevArchived !== nextArchived) {
    throw new ForbiddenError('Apenas administradores podem arquivar ou desarquivar projetos.')
  }

  e.next()
}, 'projects')
