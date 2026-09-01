onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth) return e.next()
  const current = e.record.original().getString('status')
  const next = e.record.getString('status')
  const role = auth.getString('role')
  if (current === 'approved' && role !== 'admin')
    throw new ForbiddenError('RDO aprovado está bloqueado para edição')
  if ((next === 'approved' || next === 'returned') && role !== 'admin')
    throw new ForbiddenError('Somente administradores podem aprovar ou devolver RDOs')
  if (next === 'submitted' && role === 'operator')
    throw new ForbiddenError('O técnico deve revisar os dados e enviar o RDO')
  e.next()
}, 'reports_rdo')
