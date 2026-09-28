/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const fieldsToConvert = [
      'waste_liquid_qty',
      'waste_solid_qty',
      'pluviometer',
      'nutrient_map_kg',
      'nutrient_ureia_kg',
    ]

    const col = app.findCollectionByNameOrId('field_spreadsheets')

    // 1. Criar campos temporários de texto para receber os dados convertidos
    for (let i = 0; i < fieldsToConvert.length; i++) {
      const fieldName = fieldsToConvert[i]
      const tempName = `temp_${fieldName}`
      if (!col.fields.getByName(tempName)) {
        col.fields.add(
          new TextField({
            name: tempName,
            required: false,
          }),
        )
      }
    }
    app.save(col)

    // 2. Copiar dados existentes convertendo valores numéricos para string
    // PocketBase SQLite: CAST(field AS TEXT) ou CASE WHEN field IS NOT NULL
    for (let i = 0; i < fieldsToConvert.length; i++) {
      const fieldName = fieldsToConvert[i]
      const tempName = `temp_${fieldName}`
      app
        .db()
        .newQuery(
          `UPDATE field_spreadsheets SET ${tempName} = CASE WHEN ${fieldName} IS NOT NULL AND ${fieldName} != '' THEN CAST(${fieldName} AS TEXT) ELSE '' END`,
        )
        .execute()
    }

    // 3. Remover campos antigos numéricos
    const colAfterCopy = app.findCollectionByNameOrId('field_spreadsheets')
    for (let i = 0; i < fieldsToConvert.length; i++) {
      const fieldName = fieldsToConvert[i]
      const oldField = colAfterCopy.fields.getByName(fieldName)
      if (oldField) {
        colAfterCopy.fields.removeById(oldField.id)
      }
    }
    app.save(colAfterCopy)

    // 4. Recriar os campos com os nomes originais como TextField
    const colForFinal = app.findCollectionByNameOrId('field_spreadsheets')
    for (let i = 0; i < fieldsToConvert.length; i++) {
      const fieldName = fieldsToConvert[i]
      if (!colForFinal.fields.getByName(fieldName)) {
        colForFinal.fields.add(
          new TextField({
            name: fieldName,
            required: false,
          }),
        )
      }
    }
    app.save(colForFinal)

    // 5. Copiar dados de temp para o campo original de texto
    for (let i = 0; i < fieldsToConvert.length; i++) {
      const fieldName = fieldsToConvert[i]
      const tempName = `temp_${fieldName}`
      app
        .db()
        .newQuery(`UPDATE field_spreadsheets SET ${fieldName} = COALESCE(${tempName}, '')`)
        .execute()
    }

    // 6. Remover campos temporários
    const colFinalCleanup = app.findCollectionByNameOrId('field_spreadsheets')
    for (let i = 0; i < fieldsToConvert.length; i++) {
      const tempName = `temp_${fieldsToConvert[i]}`
      const tempField = colFinalCleanup.fields.getByName(tempName)
      if (tempField) {
        colFinalCleanup.fields.removeById(tempField.id)
      }
    }
    app.save(colFinalCleanup)
  },
  (app) => {
    // Revert para NumberField caso necessário
    const fieldsToRevert = [
      'waste_liquid_qty',
      'waste_solid_qty',
      'pluviometer',
      'nutrient_map_kg',
      'nutrient_ureia_kg',
    ]
    const col = app.findCollectionByNameOrId('field_spreadsheets')
    for (let i = 0; i < fieldsToRevert.length; i++) {
      const fieldName = fieldsToRevert[i]
      const f = col.fields.getByName(fieldName)
      if (f) {
        col.fields.removeById(f.id)
      }
      col.fields.add(
        new NumberField({
          name: fieldName,
          required: false,
        }),
      )
    }
    app.save(col)
  },
)
