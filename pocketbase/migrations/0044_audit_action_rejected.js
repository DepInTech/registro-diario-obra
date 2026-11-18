/// <reference path="../pb_data/types.d.ts" />
// FUNCIONALIDADE B — o guard returned_fields_guard.js registra tentativas de edição
// não autorizada em audit_logs com action='rejected'. O enum atual do campo action não
// inclui 'rejected' e a gravação falharia silenciosamente; esta migração adiciona o valor.
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('audit_logs')
    const actionField = collection.fields.getByName('action')
    const values = actionField.values || []
    if (values.indexOf('rejected') === -1) {
      values.push('rejected')
      actionField.values = values
      app.save(collection)
    }
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('audit_logs')
    const actionField = collection.fields.getByName('action')
    const values = (actionField.values || []).filter((v) => v !== 'rejected')
    actionField.values = values
    app.save(collection)
  },
)
