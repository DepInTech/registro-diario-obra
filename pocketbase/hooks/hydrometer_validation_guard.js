// Hook para validação do hidrômetro em field_spreadsheets
// Garante que a leitura do hidrômetro (manhã/tarde) não seja menor que a leitura anterior registrada
// para o mesmo poço no mesmo projeto, e que afternoon >= morning no mesmo poço.
// Suporta separadores brasileiros de milhar ("1.250" -> 1250) e decimais ("1.250,5" -> 1250.5).
// Lança BadRequestError com a mensagem EXATA:
// "⚠️ Leitura inválida. O valor informado não pode ser menor que a leitura anterior deste hidrômetro."

onRecordCreateRequest((e) => {
  try {
    if (e.record) {
      const record = e.record
      const projectId = record.getString('project')
      if (projectId) {
        let rawExt = record.get('extraction_data')
        if (typeof rawExt === 'string' && rawExt.trim() !== '') {
          try {
            rawExt = JSON.parse(rawExt)
          } catch (_) {
            rawExt = []
          }
        }

        if (Array.isArray(rawExt) && rawExt.length > 0) {
          const parseNum = (val) => {
            if (val === null || val === undefined || val === '') return null
            let s = String(val).trim()
            if (s === '') return null

            if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
              if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
                // PT-BR: 1.250,50 -> 1250.50
                s = s.replace(/\./g, '').replace(',', '.')
              } else {
                // EN-US: 1,250.50 -> 1250.50
                s = s.replace(/,/g, '')
              }
            } else if (s.indexOf(',') !== -1) {
              s = s.replace(',', '.')
            } else if (s.indexOf('.') !== -1) {
              const parts = s.split('.')
              if (parts.length > 2) {
                s = s.replace(/\./g, '')
              } else if (parts.length === 2 && parts[1].length === 3) {
                // Ex: 1.250 -> 1250
                s = s.replace(/\./g, '')
              }
            }

            const n = parseFloat(s)
            return isNaN(n) ? null : n
          }

          const normWell = (w) =>
            String(w || '')
              .trim()
              .toUpperCase()

          // 1. Validação intra-ficha: afternoon >= morning no mesmo poço
          for (let i = 0; i < rawExt.length; i++) {
            const row = rawExt[i]
            if (!row) continue
            const mVal = parseNum(row.morning)
            const aVal = parseNum(row.afternoon)
            if (mVal !== null && aVal !== null && aVal < mVal) {
              throw new BadRequestError(
                '⚠️ Leitura inválida. O valor informado não pode ser menor que a leitura anterior deste hidrômetro.',
              )
            }
          }

          // 2. Validação inter-fichas: comparar com a última leitura registrada do mesmo poço no mesmo projeto
          const currentId = record.id || ''
          let filter = "project = '" + projectId + "' && deleted = false"
          if (currentId) {
            filter += " && id != '" + currentId + "'"
          }

          let candidateSheets = []
          try {
            candidateSheets = $app.findRecordsByFilter(
              'field_spreadsheets',
              filter,
              '-date,-created',
              25,
              0,
            )
          } catch (_) {
            candidateSheets = []
          }

          if (Array.isArray(candidateSheets) && candidateSheets.length > 0) {
            const lastReadingsByWell = {}
            for (let sIdx = 0; sIdx < candidateSheets.length; sIdx++) {
              const pastSheet = candidateSheets[sIdx]
              let pastExt = pastSheet.get('extraction_data')
              if (typeof pastExt === 'string' && pastExt.trim() !== '') {
                try {
                  pastExt = JSON.parse(pastExt)
                } catch (_) {
                  pastExt = []
                }
              }
              if (!Array.isArray(pastExt)) continue

              for (let pIdx = 0; pIdx < pastExt.length; pIdx++) {
                const pRow = pastExt[pIdx]
                if (!pRow) continue
                const wKey = normWell(pRow.well)
                if (!wKey) continue
                if (lastReadingsByWell[wKey] !== undefined) continue

                const pA = parseNum(pRow.afternoon)
                const pM = parseNum(pRow.morning)
                const highestPast = pA !== null ? pA : pM !== null ? pM : null
                if (highestPast !== null) {
                  lastReadingsByWell[wKey] = highestPast
                }
              }
            }

            for (let cIdx = 0; cIdx < rawExt.length; cIdx++) {
              const curRow = rawExt[cIdx]
              if (!curRow) continue
              const curKey = normWell(curRow.well)
              if (!curKey) continue

              const baseline = lastReadingsByWell[curKey]
              if (baseline === undefined || baseline === null) continue

              const curM = parseNum(curRow.morning)
              const curA = parseNum(curRow.afternoon)

              if (curM !== null && curM < baseline) {
                throw new BadRequestError(
                  '⚠️ Leitura inválida. O valor informado não pode ser menor que a leitura anterior deste hidrômetro.',
                )
              }
              if (curA !== null && curA < baseline) {
                throw new BadRequestError(
                  '⚠️ Leitura inválida. O valor informado não pode ser menor que a leitura anterior deste hidrômetro.',
                )
              }
            }
          }
        }
      }
    }
  } catch (hookErr) {
    if (hookErr instanceof BadRequestError || hookErr instanceof ForbiddenError) {
      throw hookErr
    }
    console.warn('Aviso: falha defensiva em hydrometer_validation_guard (create):', hookErr)
  }

  e.next()
}, 'field_spreadsheets')

onRecordUpdateRequest((e) => {
  try {
    if (e.record) {
      const record = e.record
      const projectId = record.getString('project')
      if (projectId) {
        let rawExt = record.get('extraction_data')
        if (typeof rawExt === 'string' && rawExt.trim() !== '') {
          try {
            rawExt = JSON.parse(rawExt)
          } catch (_) {
            rawExt = []
          }
        }

        if (Array.isArray(rawExt) && rawExt.length > 0) {
          const parseNum = (val) => {
            if (val === null || val === undefined || val === '') return null
            let s = String(val).trim()
            if (s === '') return null

            if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
              if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
                // PT-BR: 1.250,50 -> 1250.50
                s = s.replace(/\./g, '').replace(',', '.')
              } else {
                // EN-US: 1,250.50 -> 1250.50
                s = s.replace(/,/g, '')
              }
            } else if (s.indexOf(',') !== -1) {
              s = s.replace(',', '.')
            } else if (s.indexOf('.') !== -1) {
              const parts = s.split('.')
              if (parts.length > 2) {
                s = s.replace(/\./g, '')
              } else if (parts.length === 2 && parts[1].length === 3) {
                // Ex: 1.250 -> 1250
                s = s.replace(/\./g, '')
              }
            }

            const n = parseFloat(s)
            return isNaN(n) ? null : n
          }

          const normWell = (w) =>
            String(w || '')
              .trim()
              .toUpperCase()

          // 1. Validação intra-ficha: afternoon >= morning no mesmo poço
          for (let i = 0; i < rawExt.length; i++) {
            const row = rawExt[i]
            if (!row) continue
            const mVal = parseNum(row.morning)
            const aVal = parseNum(row.afternoon)
            if (mVal !== null && aVal !== null && aVal < mVal) {
              throw new BadRequestError(
                '⚠️ Leitura inválida. O valor informado não pode ser menor que a leitura anterior deste hidrômetro.',
              )
            }
          }

          // 2. Validação inter-fichas: comparar com a última leitura registrada do mesmo poço no mesmo projeto
          const currentId = record.id || ''
          let filter = "project = '" + projectId + "' && deleted = false"
          if (currentId) {
            filter += " && id != '" + currentId + "'"
          }

          let candidateSheets = []
          try {
            candidateSheets = $app.findRecordsByFilter(
              'field_spreadsheets',
              filter,
              '-date,-created',
              25,
              0,
            )
          } catch (_) {
            candidateSheets = []
          }

          if (Array.isArray(candidateSheets) && candidateSheets.length > 0) {
            const lastReadingsByWell = {}
            for (let sIdx = 0; sIdx < candidateSheets.length; sIdx++) {
              const pastSheet = candidateSheets[sIdx]
              let pastExt = pastSheet.get('extraction_data')
              if (typeof pastExt === 'string' && pastExt.trim() !== '') {
                try {
                  pastExt = JSON.parse(pastExt)
                } catch (_) {
                  pastExt = []
                }
              }
              if (!Array.isArray(pastExt)) continue

              for (let pIdx = 0; pIdx < pastExt.length; pIdx++) {
                const pRow = pastExt[pIdx]
                if (!pRow) continue
                const wKey = normWell(pRow.well)
                if (!wKey) continue
                if (lastReadingsByWell[wKey] !== undefined) continue

                const pA = parseNum(pRow.afternoon)
                const pM = parseNum(pRow.morning)
                const highestPast = pA !== null ? pA : pM !== null ? pM : null
                if (highestPast !== null) {
                  lastReadingsByWell[wKey] = highestPast
                }
              }
            }

            for (let cIdx = 0; cIdx < rawExt.length; cIdx++) {
              const curRow = rawExt[cIdx]
              if (!curRow) continue
              const curKey = normWell(curRow.well)
              if (!curKey) continue

              const baseline = lastReadingsByWell[curKey]
              if (baseline === undefined || baseline === null) continue

              const curM = parseNum(curRow.morning)
              const curA = parseNum(curRow.afternoon)

              if (curM !== null && curM < baseline) {
                throw new BadRequestError(
                  '⚠️ Leitura inválida. O valor informado não pode ser menor que a leitura anterior deste hidrômetro.',
                )
              }
              if (curA !== null && curA < baseline) {
                throw new BadRequestError(
                  '⚠️ Leitura inválida. O valor informado não pode ser menor que a leitura anterior deste hidrômetro.',
                )
              }
            }
          }
        }
      }
    }
  } catch (hookErr) {
    if (hookErr instanceof BadRequestError || hookErr instanceof ForbiddenError) {
      throw hookErr
    }
    console.warn('Aviso: falha defensiva em hydrometer_validation_guard (update):', hookErr)
  }

  e.next()
}, 'field_spreadsheets')
