/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Garantir regras estritas de admin para a coleção 'wells'
    const wellsCollection = app.findCollectionByNameOrId('wells')
    if (wellsCollection) {
      wellsCollection.listRule = '@request.auth.id != ""'
      wellsCollection.viewRule = '@request.auth.id != ""'
      wellsCollection.createRule = '@request.auth.role = "admin"'
      wellsCollection.updateRule = '@request.auth.role = "admin"'
      wellsCollection.deleteRule = '@request.auth.role = "admin"'
      app.save(wellsCollection)
    }

    // Garantir regras estritas de admin para coleções de configuração
    const configs = ['clients', 'companies', 'contracts', 'areas']
    for (const name of configs) {
      const col = app.findCollectionByNameOrId(name)
      if (col) {
        col.listRule = '@request.auth.id != ""'
        col.viewRule = '@request.auth.id != ""'
        col.createRule = '@request.auth.role = "admin"'
        col.updateRule = '@request.auth.role = "admin"'
        col.deleteRule = '@request.auth.role = "admin"'
        app.save(col)
      }
    }
  },
  (app) => {
    // Revert
  },
)
