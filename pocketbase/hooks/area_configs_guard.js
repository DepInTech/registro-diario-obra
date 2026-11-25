// Guard de servidor para `area_configs` (Configuração de Áreas da Planilha de Campo)
//
// As API rules da coleção já restringem escrita a Admin; este hook reforça no
// nível de request (mesmo espírito dos guards rdo_status / returned_fields):
//   - create/update/delete: somente Admin; tentativa de não-Admin é rejeitada
//     com 403 e AUDITADA (action 'rejected', entidade 'area_configs');
//   - sanitização leve do payload (strings; preset_fields sempre objeto).
//
// REGRA JSVM: toda a lógica fica INLINE nos callbacks — declarações top-level
// usadas dentro de callbacks causam 'Hook scoping error' no deploy.

onRecordCreateRequest((e) => {
  const auth = e.auth
  const role = auth ? auth.getString('role') : ''
  // LOG DE EVIDÊNCIA: prova nos logs do backend quantas chaves o cliente enviou
  try {
    let pfLog = e.record.get('preset_fields')
    if (pfLog && typeof pfLog === 'string') {
      try {
        pfLog = JSON.parse(pfLog)
      } catch (_) {
        pfLog = null
      }
    }
    let pfKeys = 0
    if (pfLog && typeof pfLog === 'object' && !Array.isArray(pfLog)) {
      pfKeys = Object.keys(pfLog).length
    }
    console.log(
      '[area_configs] CREATE ' +
        'area_name="' +
        (e.record.getString('area_name') || '') +
        '" ' +
        'config_version=' +
        e.record.getInt('config_version') +
        ' ' +
        'op=create presetFieldsKeys=' +
        pfKeys,
    )
  } catch (logErr) {
    console.log('[area_configs] CREATE (log falhou): ' + logErr)
  }
  if (role !== 'admin') {
    try {
      const logs = $app.findCollectionByNameOrId('audit_logs')
      if (logs) {
        const log = new Record(logs)
        if (auth && auth.id) log.set('actor', auth.id)
        log.set('action', 'rejected')
        log.set('entity', 'area_configs')
        log.set('entity_record', '')
        log.set('details', {
          reason: 'não-admin tentou criar configuração de área',
          op: 'create',
          server_timestamp: new Date().toISOString(),
        })
        $app.save(log)
      }
    } catch (_) {}

    throw new ForbiddenError('Apenas Administradores podem criar configurações de área.')
  }

  // Sanitização leve (inline no callback)
  try {
    const name = (e.record.getString('area_name') || '').trim()
    if (name) e.record.set('area_name', name)
    const contract = e.record.getString('contract_number') || ''
    e.record.set('contract_number', contract.trim())
    const desc = e.record.getString('description') || ''
    e.record.set('description', desc.trim())
    // preset_fields: garante objeto (nunca string solta ou array)
    let pf = e.record.get('preset_fields')
    if (pf && typeof pf === 'string') {
      try {
        pf = JSON.parse(pf)
      } catch (_) {
        pf = {}
      }
    }
    if (!pf || typeof pf !== 'object' || Array.isArray(pf)) pf = {}
    e.record.set('preset_fields', JSON.parse(JSON.stringify(pf)))
    // Primeira versão da configuração
    const ver = e.record.getInt('config_version')
    if (ver < 1) e.record.set('config_version', 1)
  } catch (_) {}

  e.next()
}, 'area_configs')

onRecordUpdateRequest((e) => {
  const auth = e.auth
  const role = auth ? auth.getString('role') : ''
  // LOG DE EVIDÊNCIA: prova nos logs do backend quantas chaves o cliente enviou
  try {
    let pfLog = e.record.get('preset_fields')
    if (pfLog && typeof pfLog === 'string') {
      try {
        pfLog = JSON.parse(pfLog)
      } catch (_) {
        pfLog = null
      }
    }
    let pfKeys = 0
    if (pfLog && typeof pfLog === 'object' && !Array.isArray(pfLog)) {
      pfKeys = Object.keys(pfLog).length
    }
    console.log(
      '[area_configs] UPDATE ' +
        'area_name="' +
        (e.record.getString('area_name') || '') +
        '" ' +
        'config_version=' +
        e.record.getInt('config_version') +
        ' ' +
        'op=update presetFieldsKeys=' +
        pfKeys,
    )
  } catch (logErr) {
    console.log('[area_configs] UPDATE (log falhou): ' + logErr)
  }
  if (role !== 'admin') {
    try {
      const logs = $app.findCollectionByNameOrId('audit_logs')
      if (logs) {
        const log = new Record(logs)
        if (auth && auth.id) log.set('actor', auth.id)
        log.set('action', 'rejected')
        log.set('entity', 'area_configs')
        log.set('entity_record', e.record ? e.record.id : '')
        log.set('details', {
          reason: 'não-admin tentou editar configuração de área',
          op: 'update',
          server_timestamp: new Date().toISOString(),
        })
        $app.save(log)
      }
    } catch (_) {}

    throw new ForbiddenError('Apenas Administradores podem editar configurações de área.')
  }

  // Sanitização leve + versionamento pontual da configuração
  try {
    const name = (e.record.getString('area_name') || '').trim()
    if (name) e.record.set('area_name', name)
    const desc = e.record.getString('description') || ''
    e.record.set('description', desc.trim())
    let pf = e.record.get('preset_fields')
    if (pf && typeof pf === 'string') {
      try {
        pf = JSON.parse(pf)
      } catch (_) {
        pf = {}
      }
    }
    if (!pf || typeof pf !== 'object' || Array.isArray(pf)) pf = {}
    e.record.set('preset_fields', JSON.parse(JSON.stringify(pf)))
    // Incrementa a versão da configuração (planilhas já preenchidas carregam
    // snapshot, e não a configuração viva — por isso o incremento é seguro)
    const ver = e.record.getInt('config_version')
    e.record.set('config_version', ver + 1)
  } catch (_) {}

  e.next()
}, 'area_configs')

onRecordDeleteRequest((e) => {
  const auth = e.auth
  const role = auth ? auth.getString('role') : ''
  if (role !== 'admin') {
    try {
      const logs = $app.findCollectionByNameOrId('audit_logs')
      if (logs) {
        const log = new Record(logs)
        if (auth && auth.id) log.set('actor', auth.id)
        log.set('action', 'rejected')
        log.set('entity', 'area_configs')
        log.set('entity_record', e.record ? e.record.id : '')
        log.set('details', {
          reason: 'não-admin tentou excluir configuração de área',
          op: 'delete',
          server_timestamp: new Date().toISOString(),
        })
        $app.save(log)
      }
    } catch (_) {}

    throw new ForbiddenError('Apenas Administradores podem excluir configurações de área.')
  }

  e.next()
}, 'area_configs')
