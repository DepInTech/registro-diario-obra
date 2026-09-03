migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('field_spreadsheets')

    if (!col.fields.getByName('infiltration_morning_time')) {
      col.fields.add(
        new TextField({
          name: 'infiltration_morning_time',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('infiltration_afternoon_time')) {
      col.fields.add(
        new TextField({
          name: 'infiltration_afternoon_time',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('field_spreadsheets')
    const mField = col.fields.getByName('infiltration_morning_time')
    if (mField) {
      col.fields.removeById(mField.id)
    }
    const aField = col.fields.getByName('infiltration_afternoon_time')
    if (aField) {
      col.fields.removeById(aField.id)
    }
    app.save(col)
  },
)
