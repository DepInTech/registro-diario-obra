/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      const auditLogs = app.findCollectionByNameOrId('audit_logs')
      const actionField = auditLogs.fields.getByName('action')
      if (actionField && actionField.values) {
        const currentVals = actionField.values || []
        const newVals = Array.from(new Set([...currentVals, 'add_well']))
        actionField.values = newVals
        actionField.maxSelect = 1
        app.save(auditLogs)
      }
    } catch (err) {
      console.warn('Migration 0034 notice:', err)
    }
  },
  (app) => {
    // down migration
  },
)
