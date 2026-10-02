/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('in_situ_sheets')

    // 1. Tornar measurement_point opcional (não obrigatório) caso ainda esteja como required
    const pointField = col.fields.getByName('measurement_point')
    if (pointField) {
      pointField.required = false
    }

    // 2. nutrient_rows (json) para persistir as linhas da tabela de medição
    if (!col.fields.getByName('nutrient_rows')) {
      col.fields.add(
        new JSONField({
          name: 'nutrient_rows',
          maxSize: 2000000,
        }),
      )
    }

    // 3. date (text) para guardar a data manual da planilha in-situ no formato DD/MM/AAAA ou ISO
    if (!col.fields.getByName('date')) {
      col.fields.add(
        new TextField({
          name: 'date',
        }),
      )
    }

    // 4. rev (text) para o número da revisão da planilha (ex: "02", "01", "03")
    if (!col.fields.getByName('rev')) {
      col.fields.add(
        new TextField({
          name: 'rev',
        }),
      )
    }

    // 5. rev_date (text) para a data da revisão da planilha (ex: "15/07/26")
    if (!col.fields.getByName('rev_date')) {
      col.fields.add(
        new TextField({
          name: 'rev_date',
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('in_situ_sheets')
      col.fields.removeByName('nutrient_rows')
      col.fields.removeByName('date')
      col.fields.removeByName('rev')
      col.fields.removeByName('rev_date')
      app.save(col)
    } catch (_) {}
  },
)
