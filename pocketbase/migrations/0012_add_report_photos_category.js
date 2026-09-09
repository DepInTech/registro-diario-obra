migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('report_photos')

    if (!col.fields.getByName('category')) {
      col.fields.add(
        new SelectField({
          name: 'category',
          required: false,
          values: ['general', 'field_inspection'],
          maxSelect: 1,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('report_photos')
    const categoryField = col.fields.getByName('category')
    if (categoryField) {
      col.fields.removeById(categoryField.id)
    }
    app.save(col)
  },
)
