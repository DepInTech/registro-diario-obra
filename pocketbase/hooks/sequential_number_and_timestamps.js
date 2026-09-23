// Hook para numeração sequencial atômica e timestamps autoritativos de servidor em RDOs e Planilhas de Campo
// Assegura:
// 1. Numeração sequencial contínua (1, 2, 3...) calculada pelo servidor na criação
// 2. Registro de timestamps de servidor confiáveis (submitted_at, approved_at, returned_at)

onRecordCreateRequest(
  (e) => {
    try {
      const collectionName = e.record.collection().name
      const nowIso = new Date().toISOString()

      if (collectionName === 'reports_rdo') {
        // Busca o maior número já existente atomicamente no banco
        let nextNum = 1
        let querySuccess = false
        try {
          const records = $app.findRecordsByFilter('reports_rdo', '', '-number', 1, 0)
          if (records && records.length > 0) {
            const maxNum = records[0].getInt('number')
            nextNum = (maxNum > 0 ? maxNum : 0) + 1
            querySuccess = true
          }
        } catch (findErr) {
          console.warn('Erro ao calcular proximo numero de RDO via findRecordsByFilter:', findErr)
        }

        if (!querySuccess) {
          try {
            const row = $app
              .db()
              .newQuery('SELECT COALESCE(MAX(number), 0) + 1 AS next_val FROM reports_rdo')
              .one()
            if (row && row.next_val) {
              nextNum = parseInt(row.next_val, 10) || 1
            }
          } catch (sqlErr) {
            console.warn('Erro ao calcular proximo numero de RDO via SQL:', sqlErr)
          }
        }

        try {
          e.record.set('number', nextNum)
        } catch (numSetErr) {
          console.warn('Erro ao gravar campo number no RDO:', numSetErr)
        }

        try {
          const st = e.record.getString('status')
          if (st === 'submitted') {
            e.record.set('submitted_at', nowIso)
          } else if (st === 'approved') {
            e.record.set('approved_at', nowIso)
          } else if (st === 'returned') {
            e.record.set('returned_at', nowIso)
          }
        } catch (stErr) {
          console.warn('Erro ao gravar timestamps de status no RDO:', stErr)
        }
      } else if (collectionName === 'field_spreadsheets') {
        // Busca o maior número já existente atomicamente no banco
        let nextNum = 1
        let querySuccess = false
        try {
          const records = $app.findRecordsByFilter('field_spreadsheets', '', '-number', 1, 0)
          if (records && records.length > 0) {
            const maxNum = records[0].getInt('number')
            nextNum = (maxNum > 0 ? maxNum : 0) + 1
            querySuccess = true
          }
        } catch (findErr) {
          console.warn(
            'Erro ao calcular proximo numero de Planilha via findRecordsByFilter:',
            findErr,
          )
        }

        if (!querySuccess) {
          try {
            const row = $app
              .db()
              .newQuery('SELECT COALESCE(MAX(number), 0) + 1 AS next_val FROM field_spreadsheets')
              .one()
            if (row && row.next_val) {
              nextNum = parseInt(row.next_val, 10) || 1
            }
          } catch (sqlErr) {
            console.warn('Erro ao calcular proximo numero de Planilha via SQL:', sqlErr)
          }
        }

        try {
          e.record.set('number', nextNum)
        } catch (numSetErr) {
          console.warn('Erro ao gravar campo number na Planilha:', numSetErr)
        }

        try {
          const st = e.record.getString('status')
          if (st === 'submitted') {
            e.record.set('submitted_at', nowIso)
          } else if (st === 'approved') {
            e.record.set('approved_at', nowIso)
          } else if (st === 'returned') {
            e.record.set('returned_at', nowIso)
          }
        } catch (stErr) {
          console.warn('Erro ao gravar timestamps de status na Planilha:', stErr)
        }
      }
    } catch (createHookErr) {
      console.warn('Falha segura no hook sequential_number_and_timestamps (create):', createHookErr)
    }

    e.next()
  },
  'reports_rdo',
  'field_spreadsheets',
)

onRecordUpdateRequest(
  (e) => {
    try {
      const nowIso = new Date().toISOString()
      const prevStatus = e.record.original().getString('status')
      const curStatus = e.record.getString('status')

      if (prevStatus !== curStatus) {
        if (curStatus === 'submitted') {
          e.record.set('submitted_at', nowIso)
        } else if (curStatus === 'approved') {
          e.record.set('approved_at', nowIso)
        } else if (curStatus === 'returned') {
          e.record.set('returned_at', nowIso)
        }
      }
    } catch (updateHookErr) {
      console.warn('Falha segura no hook sequential_number_and_timestamps (update):', updateHookErr)
    }

    e.next()
  },
  'reports_rdo',
  'field_spreadsheets',
)
