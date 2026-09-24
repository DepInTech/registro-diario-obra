// Adiciona client_token e índices de idempotência em reports_rdo e field_spreadsheets
migrate(
  (app) => {
    // 1. reports_rdo: client_token
    const reportsCol = app.findCollectionByNameOrId('reports_rdo')
    if (!reportsCol.fields.getByName('client_token')) {
      reportsCol.fields.add(
        new TextField({
          name: 'client_token',
          required: false,
        }),
      )
      reportsCol.addIndex('idx_rdo_client_token', false, 'client_token', '')
      app.save(reportsCol)
    }

    // 2. field_spreadsheets: client_token
    const sheetsCol = app.findCollectionByNameOrId('field_spreadsheets')
    if (!sheetsCol.fields.getByName('client_token')) {
      sheetsCol.fields.add(
        new TextField({
          name: 'client_token',
          required: false,
        }),
      )
      sheetsCol.addIndex('idx_sheet_client_token', false, 'client_token', '')
      app.save(sheetsCol)
    }
  },
  (app) => {
    try {
      const reportsCol = app.findCollectionByNameOrId('reports_rdo')
      reportsCol.removeIndex('idx_rdo_client_token')
      const field = reportsCol.fields.getByName('client_token')
      if (field) reportsCol.fields.removeById(field.id)
      app.save(reportsCol)
    } catch (_) {}

    try {
      const sheetsCol = app.findCollectionByNameOrId('field_spreadsheets')
      sheetsCol.removeIndex('idx_sheet_client_token')
      const field = sheetsCol.fields.getByName('client_token')
      if (field) sheetsCol.fields.removeById(field.id)
      app.save(sheetsCol)
    } catch (_) {}
  },
)
