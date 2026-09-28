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
            if (typeof val === 'string') {
              const trimmed = val.trim()
              if (!trimmed) return {}
              const p = JSON.parse(trimmed)
              return p && typeof p === 'object' && !Array.isArray(p) ? p : {}
            }
            // Se for Go map ou Go slice ou objeto, JSON roundtrip cria um Object puro JS
            const str = JSON.stringify(val)
            const p = JSON.parse(str)
            return p && typeof p === 'object' && !Array.isArray(p) ? p : {}
          } catch (_) {
            return {}
          }
        }

        let existingSnapshot = parseSnapshotObj(e.record.get('admin_snapshot'))

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
            if (typeof rawSnap === 'string' && rawSnap.trim() !== '') {
              const parsed = JSON.parse(rawSnap)
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                snapshot = parsed
              }
            } else if (rawSnap && typeof rawSnap === 'object' && !Array.isArray(rawSnap)) {
              snapshot = JSON.parse(JSON.stringify(rawSnap))
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

              // d) Inspeciona filled_fields genéricos para reports_rdo (ex.: activity_title etc se preenchidos no snapshot)
              for (const [fName, fVal] of Object.entries(filledFields)) {
                if (fVal === undefined || fVal === null || String(fVal).trim() === '') continue
                // Mapeamento de nomes camelCase para schema PocketBase
                let colField = fName
                if (fName === 'performedByName' || fName === 'performedBy')
                  colField = 'performed_by'
                if (fName === 'supervisedByName' || fName === 'supervisedBy')
                  colField = 'supervised_by'
                if (fName === 'companyName' || fName === 'empresa_executora')
                  colField = 'empresa_executora'

                if (
                  colField === 'supervised_by' ||
                  colField === 'performed_by' ||
                  colField === 'empresa_executora'
                ) {
                  // Já checados ou relação
                  continue
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

              // b) poços e altura da bomba configurados pelo Admin em extraction_data
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

              // c) Garante que o Técnico NÃO possa sobrescrever ou limpar o admin_snapshot existente
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
            if (typeof val === 'string') {
              const trimmed = val.trim()
              if (!trimmed) return {}
              const p = JSON.parse(trimmed)
              return p && typeof p === 'object' && !Array.isArray(p) ? p : {}
            }
            const str = JSON.stringify(val)
            const p = JSON.parse(str)
            return p && typeof p === 'object' && !Array.isArray(p) ? p : {}
          } catch (_) {
            return {}
          }
        }

        let existingSnapshot = parseSnapshotObjUpdate(e.record.get('admin_snapshot'))

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
