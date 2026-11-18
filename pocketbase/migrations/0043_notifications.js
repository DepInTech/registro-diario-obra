/// <reference path="../pb_data/types.d.ts" />
// FUNCIONALIDADE A — Coleção notifications: uma notificação POR destinatário.
// Criada pelo servidor (hook notify_users.js) a cada evento de envio/reenvio/devolução
// de Planilhas de Campo e RDOs, para todos os usuários com role='admin' && active=true
// (envio) ou técnicos atribuídos (devolução). Sem IDs fixos.
migrate(
  (app) => {
    // Idempotente: se já existe (reexecução), apenas garante as regras
    let collection
    try {
      collection = app.findCollectionByNameOrId('notifications')
    } catch (_) {
      collection = null
    }

    if (!collection) {
      collection = new Collection({
        name: 'notifications',
        type: 'base',
        listRule: "@request.auth.id != '' && recipient = @request.auth.id",
        viewRule: "@request.auth.id != '' && recipient = @request.auth.id",
        createRule: null, // criada somente pelo servidor (hooks)
        updateRule: "@request.auth.id != '' && recipient = @request.auth.id",
        deleteRule: "@request.auth.role = 'admin'",
        fields: [
          {
            name: 'recipient',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
          },
          { name: 'title', type: 'text', required: true },
          { name: 'body', type: 'text' },
          {
            name: 'type',
            type: 'select',
            values: ['submitted', 'returned', 'approved', 'info'],
            maxSelect: 1,
          },
          { name: 'entity', type: 'text' },
          { name: 'entity_record', type: 'text' },
          { name: 'read', type: 'bool' },
          { name: 'created_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_notifications_recipient ON notifications (recipient)',
          'CREATE INDEX idx_notifications_read ON notifications (read)',
        ],
      })
      app.save(collection)
    }
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('notifications')
      app.delete(c)
    } catch (_) {}
  },
)
