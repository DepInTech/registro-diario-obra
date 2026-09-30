/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. in_situ_sheets: Modelo padronizado para os quatro sistemas (múltiplos registros/dias, mg/L, unidade de condutividade livre)
    const inSituCollection = new Collection({
      name: 'in_situ_sheets',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        { name: 'project_name', type: 'text', required: true },
        { name: 'system_name', type: 'text', required: true },
        { name: 'active_number', type: 'text' },
        { name: 'measurement_point', type: 'text', required: true },
        { name: 'records', type: 'json' },
        {
          name: 'status',
          type: 'select',
          values: ['draft', 'submitted', 'approved', 'returned'],
          maxSelect: 1,
        },
        { name: 'responsible_name', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'client_token', type: 'text' },
        { name: 'archived', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_in_situ_project ON in_situ_sheets (project_name)',
        'CREATE INDEX idx_in_situ_system ON in_situ_sheets (system_name)',
        'CREATE INDEX idx_in_situ_point ON in_situ_sheets (measurement_point)',
      ],
    })
    app.save(inSituCollection)

    // 2. na_area_configs: Configuração fixa de áreas e seus poços feita pelo Admin
    const naAreaConfigCollection = new Collection({
      name: 'na_area_configs',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'admin'",
      updateRule: "@request.auth.role = 'admin'",
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        { name: 'area_name', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'wells', type: 'json' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_na_area_configs_name ON na_area_configs (area_name)'],
    })
    app.save(naAreaConfigCollection)

    // 3. na_sheets: Monitoramento do Nível d'Água preenchido pelo Operador
    const naSheetCollection = new Collection({
      name: 'na_sheets',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        { name: 'area_name', type: 'text', required: true },
        { name: 'date', type: 'date' },
        { name: 'weather', type: 'text' },
        { name: 'responsible_name', type: 'text' },
        { name: 'readings', type: 'json' },
        {
          name: 'status',
          type: 'select',
          values: ['draft', 'submitted', 'approved', 'returned'],
          maxSelect: 1,
        },
        { name: 'notes', type: 'text' },
        { name: 'client_token', type: 'text' },
        { name: 'archived', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_na_sheets_area ON na_sheets (area_name)',
        'CREATE INDEX idx_na_sheets_date ON na_sheets (date)',
      ],
    })
    app.save(naSheetCollection)

    // Seed inicial opcional para a área do exemplo do usuário: 'Alto Alegre do Pindaré'
    try {
      const configRecord = new Record(naAreaConfigCollection)
      configRecord.set('area_name', 'Alto Alegre do Pindaré')
      configRecord.set(
        'description',
        'Área de monitoramento com poços de monitoramento e remediação',
      )
      configRecord.set('wells', [
        { code: 'PM-03' },
        { code: 'PM-07' },
        { code: 'PM-08' },
        { code: 'PM-09' },
        { code: 'PM-10' },
        { code: 'PM-11' },
        { code: 'PR-01' },
        { code: 'PR-02' },
        { code: 'PR-03' },
      ])
      configRecord.set('active', true)
      app.save(configRecord)
    } catch (err) {
      console.log('Seed na_area_configs notice:', err)
    }
  },
  (app) => {
    try {
      const naSheet = app.findCollectionByNameOrId('na_sheets')
      app.delete(naSheet)
    } catch (_) {}
    try {
      const naAreaConfig = app.findCollectionByNameOrId('na_area_configs')
      app.delete(naAreaConfig)
    } catch (_) {}
    try {
      const inSitu = app.findCollectionByNameOrId('in_situ_sheets')
      app.delete(inSitu)
    } catch (_) {}
  },
)
