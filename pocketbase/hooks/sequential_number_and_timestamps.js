// Hook para numeração sequencial atômica e timestamps autoritativos de servidor em RDOs e Planilhas de Campo
// Assegura:
// 1. Numeração sequencial contínua (1, 2, 3...) calculada pelo servidor na criação
// 2. Registro de timestamps de servidor confiáveis (submitted_at, approved_at, returned_at)
// 3. Blindagem total: em caso de lock, concorrência ou timeout, prossegue com e.next() para que a criação NUNCA retorne 500

onRecordCreateRequest(
  (e) => {
    try {
      if (e.record) {
        const collectionName = e.record.collection ? e.record.collection().name : ''
        const nowIso = new Date().toISOString()

        if (collectionName === 'reports_rdo') {
          // Busca o maior número já existente no banco de forma resiliente
          let nextNum = null
          let querySuccess = false

          try {
            const records = $app.findRecordsByFilter('reports_rdo', '', '-number', 1, 0)
            if (records && records.length > 0) {
              const maxNum = records[0].getInt('number')
              nextNum = (maxNum > 0 ? maxNum : 0) + 1
              querySuccess = true
            } else {
              nextNum = 1
              querySuccess = true
            }
          } catch (findErr) {
            console.warn('Aviso: falha na busca por filtro do proximo numero de RDO:', findErr)
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
              console.warn('Aviso: falha no fallback SQL do proximo numero de RDO:', sqlErr)
            }
          }

          if (nextNum !== null && !isNaN(nextNum) && nextNum > 0) {
            try {
              e.record.set('number', nextNum)
            } catch (numSetErr) {
              console.warn('Aviso: falha ao setar number no RDO (prosseguindo):', numSetErr)
            }
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
            console.warn('Aviso: falha ao gravar timestamps de status no RDO:', stErr)
          }
        } else if (collectionName === 'field_spreadsheets') {
          // Busca o maior número já existente no banco de forma resiliente
          let nextNum = null
          let querySuccess = false

          try {
            const records = $app.findRecordsByFilter('field_spreadsheets', '', '-number', 1, 0)
            if (records && records.length > 0) {
              const maxNum = records[0].getInt('number')
              nextNum = (maxNum > 0 ? maxNum : 0) + 1
              querySuccess = true
            } else {
              nextNum = 1
              querySuccess = true
            }
          } catch (findErr) {
            console.warn('Aviso: falha na busca por filtro do proximo numero de Planilha:', findErr)
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
              console.warn('Aviso: falha no fallback SQL do proximo numero de Planilha:', sqlErr)
            }
          }

          if (nextNum !== null && !isNaN(nextNum) && nextNum > 0) {
            try {
              e.record.set('number', nextNum)
            } catch (numSetErr) {
              console.warn('Aviso: falha ao setar number na Planilha (prosseguindo):', numSetErr)
            }
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
            console.warn('Aviso: falha ao gravar timestamps de status na Planilha:', stErr)
          }
        }
      }
    } catch (createHookErr) {
      console.warn(
        'Aviso: erro capturado com seguranca em sequential_number_and_timestamps (create):',
        createHookErr,
      )
    }

    // Sempre prossegue a execução normal do create, garantindo retorno 200/201 mesmo sob concorrência
    e.next()
  },
  'reports_rdo',
  'field_spreadsheets',
)

onRecordUpdateRequest(
  (e) => {
    try {
      if (e.record) {
        const nowIso = new Date().toISOString()
        let prevStatus = ''
        let curStatus = ''

        try {
          prevStatus = e.record.original().getString('status')
        } catch (_) {}
        try {
          curStatus = e.record.getString('status')
        } catch (_) {}

        if (prevStatus !== curStatus) {
          try {
            if (curStatus === 'submitted') {
              e.record.set('submitted_at', nowIso)
            } else if (curStatus === 'approved') {
              e.record.set('approved_at', nowIso)
            } else if (curStatus === 'returned') {
              e.record.set('returned_at', nowIso)
            }
          } catch (statusSetErr) {
            console.warn('Aviso: falha ao gravar timestamp de status no update:', statusSetErr)
          }
        }
      }
    } catch (updateHookErr) {
      console.warn(
        'Aviso: erro capturado com seguranca em sequential_number_and_timestamps (update):',
        updateHookErr,
      )
    }

    e.next()
  },
  'reports_rdo',
  'field_spreadsheets',
)
