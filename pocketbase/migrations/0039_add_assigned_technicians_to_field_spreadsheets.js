/// <reference path="../pb_data/types.d.ts" />

// Vínculo múltiplo de técnicos por Planilha de Campo.
// Campo opcional, relação multi com a coleção de usuários.
// A regra de visibilidade do técnico NÃO é alterada aqui.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const col = app.findCollectionByNameOrId('field_spreadsheets')

    col.fields.add(
      new RelationField({
        name: 'assigned_technicians',
        collectionId: users.id,
        required: false,
        maxSelect: 50,
        cascadeDelete: false,
      }),
    )

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('field_spreadsheets')
    col.fields.removeByName('assigned_technicians')
    app.save(col)
  },
)
