// Hook para garantir integridade do admin_snapshot em reports_rdo e field_spreadsheets
// Assegura que, mesmo em envios legados ou sem o snapshot explicitamente preenchido pelo frontend,
// se supervised_by / operator estiver definido, o admin_snapshot seja preenchido no servidor
// com o nome real do usuário do ID, resiliente a falhas (nunca bloqueia a operação)

onRecordCreateRequest(
  (e) => {
    try {
      if (e.record) {
        const collectionName =
          e.collection?.name || (e.record.collection ? e.record.collection().name : '')

        // Sanitização universal prévia no servidor:
        // 1. Data brasileira (DD/MM/AAAA) -> ISO YYYY-MM-DD
        const sanitizeDateStr = (raw) => {
          if (!raw || typeof raw !== 'string') return raw
          const s = raw.trim()
          const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
          if (brMatch) {
            return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`
          }
          return s
        }

        try {
          const d = e.record.get('date')
          if (d && typeof d === 'string') {
            const sd = sanitizeDateStr(d)
            if (sd !== d) e.record.set('date', sd)
          }
        } catch (_) {}

        try {
          const rd = e.record.get('report_date')
          if (rd && typeof rd === 'string') {
            const srd = sanitizeDateStr(rd)
            if (srd !== rd) e.record.set('report_date', srd)
          }
        } catch (_) {}

        try {
          const sub = e.record.get('submitted_at')
          if (sub && typeof sub === 'string') {
            const sSub = sanitizeDateStr(sub)
            if (sSub !== sub) e.record.set('submitted_at', sSub)
          }
        } catch (_) {}

        try {
          const app = e.record.get('approved_at')
          if (app && typeof app === 'string') {
            const sApp = sanitizeDateStr(app)
            if (sApp !== app) e.record.set('approved_at', sApp)
          }
        } catch (_) {}

        try {
          const ret = e.record.get('returned_at')
          if (ret && typeof ret === 'string') {
            const sRet = sanitizeDateStr(ret)
            if (sRet !== ret) e.record.set('returned_at', sRet)
          }
        } catch (_) {}

        try {
          const del = e.record.get('deleted_at')
          if (del && typeof del === 'string') {
            const sDel = sanitizeDateStr(del)
            if (sDel !== del) e.record.set('deleted_at', sDel)
          }
        } catch (_) {}

        // Normalização de campos de texto livre da planilha de campo (se vierem como número ou objeto)
        if (collectionName === 'field_spreadsheets') {
          const textFields = [
            'waste_liquid_qty',
            'waste_solid_qty',
            'pluviometer',
            'nutrient_map_kg',
            'nutrient_ureia_kg',
          ]
          for (let ti = 0; ti < textFields.length; ti++) {
            const tf = textFields[ti]
            try {
              const val = e.record.get(tf)
              if (val !== undefined && val !== null && typeof val !== 'string') {
                e.record.set(tf, String(val))
              }
            } catch (_) {}
          }
        }

        // Helper seguro para obter um JS Object plano a partir de qualquer valor retornado pelo PocketBase/Goja
        const parseSnapshotObj = (val) => {
          if (!val) return {}
          try {
            let cur = val
            let attempts = 0
            while (typeof cur === 'string' && attempts < 3) {
              const trimmed = cur.trim()
              if (
                !trimmed ||
                trimmed === '""' ||
                trimmed === '{}' ||
                trimmed === 'null' ||
                trimmed === 'undefined'
              ) {
                return {}
              }
              cur = JSON.parse(trimmed)
              attempts++
            }
            if (!cur || typeof cur !== 'object' || Array.isArray(cur)) {
              return {}
            }
            // Se for Go map ou Goja wrapper, garante clone JS puro
            const p = JSON.parse(JSON.stringify(cur))
            if (typeof p.filled_fields === 'string') {
              try {
                const pf = JSON.parse(p.filled_fields.trim())
                if (pf && typeof pf === 'object' && !Array.isArray(pf)) p.filled_fields = pf
              } catch (_) {}
            }
            if (typeof p.wells === 'string') {
              try {
                const pw = JSON.parse(p.wells.trim())
                if (Array.isArray(pw)) p.wells = pw
              } catch (_) {}
            }
            return p
          } catch (_) {
            return {}
          }
        }

        let existingSnapshot = parseSnapshotObj(e.record.get('admin_snapshot'))
        // Se já houver admin_snapshot válido, garante normalizado
        if (existingSnapshot && Object.keys(existingSnapshot).length > 0) {
          e.record.set('admin_snapshot', existingSnapshot)
        }

        if (collectionName === 'reports_rdo') {
          const supId = e.record.getString('supervised_by')
          const needsSupName =
            !existingSnapshot.supervised_by_name ||
            String(existingSnapshot.supervised_by_name).trim() === ''

          if (supId && needsSupName) {
            let supName = ''
            try {
              const supUser = $app.findRecordById('users', supId)
              if (supUser) {
                supName = supUser.getString('name')
              }
            } catch (_) {}

            if (supName) {
              const snapshotToSave = Object.assign({}, existingSnapshot)
              snapshotToSave.supervised_by = supId
              snapshotToSave.supervised_by_name = supName
              if (!snapshotToSave.empresa_executora) {
                snapshotToSave.empresa_executora = e.record.getString('empresa_executora') || ''
              }
              if (!snapshotToSave.captured_at) {
                snapshotToSave.captured_at = new Date().toISOString()
              }
              e.record.set('admin_snapshot', snapshotToSave)
            }
          }
        } else if (collectionName === 'field_spreadsheets') {
          const opId = e.record.getString('operator')
          const needsOpName =
            !existingSnapshot.technician_name ||
            String(existingSnapshot.technician_name).trim() === ''

          if (opId && needsOpName) {
            let opName = ''
            try {
              const opUser = $app.findRecordById('users', opId)
              if (opUser) {
                opName = opUser.getString('name')
              }
            } catch (_) {}

            if (opName) {
              const snapshotToSave = Object.assign({}, existingSnapshot)
              snapshotToSave.operator = opId
              snapshotToSave.technician_name = opName
              if (!snapshotToSave.captured_at) {
                snapshotToSave.captured_at = new Date().toISOString()
              }
              e.record.set('admin_snapshot', snapshotToSave)
            }
          }
        }
      }
    } catch (hookErr) {
      console.warn('Aviso: falha em admin_snapshot_guard (create):', hookErr)
    }

    e.next()
  },
  'reports_rdo',
  'field_spreadsheets',
)

onRecordUpdateRequest(
  (e) => {
    try {
      if (e.record) {
        const collectionName =
          e.collection?.name || (e.record.collection ? e.record.collection().name : '')

        // Verifica se a requisição provém de um usuário autenticado não-administrador
        const auth = e.auth
        const isAuthAdmin = auth && auth.getString('role') === 'admin'

        // 1. Barreira do Servidor para não-admin:
        // Se o registro original já possui um admin_snapshot preenchido pelo Administrador,
        // inspeciona tentativa de alteração/limpeza de campos protegidos
        if (!isAuthAdmin && e.record.original()) {
          let snapshot = null
          try {
            const rawSnap = e.record.original().get('admin_snapshot')
            let cur = rawSnap
            let attempts = 0
            while (typeof cur === 'string' && attempts < 3) {
              const trimmed = cur.trim()
              if (
                !trimmed ||
                trimmed === '""' ||
                trimmed === '{}' ||
                trimmed === 'null' ||
                trimmed === 'undefined'
              ) {
                cur = null
                break
              }
              cur = JSON.parse(trimmed)
              attempts++
            }
            if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
              snapshot = JSON.parse(JSON.stringify(cur))
              if (typeof snapshot.filled_fields === 'string') {
                try {
                  const pf = JSON.parse(snapshot.filled_fields.trim())
                  if (pf && typeof pf === 'object' && !Array.isArray(pf))
                    snapshot.filled_fields = pf
                } catch (_) {}
              }
              if (typeof snapshot.wells === 'string') {
                try {
                  const pw = JSON.parse(snapshot.wells.trim())
                  if (Array.isArray(pw)) snapshot.wells = pw
                } catch (_) {}
              }
            }
          } catch (_) {}

          if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
            const filledFields =
              snapshot.filled_fields &&
              typeof snapshot.filled_fields === 'object' &&
              !Array.isArray(snapshot.filled_fields)
                ? snapshot.filled_fields
                : {}

            if (collectionName === 'reports_rdo') {
              // a) supervised_by
              const snapSup = String(
                snapshot.supervised_by || filledFields.supervisedBy || '',
              ).trim()
              if (snapSup) {
                const nextSup = String(e.record.getString('supervised_by') || '').trim()
                if (nextSup !== snapSup) {
                  throw new BadRequestError(
                    'Campo "Supervisionado por" preenchido pelo Administrador não pode ser alterado pelo Técnico.',
                  )
                }
              }

              // b) performed_by
              const snapPerf = String(
                snapshot.performed_by || filledFields.performedBy || '',
              ).trim()
              if (snapPerf) {
                const nextPerf = String(e.record.getString('performed_by') || '').trim()
                if (nextPerf !== snapPerf) {
                  throw new BadRequestError(
                    'Campo "Realizado por" preenchido pelo Administrador não pode ser alterado pelo Técnico.',
                  )
                }
              }

              // c) empresa_executora
              const snapEmp = String(
                snapshot.empresa_executora || filledFields.empresa_executora || '',
              ).trim()
              if (snapEmp) {
                const nextEmp = String(e.record.getString('empresa_executora') || '').trim()
                if (nextEmp !== snapEmp) {
                  throw new BadRequestError(
                    'Campo "Empresa executora" preenchido pelo Administrador não pode ser alterado pelo Técnico.',
                  )
                }
              }

              // d) Inspeciona todos os campos de reports_rdo definidos no snapshot pelo Admin
              // Se o Admin preencheu e o Técnico enviar valor diferente, restaura o valor do Admin
              const rdoFieldMapping = {
                report_date: ['report_date', 'reportDate', 'date'],
                weather: ['weather'],
                activity_title: ['activity_title', 'activityTitle'],
                activity_description: ['activity_description', 'activityDescription'],
                time_displacement: ['time_displacement', 'timeDisplacement'],
                time_waiting: ['time_waiting', 'timeWaiting'],
                interferences: ['interferences'],
                plan_changes: ['plan_changes', 'planChanges'],
                accidents: ['accidents'],
              }

              for (const [colName, aliases] of Object.entries(rdoFieldMapping)) {
                let adminVal = undefined
                for (let a = 0; a < aliases.length; a++) {
                  const k = aliases[a]
                  if (
                    snapshot[k] !== undefined &&
                    snapshot[k] !== null &&
                    String(snapshot[k]).trim() !== ''
                  ) {
                    adminVal = snapshot[k]
                    break
                  }
                  if (
                    filledFields[k] !== undefined &&
                    filledFields[k] !== null &&
                    String(filledFields[k]).trim() !== ''
                  ) {
                    adminVal = filledFields[k]
                    break
                  }
                }

                if (adminVal !== undefined && adminVal !== null && String(adminVal).trim() !== '') {
                  const strAdmin = String(adminVal).trim()
                  const curVal = e.record.get(colName)
                  const strCur =
                    curVal !== undefined && curVal !== null ? String(curVal).trim() : ''
                  if (strCur !== strAdmin) {
                    // Restaura silenciosamente ou garante o valor do Admin
                    e.record.set(colName, adminVal)
                  }
                }
              }

              // e) Garante que o Técnico NÃO possa sobrescrever ou limpar o admin_snapshot existente
              e.record.set('admin_snapshot', snapshot)
            } else if (collectionName === 'field_spreadsheets') {
              // a) operator (técnico responsável)
              const snapOp = String(snapshot.operator || filledFields.operator || '').trim()
              if (snapOp) {
                const nextOp = String(e.record.getString('operator') || '').trim()
                if (nextOp !== snapOp) {
                  throw new BadRequestError(
                    'Campo "Técnico / Responsável" preenchido pelo Administrador não pode ser alterado pelo Técnico.',
                  )
                }
              }

              // b) Inspeciona todos os campos estruturais da Planilha definidos pelo Admin
              // Simples/texto/booleano: date, weather, pluviometer, nutrient_done, nutrient_map_kg, nutrient_ureia_kg,
              // waste_liquid_qty, waste_solid_qty, env_5s_check, env_checklist_monthly, observations,
              // morning_time, afternoon_time, infiltration_morning_time, infiltration_afternoon_time
              const sheetFieldMapping = {
                date: ['date'],
                weather: ['weather'],
                pluviometer: ['pluviometer'],
                nutrient_done: ['nutrient_done'],
                nutrient_map_kg: ['nutrient_map_kg'],
                nutrient_ureia_kg: ['nutrient_ureia_kg'],
                waste_liquid_qty: ['waste_liquid_qty'],
                waste_solid_qty: ['waste_solid_qty'],
                env_5s_check: ['env_5s_check'],
                env_checklist_monthly: ['env_checklist_monthly'],
                observations: ['observations'],
                morning_time: ['morning_time'],
                afternoon_time: ['afternoon_time'],
                infiltration_morning_time: ['infiltration_morning_time'],
                infiltration_afternoon_time: ['infiltration_afternoon_time'],
              }

              for (const [colName, aliases] of Object.entries(sheetFieldMapping)) {
                let adminVal = undefined
                for (let a = 0; a < aliases.length; a++) {
                  const k = aliases[a]
                  if (snapshot[k] !== undefined && snapshot[k] !== null) {
                    if (typeof snapshot[k] === 'boolean' || String(snapshot[k]).trim() !== '') {
                      adminVal = snapshot[k]
                      break
                    }
                  }
                  if (filledFields[k] !== undefined && filledFields[k] !== null) {
                    if (
                      typeof filledFields[k] === 'boolean' ||
                      String(filledFields[k]).trim() !== ''
                    ) {
                      adminVal = filledFields[k]
                      break
                    }
                  }
                }

                if (adminVal !== undefined && adminVal !== null) {
                  if (typeof adminVal === 'boolean') {
                    // Se foi definido como true pelo admin, técnico não pode desligar
                    if (adminVal === true) {
                      e.record.set(colName, true)
                    }
                  } else {
                    const strAdmin = String(adminVal).trim()
                    if (strAdmin !== '') {
                      const curVal = e.record.get(colName)
                      const strCur =
                        curVal !== undefined && curVal !== null ? String(curVal).trim() : ''
                      if (strCur !== strAdmin) {
                        e.record.set(colName, adminVal)
                      }
                    }
                  }
                }
              }

              // c) Objetos JSON estruturais: infiltration_data, compressor_data, oil_removal_data
              const jsonFieldNames = ['infiltration_data', 'compressor_data', 'oil_removal_data']
              for (let j = 0; j < jsonFieldNames.length; j++) {
                const jf = jsonFieldNames[j]
                const adminObj = snapshot[jf] || filledFields[jf]
                if (adminObj && typeof adminObj === 'object' && !Array.isArray(adminObj)) {
                  let curObj = {}
                  try {
                    const raw = e.record.get(jf)
                    if (typeof raw === 'string' && raw.trim() !== '') curObj = JSON.parse(raw)
                    else if (raw && typeof raw === 'object') curObj = raw
                  } catch (_) {}

                  let mergedObj = Object.assign({}, curObj)
                  let changed = false
                  for (const [subK, subV] of Object.entries(adminObj)) {
                    if (subV !== undefined && subV !== null && String(subV).trim() !== '') {
                      const strSubV = String(subV).trim()
                      const curSubV =
                        curObj[subK] !== undefined && curObj[subK] !== null
                          ? String(curObj[subK]).trim()
                          : ''
                      if (curSubV !== strSubV) {
                        mergedObj[subK] = subV
                        changed = true
                      }
                    }
                  }
                  if (changed) {
                    e.record.set(jf, mergedObj)
                  }
                }
              }

              // d) poços e altura da bomba configurados pelo Admin em extraction_data
              const snapWells = Array.isArray(snapshot.wells) ? snapshot.wells : []
              if (snapWells.length > 0) {
                let nextExt = []
                try {
                  nextExt = e.record.get('extraction_data')
                  if (typeof nextExt === 'string' && nextExt.trim() !== '') {
                    nextExt = JSON.parse(nextExt)
                  }
                } catch (_) {}

                if (Array.isArray(nextExt)) {
                  // Não permitir que o técnico apague linhas de poços definidas pelo Admin
                  if (nextExt.length < snapWells.length) {
                    throw new BadRequestError(
                      'Poços configurados pelo Administrador não podem ser removidos pelo Técnico.',
                    )
                  }
                  for (let i = 0; i < snapWells.length; i++) {
                    const sRow = snapWells[i]
                    const nRow = nextExt[i]
                    if (!nRow) {
                      throw new BadRequestError(
                        'Poços configurados pelo Administrador não podem ser removidos pelo Técnico.',
                      )
                    }
                    const sWell = String(sRow.well || '').trim()
                    const nWell = String(nRow.well || '').trim()
                    if (sWell && nWell !== sWell) {
                      throw new BadRequestError(
                        `Identificação do poço ${sWell} definida pelo Administrador não pode ser alterada.`,
                      )
                    }
                    const sPump = String(sRow.pump || '').trim()
                    const nPump = String(nRow.pump || '').trim()
                    if (sPump && nPump !== sPump) {
                      throw new BadRequestError(
                        `Altura da bomba do poço ${sWell || i + 1} definida pelo Administrador não pode ser alterada.`,
                      )
                    }
                  }
                }
              }

              // e) Garante que o Técnico NÃO possa sobrescrever ou limpar o admin_snapshot existente
              e.record.set('admin_snapshot', snapshot)
            }
          }
        }

        // Sanitização de datas no update
        const sanitizeDateStr = (raw) => {
          if (!raw || typeof raw !== 'string') return raw
          const s = raw.trim()
          const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
          if (brMatch) {
            return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`
          }
          return s
        }

        try {
          const d = e.record.get('date')
          if (d && typeof d === 'string') {
            const sd = sanitizeDateStr(d)
            if (sd !== d) e.record.set('date', sd)
          }
        } catch (_) {}

        try {
          const rd = e.record.get('report_date')
          if (rd && typeof rd === 'string') {
            const srd = sanitizeDateStr(rd)
            if (srd !== rd) e.record.set('report_date', srd)
          }
        } catch (_) {}

        try {
          const sub = e.record.get('submitted_at')
          if (sub && typeof sub === 'string') {
            const sSub = sanitizeDateStr(sub)
            if (sSub !== sub) e.record.set('submitted_at', sSub)
          }
        } catch (_) {}

        try {
          const del = e.record.get('deleted_at')
          if (del && typeof del === 'string') {
            const sDel = sanitizeDateStr(del)
            if (sDel !== del) e.record.set('deleted_at', sDel)
          }
        } catch (_) {}

        // Normalização de campos de texto livre da planilha de campo no update
        if (collectionName === 'field_spreadsheets') {
          const textFields = [
            'waste_liquid_qty',
            'waste_solid_qty',
            'pluviometer',
            'nutrient_map_kg',
            'nutrient_ureia_kg',
          ]
          for (let ti = 0; ti < textFields.length; ti++) {
            const tf = textFields[ti]
            try {
              const val = e.record.get(tf)
              if (val !== undefined && val !== null && typeof val !== 'string') {
                e.record.set(tf, String(val))
              }
            } catch (_) {}
          }
        }

        // 2. Se for Admin ou snapshot sem supervisor/operator names, auto-preenche nomes faltantes
        const parseSnapshotObjUpdate = (val) => {
          if (!val) return {}
          try {
            let cur = val
            let attempts = 0
            while (typeof cur === 'string' && attempts < 3) {
              const trimmed = cur.trim()
              if (
                !trimmed ||
                trimmed === '""' ||
                trimmed === '{}' ||
                trimmed === 'null' ||
                trimmed === 'undefined'
              ) {
                return {}
              }
              cur = JSON.parse(trimmed)
              attempts++
            }
            if (!cur || typeof cur !== 'object' || Array.isArray(cur)) {
              return {}
            }
            const p = JSON.parse(JSON.stringify(cur))
            if (typeof p.filled_fields === 'string') {
              try {
                const pf = JSON.parse(p.filled_fields.trim())
                if (pf && typeof pf === 'object' && !Array.isArray(pf)) p.filled_fields = pf
              } catch (_) {}
            }
            if (typeof p.wells === 'string') {
              try {
                const pw = JSON.parse(p.wells.trim())
                if (Array.isArray(pw)) p.wells = pw
              } catch (_) {}
            }
            return p
          } catch (_) {
            return {}
          }
        }

        let existingSnapshot = parseSnapshotObjUpdate(e.record.get('admin_snapshot'))
        if (existingSnapshot && Object.keys(existingSnapshot).length > 0) {
          e.record.set('admin_snapshot', existingSnapshot)
        }

        if (collectionName === 'reports_rdo') {
          const supId = e.record.getString('supervised_by')
          const needsSupName =
            !existingSnapshot.supervised_by_name ||
            String(existingSnapshot.supervised_by_name).trim() === ''

          if (supId && needsSupName) {
            let supName = ''
            try {
              const supUser = $app.findRecordById('users', supId)
              if (supUser) {
                supName = supUser.getString('name')
              }
            } catch (_) {}

            if (supName) {
              const snapshotToSave = Object.assign({}, existingSnapshot)
              snapshotToSave.supervised_by = supId
              snapshotToSave.supervised_by_name = supName
              if (!snapshotToSave.empresa_executora) {
                snapshotToSave.empresa_executora = e.record.getString('empresa_executora') || ''
              }
              if (!snapshotToSave.captured_at) {
                snapshotToSave.captured_at = new Date().toISOString()
              }
              e.record.set('admin_snapshot', snapshotToSave)
            }
          }
        } else if (collectionName === 'field_spreadsheets') {
          const opId = e.record.getString('operator')
          const needsOpName =
            !existingSnapshot.technician_name ||
            String(existingSnapshot.technician_name).trim() === ''

          if (opId && needsOpName) {
            let opName = ''
            try {
              const opUser = $app.findRecordById('users', opId)
              if (opUser) {
                opName = opUser.getString('name')
              }
            } catch (_) {}

            if (opName) {
              const snapshotToSave = Object.assign({}, existingSnapshot)
              snapshotToSave.operator = opId
              snapshotToSave.technician_name = opName
              if (!snapshotToSave.captured_at) {
                snapshotToSave.captured_at = new Date().toISOString()
              }
              e.record.set('admin_snapshot', snapshotToSave)
            }
          }
        }
      }
    } catch (hookErr) {
      if (hookErr instanceof BadRequestError || hookErr instanceof ForbiddenError) {
        throw hookErr
      }
      console.warn('Aviso: falha em admin_snapshot_guard (update):', hookErr)
    }

    e.next()
  },
  'reports_rdo',
  'field_spreadsheets',
)
