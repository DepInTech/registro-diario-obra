// Interceptador e guardião de integridade para RDOs e Planilhas de Campo (RBAC e Status)

// 0. CREATE request guard para normalização prévia
onRecordCreateRequest(
  (e) => {
    try {
      if (e.record) {
        const col = e.collection?.name || (e.record.collection ? e.record.collection().name : '')
        if (col === 'reports_rdo' || col === 'field_spreadsheets') {
          const sanitizeDate = (raw) => {
            if (!raw || typeof raw !== 'string') return raw
            const s = raw.trim()
            const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
            if (br) return `${br[3]}-${br[2]}-${br[1]}`
            return s
          }

          const dateKeys = [
            'date',
            'report_date',
            'submitted_at',
            'approved_at',
            'returned_at',
            'deleted_at',
          ]
          for (let i = 0; i < dateKeys.length; i++) {
            const k = dateKeys[i]
            try {
              const v = e.record.get(k)
              if (v && typeof v === 'string') {
                const sv = sanitizeDate(v)
                if (sv !== v) e.record.set(k, sv)
              }
            } catch (_) {}
          }

          // Sanitização de relations obrigatórias
          if (col === 'field_spreadsheets') {
            // operator deve ser ID de usuário válido
            try {
              const op = e.record.getString('operator')
              if (!op || op.trim() === '' || op.startsWith('user_') || op.startsWith('field_')) {
                const curAuthId = e.auth ? e.auth.id : ''
                if (curAuthId) e.record.set('operator', curAuthId)
              }
            } catch (_) {}

            // project deve ser ID de projeto válido
            try {
              const pr = e.record.getString('project')
              if (!pr || pr.trim() === '' || pr.startsWith('proj_') || pr.startsWith('p_')) {
                const activeProjs = $app.findRecordsByFilter(
                  'projects',
                  'deleted = false && archived = false && status = "active"',
                  '-created',
                  1,
                  0,
                )
                if (activeProjs && activeProjs.length > 0) {
                  e.record.set('project', activeProjs[0].id)
                }
              }
            } catch (_) {}

            // area não pode ser vazia
            try {
              const ar = e.record.getString('area')
              if (!ar || ar.trim() === '') e.record.set('area', 'Geral')
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      console.warn('Aviso: falha defensiva na normalização inicial de rdo_status_guard:', err)
    }
    e.next()
  },
  'reports_rdo',
  'field_spreadsheets',
)

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
  // Permitir resolução caso o RDO original não tivesse número atribuído (>0) ou estivesse com projeto provisório/em branco
  const origNum = e.record.original().getInt('number')
  const nextNum = e.record.getInt('number')
  if (origNum > 0 && nextNum > 0 && origNum !== nextNum) {
    throw new ForbiddenError(
      'O número do RDO é controlado pelo Administrador/Servidor e não pode ser alterado por técnicos',
    )
  }
  const origProj = e.record.original().getString('project')
  const nextProj = e.record.getString('project')
  if (origProj && nextProj && origProj !== nextProj) {
    throw new ForbiddenError(
      'O projeto associado ao RDO é controlado pelo Administrador e não pode ser alterado por técnicos',
    )
  }

  // 4. Integridade do Histórico de Alterações: Técnico nunca pode apagar ou diminuir histórico existente
  try {
    const origHist = e.record.original().get('change_history')
    const nextHist = e.record.get('change_history')
    if (Array.isArray(origHist) && origHist.length > 0) {
      if (!Array.isArray(nextHist) || nextHist.length < origHist.length) {
        throw new ForbiddenError('O histórico de alterações após devolução não pode ser removido.')
      }
    }
  } catch (histErr) {
    if (histErr instanceof ForbiddenError) throw histErr
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
  // Permitir resolução se o original estava sem projeto
  const origSheetProj = e.record.original().getString('project')
  const nextSheetProj = e.record.getString('project')
  if (origSheetProj && nextSheetProj && origSheetProj !== nextSheetProj) {
    throw new ForbiddenError(
      'O projeto associado à planilha é controlado pelo Administrador e não pode ser alterado por técnicos',
    )
  }

  // 4. Integridade do Histórico de Alterações: Técnico nunca pode apagar ou diminuir histórico existente
  try {
    const origHist = e.record.original().get('change_history')
    const nextHist = e.record.get('change_history')
    if (Array.isArray(origHist) && origHist.length > 0) {
      if (!Array.isArray(nextHist) || nextHist.length < origHist.length) {
        throw new ForbiddenError('O histórico de alterações após devolução não pode ser removido.')
      }
    }
  } catch (histErr) {
    if (histErr instanceof ForbiddenError) throw histErr
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
