migrate(
  (app) => {
    const reports = app.findCollectionByNameOrId('reports_rdo')
    if (!reports.fields.getByName('vector')) {
      reports.fields.add(
        new JSONField({
          name: 'vector',
          maxSize: 65536,
        }),
      )
    }
    app.save(reports)

    const sheets = app.findCollectionByNameOrId('field_spreadsheets')
    if (!sheets.fields.getByName('review_notes')) {
      sheets.fields.add(new TextField({ name: 'review_notes', max: 3000 }))
    }
    const status = sheets.fields.getByName('status')
    status.values = ['draft', 'submitted', 'approved', 'returned']
    app.save(sheets)
  },
  (app) => {
    const reports = app.findCollectionByNameOrId('reports_rdo')
    const vector = reports.fields.getByName('vector')
    if (vector) reports.fields.removeById(vector.id)
    app.save(reports)

    const sheets = app.findCollectionByNameOrId('field_spreadsheets')
    const notes = sheets.fields.getByName('review_notes')
    if (notes) sheets.fields.removeById(notes.id)
    const status = sheets.fields.getByName('status')
    status.values = ['draft', 'submitted', 'approved']
    app.save(sheets)
  },
)
