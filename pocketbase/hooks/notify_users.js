/// <reference path="../pb_data/types.d.ts" />
// FUNCIONALIDADE A — Colecão notifications: uma notificação POR destinatário, criada no
// servidor para TODOS os usuários com role = 'admin' && active = true (sem IDs fixos).
//
// Eventos notificados (apenas para destinarários ativos no momento do evento):
//   field_spreadsheets: create com status submitted; update para status submitted
//     (envio técnico) e update para status returned (devolução do admin).
//   reports_rdo: idem (mesmo mecanismo de revisão do cliente).

const EVENT_LABELS = {
  submitted: 'Planilha enviada para aprovação',
  returned: 'Planilha devolvida para correção',
}

const RDO_EVENT_LABELS = {
  submitted: 'RDO enviado para aprovação',
  returned: 'RDO devolvido para correção',
}

const adminRecipientIds = () => {
  const recipients = []
  try {
    const admins = $app.findRecordsByFilter('users', 'role = "admin" && active = true', '', 0, 0)
    for (let i = 0; i < admins.length; i++) recipients.push(admins[i].id)
  } catch (err) {
    console.warn('notify_users: falha ao buscar admins:', err)
  }
  return recipients
}

const technicianRecipientIds = (sheet) => {
  const ids = []
  try {
    const op = sheet.getString('operator')
    if (op) ids.push(op)
  } catch (_) {}
  try {
    const assigned = sheet.get('assigned_technicians')
    if (Array.isArray(assigned)) {
      assigned.forEach((t) => {
        if (t && ids.indexOf(String(t)) === -1) ids.push(String(t))
      })
    }
  } catch (_) {}
  return ids
}

const createNotification = (logCollection, recipientId, payload) => {
  try {
    const n = new Record(logCollection)
    n.set('recipient', recipientId)
    n.set('title', payload.title)
    n.set('body', payload.body || '')
    n.set('type', payload.type || 'info')
    n.set('entity', payload.entity || '')
    n.set('entity_record', payload.entity_record || '')
    n.set('read', false)
    n.set('created_by', payload.created_by || '')
    $app.save(n)
  } catch (err) {
    console.warn('notify_users: falha ao gravar notificação para', recipientId, err)
  }
}

const sheetLabel = (rec, isRdo) => {
  try {
    if (isRdo) {
      const num = rec.getInt('number')
      const act = rec.getString('activity_title') || 'Sem título'
      return `RDO Nº ${num > 0 ? num : rec.id} · ${act}`
    }
    const num = rec.getInt('number')
    const dt = rec.getString('date') ? rec.getString('date').slice(0, 10) : ''
    const area = rec.getString('area') || ''
    return `Planilha Nº ${num > 0 ? num : rec.id} · ${dt} (${area})`
  } catch (_) {
    return rec.id
  }
}

const notifyEvent = (rec, entity, prevStatus, nextStatus, actorId) => {
  const isRdo = entity === 'reports_rdo'
  const labels = isRdo ? RDO_EVENT_LABELS : EVENT_LABELS
  const event =
    nextStatus === 'submitted' ? 'submitted' : nextStatus === 'returned' ? 'returned' : ''
  if (!event) return
  if (prevStatus === nextStatus) return
  if (prevStatus && prevStatus !== 'draft' && prevStatus !== 'submitted') {
    // transições inesperadas (ex.: approved → returned) ainda notificam, não bloqueia
  }

  const label = sheetLabel(rec, isRdo)
  const logCollection = $app.findCollectionByNameOrId('notifications')
  if (!logCollection) return

  const title = labels[event] || (isRdo ? 'Atualização de RDO' : 'Atualização de Planilha')
  const body =
    event === 'returned'
      ? `${label} · Devolvida para correção. Verifique a justificativa do Administrador.`
      : `${label} · Aguardando sua aprovação.`

  const payload = {
    title,
    body,
    type: event,
    entity,
    entity_record: rec.id,
    created_by: actorId,
  }

  if (nextStatus === 'submitted') {
    // Técnico enviou/reenviou → notificar TODOS os admins ativos (um registro por admin)
    const admins = adminRecipientIds()
    for (let i = 0; i < admins.length; i++) {
      createNotification(logCollection, admins[i], payload)
    }
    console.log(
      `[notify_users] ${entity} ${rec.id} submitted → notificações criadas para ${admins.length} admin(s)`,
    )
  } else if (nextStatus === 'returned') {
    // Admin devolveu → notificar técnicos atribuídos (um registro por técnico)
    const techs = technicianRecipientIds(rec)
    for (let i = 0; i < techs.length; i++) {
      createNotification(logCollection, techs[i], payload)
    }
    console.log(
      `[notify_users] ${entity} ${rec.id} returned → notificações criadas para ${techs.length} técnico(s)`,
    )
  }
}

// ---- field_spreadsheets: CREATE e UPDATE ----
onRecordAfterCreateSuccess((e) => {
  try {
    const status = e.record.getString('status')
    if (status === 'submitted') {
      const actorId = e.auth && e.auth.id ? e.auth.id : ''
      notifyEvent(e.record, 'field_spreadsheets', '', status, actorId)
    }
  } catch (err) {
    console.warn('notify_users (create sheet):', err)
  }
  e.next()
}, 'field_spreadsheets')

onRecordAfterUpdateSuccess((e) => {
  try {
    const prevStatus = e.record.original().getString('status')
    const nextStatus = e.record.getString('status')
    if (prevStatus !== nextStatus) {
      const actorId = e.auth && e.auth.id ? e.auth.id : ''
      notifyEvent(e.record, 'field_spreadsheets', prevStatus, nextStatus, actorId)
    }
  } catch (err) {
    console.warn('notify_users (update sheet):', err)
  }
  e.next()
}, 'field_spreadsheets')

// ---- reports_rdo: CREATE e UPDATE (mesmo mecanismo de aprovação/devolução) ----
onRecordAfterCreateSuccess((e) => {
  try {
    const status = e.record.getString('status')
    if (status === 'submitted') {
      const actorId = e.auth && e.auth.id ? e.auth.id : ''
      notifyEvent(e.record, 'reports_rdo', '', status, actorId)
    }
  } catch (err) {
    console.warn('notify_users (create rdo):', err)
  }
  e.next()
}, 'reports_rdo')

onRecordAfterUpdateSuccess((e) => {
  try {
    const prevStatus = e.record.original().getString('status')
    const nextStatus = e.record.getString('status')
    if (prevStatus !== nextStatus) {
      const actorId = e.auth && e.auth.id ? e.auth.id : ''
      notifyEvent(e.record, 'reports_rdo', prevStatus, nextStatus, actorId)
    }
  } catch (err) {
    console.warn('notify_users (update rdo):', err)
  }
  e.next()
}, 'reports_rdo')

console.log('[notify_users] hook de notificações para admins/técnicos carregado')
