/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Limpar os dados de exemplo dos registros in_situ_sheets existentes no banco, se houver,
    // preservando o registro em si (reseta nutrient_rows e records com valores de exemplo "02" / "15/07/26").
    try {
      const records = app.findRecordsByFilter('in_situ_sheets', '', '', 500, 0)
      for (const rec of records) {
        let changed = false

        // Se nutrient_rows tiver o padrão de exemplo inicial de 15 linhas não editadas
        const rows = rec.get('nutrient_rows')
        if (Array.isArray(rows) && rows.length > 0) {
          // Verifica se são apenas as linhas padrão de exemplo (sem preenchimento real de medição)
          const hasRealData = rows.some(
            (r) =>
              (r.ph && r.ph !== '') ||
              (r.conductivity && r.conductivity !== '') ||
              (r.od_mg_l && r.od_mg_l !== '') ||
              (r.orp && r.orp !== '') ||
              (r.temperature_c && r.temperature_c !== '') ||
              (r.weather && r.weather !== '') ||
              (r.responsible && r.responsible !== ''),
          )
          if (!hasRealData) {
            rec.set('nutrient_rows', [])
            changed = true
          }
        }

        // Se records legado tiver exemplos
        const legacy = rec.get('records')
        if (Array.isArray(legacy) && legacy.length > 0) {
          const hasRealLegacy = legacy.some(
            (r) =>
              (r.ph && r.ph !== '') ||
              (r.conductivity && r.conductivity !== '') ||
              (r.od_mg_l && r.od_mg_l !== ''),
          )
          if (!hasRealLegacy) {
            rec.set('records', [])
            changed = true
          }
        }

        if (changed) {
          app.save(rec)
        }
      }
    } catch (_) {}
  },
  () => {},
)
