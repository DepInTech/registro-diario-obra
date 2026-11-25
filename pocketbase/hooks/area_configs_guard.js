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
  // LOG DE EVIDÊNCIA — PAYLOAD CRU: prova o que CHEGOU na rede antes de qualquer
  // sanitização. `e.record.get()` no JSVM pode não refletir o body cru (JSON pode
  // chegar como string/JsonRaw, e o merge do body no record tem particularidades),
  // então lemos direto de `e.requestInfo().body` (disponível neste PocketBase —
  // já usado em audit_export.js) e logamos tipo + trecho limitado a ~300 chars.
  try {
    const rawBody = (e.requestInfo() && e.requestInfo().body) || {}
    const rawPf = rawBody['preset_fields']
    let rawSnippet = ''
    try {
      const full = JSON.stringify(rawPf)
      rawSnippet = full
        ? full.length > 300
          ? full.substring(0, 300) + '...[truncado]'
          : full
        : 'undefined'
    } catch (sErr) {
      rawSnippet = '(não serializável: ' + sErr + ')'
    }
    console.log(
      '[area_configs] CREATE RAW-BODY preset_fields typeof=' +
        (rawPf === null ? 'null' : typeof rawPf) +
        ' trecho=' +
        rawSnippet,
    )
  } catch (rawErr) {
    console.log('[area_configs] CREATE (log body cru falhou): ' + rawErr)
  }
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

  // RECUPERAÇÃO DO CAMPO JSON (JSVM): o record pode não refletir o body cru —
  // preset_fields chega em e.requestInfo().body como json.RawMessage (array de
  // bytes) e o merge no record não o aplica. Antes da sanitização, recuperamos
  // o valor do body cru e aplicamos ao record SE o record estiver vazio.
  // Se parse falhar, NÃO sobrescrevemos (mantém o que o record tem).
  try {
    const rawBody2 = (e.requestInfo() && e.requestInfo().body) || {}
    const rawPf2 = rawBody2['preset_fields']
    let normalized = null
    if (rawPf2 !== undefined && rawPf2 !== null) {
      if (Array.isArray(rawPf2) && rawPf2.length > 0 && typeof rawPf2[0] === 'number') {
        // json.RawMessage no JSVM: array de bytes -> string -> JSON.parse
        let s = ''
        for (let i = 0; i < rawPf2.length; i += 4096) {
          s += String.fromCharCode.apply(null, rawPf2.slice(i, i + 4096))
        }
        try {
          normalized = JSON.parse(s)
        } catch (pErr) {
          console.log('[area_configs] CREATE raw-body bytes não parsearam: ' + pErr)
        }
      } else if (typeof rawPf2 === 'string') {
        try {
          normalized = JSON.parse(rawPf2)
        } catch (_) {
          normalized = null
        }
      } else if (typeof rawPf2 === 'object' && !Array.isArray(rawPf2)) {
        normalized = rawPf2
      }
    }
    let recPf = e.record.get('preset_fields')
    if (recPf && typeof recPf === 'string') {
      try {
        recPf = JSON.parse(recPf)
      } catch (_) {
        recPf = null
      }
    }
    if (
      recPf &&
      typeof recPf === 'object' &&
      !Array.isArray(recPf) &&
      Object.keys(recPf).length > 0
    ) {
      console.log('[area_configs] CREATE preset_fields: caminho=record-já-tinha')
    } else if (
      normalized &&
      typeof normalized === 'object' &&
      !Array.isArray(normalized) &&
      Object.keys(normalized).length > 0
    ) {
      e.record.set('preset_fields', normalized)
      console.log(
        '[area_configs] CREATE preset_fields: caminho=raw-body-aplicado chaves=' +
          Object.keys(normalized).length,
      )
    } else {
      console.log('[area_configs] CREATE preset_fields: caminho=vazio')
    }
  } catch (rescueErr) {
    console.log('[area_configs] CREATE (recuperação raw-body falhou): ' + rescueErr)
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
    // LOG FINAL: o que será de fato PERSISTIDO (após recuperação + sanitização)
    try {
      const finalPf = e.record.get('preset_fields')
      let finalObj = finalPf
      if (typeof finalObj === 'string') {
        try {
          finalObj = JSON.parse(finalObj)
        } catch (_) {
          finalObj = null
        }
      }
      const finalKeys =
        finalObj && typeof finalObj === 'object' && !Array.isArray(finalObj)
          ? Object.keys(finalObj).length
          : 0
      console.log('[area_configs] CREATE FINAL presetFieldsKeys=' + finalKeys)
    } catch (_) {}
  } catch (_) {}

  e.next()
}, 'area_configs')

onRecordUpdateRequest((e) => {
  const auth = e.auth
  const role = auth ? auth.getString('role') : ''
  // LOG DE EVIDÊNCIA — PAYLOAD CRU (mesma razão do CREATE: o record pode não
  // refletir o body cru; `e.requestInfo().body` mostra o que chegou na rede).
  try {
    const rawBody = (e.requestInfo() && e.requestInfo().body) || {}
    const rawPf = rawBody['preset_fields']
    let rawSnippet = ''
    try {
      const full = JSON.stringify(rawPf)
      rawSnippet = full
        ? full.length > 300
          ? full.substring(0, 300) + '...[truncado]'
          : full
        : 'undefined'
    } catch (sErr) {
      rawSnippet = '(não serializável: ' + sErr + ')'
    }
    console.log(
      '[area_configs] UPDATE RAW-BODY preset_fields typeof=' +
        (rawPf === null ? 'null' : typeof rawPf) +
        ' trecho=' +
        rawSnippet,
    )
  } catch (rawErr) {
    console.log('[area_configs] UPDATE (log body cru falhou): ' + rawErr)
  }
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

  // RECUPERAÇÃO DO CAMPO JSON (JSVM) — idêntica ao CREATE: se o record não
  // recebeu o preset_fields do body (json.RawMessage não aplicado ao record),
  // recuperamos do body cru ANTES da sanitização (que consolidaria vazio).
  try {
    const rawBody2 = (e.requestInfo() && e.requestInfo().body) || {}
    const rawPf2 = rawBody2['preset_fields']
    let normalized = null
    if (rawPf2 !== undefined && rawPf2 !== null) {
      if (Array.isArray(rawPf2) && rawPf2.length > 0 && typeof rawPf2[0] === 'number') {
        // json.RawMessage no JSVM: array de bytes -> string -> JSON.parse
        let s = ''
        for (let i = 0; i < rawPf2.length; i += 4096) {
          s += String.fromCharCode.apply(null, rawPf2.slice(i, i + 4096))
        }
        try {
          normalized = JSON.parse(s)
        } catch (pErr) {
          console.log('[area_configs] UPDATE raw-body bytes não parsearam: ' + pErr)
        }
      } else if (typeof rawPf2 === 'string') {
        try {
          normalized = JSON.parse(rawPf2)
        } catch (_) {
          normalized = null
        }
      } else if (typeof rawPf2 === 'object' && !Array.isArray(rawPf2)) {
        normalized = rawPf2
      }
    }
    let recPf = e.record.get('preset_fields')
    if (recPf && typeof recPf === 'string') {
      try {
        recPf = JSON.parse(recPf)
      } catch (_) {
        recPf = null
      }
    }
    if (
      recPf &&
      typeof recPf === 'object' &&
      !Array.isArray(recPf) &&
      Object.keys(recPf).length > 0
    ) {
      console.log('[area_configs] UPDATE preset_fields: caminho=record-já-tinha')
    } else if (
      normalized &&
      typeof normalized === 'object' &&
      !Array.isArray(normalized) &&
      Object.keys(normalized).length > 0
    ) {
      e.record.set('preset_fields', normalized)
      console.log(
        '[area_configs] UPDATE preset_fields: caminho=raw-body-aplicado chaves=' +
          Object.keys(normalized).length,
      )
    } else {
      console.log('[area_configs] UPDATE preset_fields: caminho=vazio')
    }
  } catch (rescueErr) {
    console.log('[area_configs] UPDATE (recuperação raw-body falhou): ' + rescueErr)
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
    // LOG FINAL: o que será de fato PERSISTIDO (após recuperação + sanitização)
    try {
      const finalPf = e.record.get('preset_fields')
      let finalObj = finalPf
      if (typeof finalObj === 'string') {
        try {
          finalObj = JSON.parse(finalObj)
        } catch (_) {
          finalObj = null
        }
      }
      const finalKeys =
        finalObj && typeof finalObj === 'object' && !Array.isArray(finalObj)
          ? Object.keys(finalObj).length
          : 0
      console.log('[area_configs] UPDATE FINAL presetFieldsKeys=' + finalKeys)
    } catch (_) {}
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
