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
        let existingSnapshot = null
        try {
          existingSnapshot = e.record.get('admin_snapshot')
          if (typeof existingSnapshot === 'string' && existingSnapshot.trim() !== '') {
            existingSnapshot = JSON.parse(existingSnapshot)
          }
        } catch (_) {}

        if (collectionName === 'reports_rdo') {
          const supId = e.record.getString('supervised_by')
          const needsSupName =
            !existingSnapshot ||
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
              const snapshotToSave =
                existingSnapshot && typeof existingSnapshot === 'object' ? existingSnapshot : {}
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
            !existingSnapshot ||
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
              const snapshotToSave =
                existingSnapshot && typeof existingSnapshot === 'object' ? existingSnapshot : {}
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
        let existingSnapshot = null
        try {
          existingSnapshot = e.record.get('admin_snapshot')
          if (typeof existingSnapshot === 'string' && existingSnapshot.trim() !== '') {
            existingSnapshot = JSON.parse(existingSnapshot)
          }
        } catch (_) {}

        if (collectionName === 'reports_rdo') {
          const supId = e.record.getString('supervised_by')
          const needsSupName =
            !existingSnapshot ||
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
              const snapshotToSave =
                existingSnapshot && typeof existingSnapshot === 'object' ? existingSnapshot : {}
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
            !existingSnapshot ||
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
              const snapshotToSave =
                existingSnapshot && typeof existingSnapshot === 'object' ? existingSnapshot : {}
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
      console.warn('Aviso: falha em admin_snapshot_guard (update):', hookErr)
    }

    e.next()
  },
  'reports_rdo',
  'field_spreadsheets',
)
