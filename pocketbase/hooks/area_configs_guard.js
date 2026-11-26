// Guard de servidor para `area_configs` (Configuração de Áreas da Planilha de Campo)
//
// As API rules da coleção já restringem escrita a Admin; este hook reforça no
// nível de request (mesmo espírito dos guards rdo_status / returned_fields):
//   - create/update/delete: somente Admin; tentativa de não-Admin é rejeitada
//     com 403 e AUDITADA (action 'rejected', entidade 'area_configs');
//   - sanitização leve do payload (strings; preset_fields sempre objeto).
//
// REGRA JSVM: toda a lógica fica INLINE nos callbacks — declarações top-level
// usadas dentro de callbacks causam 'Hook scoping error' no deploy. Por isso a
// normalização de preset_fields (string | array de bytes | objeto) está
// DUPLICADA inline em cada callback, sem função auxiliar top-level.
//
// PARTICULARIDADE DO JSVM: `e.record.get('preset_fields')` NÃO devolve nem o
// objeto JS nem uma string — devolve o JSON como ARRAY DE BYTES
// (json.RawMessage). Qualquer checagem do tipo `Array.isArray(pf) => inválido`
// APAGA o valor. Em TODOS os pontos que leem o campo do record, o valor é
// normalizado inline: string -> JSON.parse; array de números -> bytes
// decodificados em fatias de 4096 -> JSON.parse; objeto simples -> uso direto.
// Um array de bytes parseável NUNCA é descartado: se o JSON.parse do conteúdo
// decodificado produz objeto, esse É o valor do campo. Só se o parse falhar o
// valor é tratado como vazio (fallback mantido).

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
    } else if (Array.isArray(pfLog) && pfLog.length > 0 && typeof pfLog[0] === 'number') {
      // json.RawMessage no JSVM: array de bytes -> string -> JSON.parse
      let sLog = ''
      for (let i = 0; i < pfLog.length; i += 4096) {
        sLog += String.fromCharCode.apply(null, pfLog.slice(i, i + 4096))
      }
      try {
        pfLog = JSON.parse(sLog)
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
  // bytes) e o merge no record não o aplica. Normalizamos o valor do body cru
  // e o valor atual do record (string | bytes | objeto); quando o body traz um
  // objeto válido ele É o valor do campo e é aplicado; quando o body não traz
  // (ou não parseia) e o record já tem objeto válido, o valor do record é
  // preservado (cliente legítimo que não envia preset_fields não o perde).
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
    // Normalização inline do valor lido do record (string | bytes | objeto)
    const recPf = e.record.get('preset_fields')
    let recPfObj = null
    try {
      if (recPf && typeof recPf === 'string') {
        try {
          recPfObj = JSON.parse(recPf)
        } catch (_) {
          recPfObj = null
        }
      } else if (Array.isArray(recPf) && recPf.length > 0 && typeof recPf[0] === 'number') {
        let sRec = ''
        for (let i = 0; i < recPf.length; i += 4096) {
          sRec += String.fromCharCode.apply(null, recPf.slice(i, i + 4096))
        }
        try {
          recPfObj = JSON.parse(sRec)
        } catch (bErr) {
          console.log('[area_configs] CREATE record bytes não parsearam: ' + bErr)
          recPfObj = null
        }
      } else if (recPf && typeof recPf === 'object' && !Array.isArray(recPf)) {
        recPfObj = recPf
      }
    } catch (normErr) {
      console.log('[area_configs] CREATE (normalização do record falhou): ' + normErr)
      recPfObj = null
    }
    const normalizedValido =
      normalized && typeof normalized === 'object' && !Array.isArray(normalized)
    const recPfValido = recPfObj && typeof recPfObj === 'object' && !Array.isArray(recPfObj)
    if (normalizedValido && Object.keys(normalized).length > 0) {
      e.record.set('preset_fields', normalized)
      console.log(
        '[area_configs] CREATE preset_fields: caminho=raw-body-aplicado chaves=' +
          Object.keys(normalized).length,
      )
    } else if (recPfValido && Object.keys(recPfObj).length > 0) {
      console.log(
        '[area_configs] CREATE preset_fields: caminho=record-já-tinha chaves=' +
          Object.keys(recPfObj).length,
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
    // preset_fields: normaliza TODAS as representações possíveis lidas do
    // record (string | array de bytes json.RawMessage | objeto) ANTES de
    // decidir — um array de bytes parseável nunca é descartado como inválido.
    let pf = e.record.get('preset_fields')
    let pfObj = null
    try {
      if (pf && typeof pf === 'string') {
        try {
          pfObj = JSON.parse(pf)
        } catch (_) {
          pfObj = null
        }
      } else if (Array.isArray(pf) && pf.length > 0 && typeof pf[0] === 'number') {
        let sPf = ''
        for (let i = 0; i < pf.length; i += 4096) {
          sPf += String.fromCharCode.apply(null, pf.slice(i, i + 4096))
        }
        try {
          pfObj = JSON.parse(sPf)
        } catch (bErr) {
          console.log('[area_configs] CREATE sanitização: bytes não parsearam: ' + bErr)
          pfObj = null
        }
      } else if (pf && typeof pf === 'object' && !Array.isArray(pf)) {
        pfObj = pf
      }
    } catch (normErr) {
      console.log('[area_configs] CREATE (sanitização: normalização falhou): ' + normErr)
      pfObj = null
    }
    if (!pfObj || typeof pfObj !== 'object' || Array.isArray(pfObj)) pfObj = {}
    e.record.set('preset_fields', JSON.parse(JSON.stringify(pfObj)))
    // Primeira versão da configuração
    const ver = e.record.getInt('config_version')
    if (ver < 1) e.record.set('config_version', 1)
    // LOG FINAL: o que será de fato PERSISTIDO (após recuperação + sanitização).
    // O get() aqui devolve array de bytes (json.RawMessage) — normalizar antes
    // de contar chaves, senão o log conta 0 mesmo com dados.
    try {
      const finalPf = e.record.get('preset_fields')
      let finalObj = null
      try {
        if (finalPf && typeof finalPf === 'string') {
          try {
            finalObj = JSON.parse(finalPf)
          } catch (_) {
            finalObj = null
          }
        } else if (Array.isArray(finalPf) && finalPf.length > 0 && typeof finalPf[0] === 'number') {
          let sFin = ''
          for (let i = 0; i < finalPf.length; i += 4096) {
            sFin += String.fromCharCode.apply(null, finalPf.slice(i, i + 4096))
          }
          try {
            finalObj = JSON.parse(sFin)
          } catch (_) {
            finalObj = null
          }
        } else if (finalPf && typeof finalPf === 'object' && !Array.isArray(finalPf)) {
          finalObj = finalPf
        }
      } catch (_) {
        finalObj = null
      }
      const finalKeys =
        finalObj && typeof finalObj === 'object' && !Array.isArray(finalObj)
          ? Object.keys(finalObj).length
          : 0
      console.log('[area_configs] CREATE FINAL presetFieldsKeys=' + finalKeys)
      // TRACE PONTA A PONTA (etapa v): VALORES de infiltration.* recebidos no
      // CREATE — prova do conteúdo, não da contagem.
      if (finalObj && typeof finalObj === 'object') {
        var _traceKeys = [
          'infiltration.geralMorning',
          'infiltration.geralAfternoon',
          'infiltration.bombaInfiltracao',
          'infiltration.bombaGeral',
          'infiltration.infiltration_morning_time',
          'infiltration.infiltration_afternoon_time',
        ]
        for (var _ti = 0; _ti < _traceKeys.length; _ti++) {
          console.log(
            '[trace-infil] CREATE ' +
              _traceKeys[_ti] +
              ' = "' +
              String(finalObj[_traceKeys[_ti]] === undefined ? '' : finalObj[_traceKeys[_ti]]) +
              '"',
          )
        }
      }
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
    } else if (Array.isArray(pfLog) && pfLog.length > 0 && typeof pfLog[0] === 'number') {
      // json.RawMessage no JSVM: array de bytes -> string -> JSON.parse
      let sLog = ''
      for (let i = 0; i < pfLog.length; i += 4096) {
        sLog += String.fromCharCode.apply(null, pfLog.slice(i, i + 4096))
      }
      try {
        pfLog = JSON.parse(sLog)
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

  // RECUPERAÇÃO DO CAMPO JSON (JSVM) — idêntica ao CREATE: normalizamos o
  // preset_fields do body cru (json.RawMessage, array de bytes) e o valor
  // atual do record (string | bytes | objeto). Quando o body traz um objeto
  // válido ele É o valor do campo e é aplicado; quando o body não traz (ou
  // não parseia) e o record já tem objeto válido, o valor do record é
  // preservado (cliente legítimo que não envia preset_fields não o perde).
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
    // Normalização inline do valor lido do record (string | bytes | objeto)
    const recPf = e.record.get('preset_fields')
    let recPfObj = null
    try {
      if (recPf && typeof recPf === 'string') {
        try {
          recPfObj = JSON.parse(recPf)
        } catch (_) {
          recPfObj = null
        }
      } else if (Array.isArray(recPf) && recPf.length > 0 && typeof recPf[0] === 'number') {
        let sRec = ''
        for (let i = 0; i < recPf.length; i += 4096) {
          sRec += String.fromCharCode.apply(null, recPf.slice(i, i + 4096))
        }
        try {
          recPfObj = JSON.parse(sRec)
        } catch (bErr) {
          console.log('[area_configs] UPDATE record bytes não parsearam: ' + bErr)
          recPfObj = null
        }
      } else if (recPf && typeof recPf === 'object' && !Array.isArray(recPf)) {
        recPfObj = recPf
      }
    } catch (normErr) {
      console.log('[area_configs] UPDATE (normalização do record falhou): ' + normErr)
      recPfObj = null
    }
    const normalizedValido =
      normalized && typeof normalized === 'object' && !Array.isArray(normalized)
    const recPfValido = recPfObj && typeof recPfObj === 'object' && !Array.isArray(recPfObj)
    if (normalizedValido && Object.keys(normalized).length > 0) {
      e.record.set('preset_fields', normalized)
      console.log(
        '[area_configs] UPDATE preset_fields: caminho=raw-body-aplicado chaves=' +
          Object.keys(normalized).length,
      )
    } else if (recPfValido && Object.keys(recPfObj).length > 0) {
      console.log(
        '[area_configs] UPDATE preset_fields: caminho=record-já-tinha chaves=' +
          Object.keys(recPfObj).length,
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
    // preset_fields: normaliza TODAS as representações possíveis lidas do
    // record (string | array de bytes json.RawMessage | objeto) ANTES de
    // decidir — um array de bytes parseável nunca é descartado como inválido.
    let pf = e.record.get('preset_fields')
    let pfObj = null
    try {
      if (pf && typeof pf === 'string') {
        try {
          pfObj = JSON.parse(pf)
        } catch (_) {
          pfObj = null
        }
      } else if (Array.isArray(pf) && pf.length > 0 && typeof pf[0] === 'number') {
        let sPf = ''
        for (let i = 0; i < pf.length; i += 4096) {
          sPf += String.fromCharCode.apply(null, pf.slice(i, i + 4096))
        }
        try {
          pfObj = JSON.parse(sPf)
        } catch (bErr) {
          console.log('[area_configs] UPDATE sanitização: bytes não parsearam: ' + bErr)
          pfObj = null
        }
      } else if (pf && typeof pf === 'object' && !Array.isArray(pf)) {
        pfObj = pf
      }
    } catch (normErr) {
      console.log('[area_configs] UPDATE (sanitização: normalização falhou): ' + normErr)
      pfObj = null
    }
    if (!pfObj || typeof pfObj !== 'object' || Array.isArray(pfObj)) pfObj = {}
    e.record.set('preset_fields', JSON.parse(JSON.stringify(pfObj)))
    // Incrementa a versão da configuração (planilhas já preenchidas carregam
    // snapshot, e não a configuração viva — por isso o incremento é seguro)
    const ver = e.record.getInt('config_version')
    e.record.set('config_version', ver + 1)
    // LOG FINAL: o que será de fato PERSISTIDO (após recuperação + sanitização).
    // O get() aqui devolve array de bytes (json.RawMessage) — normalizar antes
    // de contar chaves, senão o log conta 0 mesmo com dados.
    try {
      const finalPf = e.record.get('preset_fields')
      let finalObj = null
      try {
        if (finalPf && typeof finalPf === 'string') {
          try {
            finalObj = JSON.parse(finalPf)
          } catch (_) {
            finalObj = null
          }
        } else if (Array.isArray(finalPf) && finalPf.length > 0 && typeof finalPf[0] === 'number') {
          let sFin = ''
          for (let i = 0; i < finalPf.length; i += 4096) {
            sFin += String.fromCharCode.apply(null, finalPf.slice(i, i + 4096))
          }
          try {
            finalObj = JSON.parse(sFin)
          } catch (_) {
            finalObj = null
          }
        } else if (finalPf && typeof finalPf === 'object' && !Array.isArray(finalPf)) {
          finalObj = finalPf
        }
      } catch (_) {
        finalObj = null
      }
      const finalKeys =
        finalObj && typeof finalObj === 'object' && !Array.isArray(finalObj)
          ? Object.keys(finalObj).length
          : 0
      console.log('[area_configs] UPDATE FINAL presetFieldsKeys=' + finalKeys)
      // TRACE PONTA A PONTA (etapa v): VALORES de infiltration.* recebidos e que
      // serão persistidos — prova do conteúdo, não da contagem.
      if (finalObj && typeof finalObj === 'object') {
        var _traceKeys = [
          'infiltration.geralMorning',
          'infiltration.geralAfternoon',
          'infiltration.bombaInfiltracao',
          'infiltration.bombaGeral',
          'infiltration.infiltration_morning_time',
          'infiltration.infiltration_afternoon_time',
        ]
        for (var _ti = 0; _ti < _traceKeys.length; _ti++) {
          console.log(
            '[trace-infil] UPDATE ' +
              _traceKeys[_ti] +
              ' = "' +
              String(finalObj[_traceKeys[_ti]] === undefined ? '' : finalObj[_traceKeys[_ti]]) +
              '"',
          )
        }
      }
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
