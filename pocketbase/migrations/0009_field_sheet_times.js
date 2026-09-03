migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('field_spreadsheets')

    if (!col.fields.getByName('morning_time')) {
      col.fields.add(
        new TextField({
          name: 'morning_time',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('afternoon_time')) {
      col.fields.add(
        new TextField({
          name: 'afternoon_time',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('field_spreadsheets')
    const morningField = col.fields.getByName('morning_time')
    if (morningField) {
      col.fields.removeById(morningField.id)
    }
    const afternoonField = col.fields.getByName('afternoon_time')
    if (afternoonField) {
      col.fields.removeById(afternoonField.id)
    }
    app.save(col)
  },
)
