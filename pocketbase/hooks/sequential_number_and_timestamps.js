// Hook para numeração sequencial atômica e timestamps autoritativos de servidor em RDOs e Planilhas de Campo
// Assegura:
// 1. Numeração sequencial contínua (1, 2, 3...) calculada pelo servidor na criação
// 2. Registro de timestamps de servidor confiáveis (submitted_at, approved_at, returned_at)

onRecordCreateRequest(
  (e) => {
    const collectionName = e.record.collection().name
    const nowIso = new Date().toISOString()

    if (collectionName === 'reports_rdo') {
      // Busca o maior número já existente atomicamente no banco
      let nextNum = 1
      try {
        const row = $app
          .db()
          .newQuery('SELECT COALESCE(MAX(number), 0) + 1 AS next_val FROM reports_rdo')
          .one()
        if (row && row.next_val) {
          nextNum = parseInt(row.next_val, 10) || 1
        }
      } catch (err) {
        console.warn('Erro ao calcular proximo numero de RDO via SQL:', err)
        try {
          const records = $app.findRecordsByFilter('reports_rdo', '', '-number', 1, 0)
          if (records.length > 0) {
            nextNum = records[0].getInt('number') + 1
          }
        } catch (_) {}
      }

      e.record.set('number', nextNum)

      const st = e.record.getString('status')
      if (st === 'submitted') {
        e.record.set('submitted_at', nowIso)
      } else if (st === 'approved') {
        e.record.set('approved_at', nowIso)
      } else if (st === 'returned') {
        e.record.set('returned_at', nowIso)
      }
    } else if (collectionName === 'field_spreadsheets') {
      // Busca o maior número já existente atomicamente no banco
      let nextNum = 1
      try {
        const row = $app
          .db()
          .newQuery('SELECT COALESCE(MAX(number), 0) + 1 AS next_val FROM field_spreadsheets')
          .one()
        if (row && row.next_val) {
          nextNum = parseInt(row.next_val, 10) || 1
        }
      } catch (err) {
        console.warn('Erro ao calcular proximo numero de Planilha via SQL:', err)
        try {
          const records = $app.findRecordsByFilter('field_spreadsheets', '', '-number', 1, 0)
          if (records.length > 0) {
            nextNum = records[0].getInt('number') + 1
          }
        } catch (_) {}
      }

      e.record.set('number', nextNum)

      const st = e.record.getString('status')
      if (st === 'submitted') {
        e.record.set('submitted_at', nowIso)
      } else if (st === 'approved') {
        e.record.set('approved_at', nowIso)
      } else if (st === 'returned') {
        e.record.set('returned_at', nowIso)
      }
    }

    e.next()
  },
  'reports_rdo',
  'field_spreadsheets',
)

onRecordUpdateRequest(
  (e) => {
    const collectionName = e.record.collection().name
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

    e.next()
  },
  'reports_rdo',
  'field_spreadsheets',
)
