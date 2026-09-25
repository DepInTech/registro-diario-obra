/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const projects = app.findCollectionByNameOrId('projects')

    // Adiciona campos para Ficha Base do Admin se não existirem
    if (!projects.fields.getByName('base_sheet_rdo')) {
      projects.fields.add(
        new JSONField({
          name: 'base_sheet_rdo',
          required: false,
        }),
      )
    }

    if (!projects.fields.getByName('base_sheet_field')) {
      projects.fields.add(
        new JSONField({
          name: 'base_sheet_field',
          required: false,
        }),
      )
    }

    if (!projects.fields.getByName('base_sheet_published')) {
      projects.fields.add(
        new BoolField({
          name: 'base_sheet_published',
          required: false,
        }),
      )
    }

    if (!projects.fields.getByName('base_sheet_updated_at')) {
      projects.fields.add(
        new TextField({
          name: 'base_sheet_updated_at',
          required: false,
        }),
      )
    }

    app.save(projects)
  },
  (app) => {
    const projects = app.findCollectionByNameOrId('projects')
    if (projects.fields.getByName('base_sheet_rdo')) {
      projects.fields.removeByName('base_sheet_rdo')
    }
    if (projects.fields.getByName('base_sheet_field')) {
      projects.fields.removeByName('base_sheet_field')
    }
    if (projects.fields.getByName('base_sheet_published')) {
      projects.fields.removeByName('base_sheet_published')
    }
    if (projects.fields.getByName('base_sheet_updated_at')) {
      projects.fields.removeByName('base_sheet_updated_at')
    }
    app.save(projects)
  },
)
