migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('role'))
      users.fields.add(
        new SelectField({
          name: 'role',
          required: true,
          values: ['admin', 'operator', 'technician'],
          maxSelect: 1,
        }),
      )
    if (!users.fields.getByName('active')) users.fields.add(new BoolField({ name: 'active' }))
    users.listRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    users.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || id = @request.auth.id)"
    users.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    users.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || (id = @request.auth.id && @request.body.role:isset = false))"
    users.deleteRule =
      "@request.auth.id != '' && @request.auth.role = 'admin' && id != @request.auth.id"
    app.save(users)

    const auth = users.id
    const common = [
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]
    const signed = "@request.auth.id != '' && @request.auth.active = true"
    const admin =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    const staff =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || @request.auth.role = 'operator' || @request.auth.role = 'technician')"

    app.save(
      new Collection({
        name: 'clients',
        type: 'base',
        listRule: signed,
        viewRule: signed,
        createRule: admin,
        updateRule: admin,
        deleteRule: admin,
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'document', type: 'text' },
          { name: 'contact', type: 'text' },
          ...common,
        ],
        indexes: ['CREATE INDEX idx_clients_name ON clients (name)'],
      }),
    )
    app.save(
      new Collection({
        name: 'companies',
        type: 'base',
        listRule: signed,
        viewRule: signed,
        createRule: admin,
        updateRule: admin,
        deleteRule: admin,
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'document', type: 'text' },
          ...common,
        ],
        indexes: ['CREATE INDEX idx_companies_name ON companies (name)'],
      }),
    )
    app.save(
      new Collection({
        name: 'areas',
        type: 'base',
        listRule: signed,
        viewRule: signed,
        createRule: admin,
        updateRule: admin,
        deleteRule: admin,
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'description', type: 'text' },
          ...common,
        ],
        indexes: ['CREATE INDEX idx_areas_name ON areas (name)'],
      }),
    )

    const clients = app.findCollectionByNameOrId('clients').id
    const companies = app.findCollectionByNameOrId('companies').id
    app.save(
      new Collection({
        name: 'contracts',
        type: 'base',
        listRule: signed,
        viewRule: signed,
        createRule: admin,
        updateRule: admin,
        deleteRule: admin,
        fields: [
          { name: 'code', type: 'text', required: true },
          {
            name: 'client',
            type: 'relation',
            required: true,
            collectionId: clients,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'company',
            type: 'relation',
            collectionId: companies,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'start_date', type: 'date' },
          { name: 'end_date', type: 'date' },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['active', 'paused', 'closed'],
            maxSelect: 1,
          },
          ...common,
        ],
        indexes: ['CREATE UNIQUE INDEX idx_contracts_code ON contracts (code)'],
      }),
    )

    const contracts = app.findCollectionByNameOrId('contracts').id
    const areas = app.findCollectionByNameOrId('areas').id
    app.save(
      new Collection({
        name: 'projects',
        type: 'base',
        listRule: signed,
        viewRule: signed,
        createRule: admin,
        updateRule: admin,
        deleteRule: admin,
        fields: [
          { name: 'name', type: 'text', required: true },
          {
            name: 'client',
            type: 'relation',
            required: true,
            collectionId: clients,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'contract',
            type: 'relation',
            required: true,
            collectionId: contracts,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'company',
            type: 'relation',
            collectionId: companies,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'area',
            type: 'relation',
            collectionId: areas,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'location', type: 'text', required: true },
          { name: 'epa_code', type: 'text', required: true },
          { name: 'progress', type: 'number', min: 0, max: 100 },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['active', 'paused', 'completed'],
            maxSelect: 1,
          },
          ...common,
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_projects_epa_code ON projects (epa_code)',
          'CREATE INDEX idx_projects_status ON projects (status)',
        ],
      }),
    )

    const projects = app.findCollectionByNameOrId('projects').id
    app.save(
      new Collection({
        name: 'wells',
        type: 'base',
        listRule: signed,
        viewRule: signed,
        createRule: staff,
        updateRule: staff,
        deleteRule: admin,
        fields: [
          {
            name: 'project',
            type: 'relation',
            collectionId: projects,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'identification', type: 'text', required: true },
          { name: 'default_diameter', type: 'text' },
          { name: 'active', type: 'bool' },
          ...common,
        ],
        indexes: ['CREATE UNIQUE INDEX idx_wells_project_id ON wells (project, identification)'],
      }),
    )

    app.save(
      new Collection({
        name: 'reports_rdo',
        type: 'base',
        listRule: signed,
        viewRule: signed,
        createRule: staff,
        updateRule:
          "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || ((@request.auth.role = 'operator' || @request.auth.role = 'technician') && status = 'draft'))",
        deleteRule: admin,
        fields: [
          { name: 'number', type: 'number', required: true, onlyInt: true, min: 1 },
          {
            name: 'project',
            type: 'relation',
            required: true,
            collectionId: projects,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'report_date', type: 'date', required: true },
          {
            name: 'weather',
            type: 'select',
            required: true,
            values: ['Sol', 'Chuva', 'Nublado', 'Instável'],
            maxSelect: 1,
          },
          {
            name: 'performed_by',
            type: 'relation',
            required: true,
            collectionId: auth,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'supervised_by',
            type: 'relation',
            collectionId: auth,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'activity_title', type: 'text', required: true },
          { name: 'activity_description', type: 'editor', maxSize: 100000 },
          {
            name: 'location_map',
            type: 'file',
            maxSelect: 1,
            maxSize: 10485760,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          },
          { name: 'time_displacement', type: 'text' },
          { name: 'time_waiting', type: 'text' },
          { name: 'interferences', type: 'text' },
          { name: 'plan_changes', type: 'text' },
          { name: 'accidents', type: 'text' },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['draft', 'submitted', 'approved', 'returned'],
            maxSelect: 1,
          },
          { name: 'review_notes', type: 'text' },
          ...common,
        ],
        indexes: [
          'CREATE INDEX idx_rdo_project_date ON reports_rdo (project, report_date)',
          'CREATE INDEX idx_rdo_status ON reports_rdo (status)',
        ],
      }),
    )

    const reports = app.findCollectionByNameOrId('reports_rdo').id
    app.save(
      new Collection({
        name: 'report_wells',
        type: 'base',
        listRule: signed,
        viewRule: signed,
        createRule: staff,
        updateRule: staff,
        deleteRule: staff,
        fields: [
          {
            name: 'report',
            type: 'relation',
            required: true,
            collectionId: reports,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'well_id', type: 'text', required: true },
          { name: 'depth', type: 'number', min: 0 },
          { name: 'completion_date', type: 'date' },
          { name: 'diameter', type: 'text' },
          ...common,
        ],
        indexes: ['CREATE INDEX idx_report_wells_report ON report_wells (report)'],
      }),
    )
    app.save(
      new Collection({
        name: 'report_photos',
        type: 'base',
        listRule: signed,
        viewRule: signed,
        createRule: staff,
        updateRule: staff,
        deleteRule: staff,
        fields: [
          {
            name: 'report',
            type: 'relation',
            required: true,
            collectionId: reports,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'image',
            type: 'file',
            required: true,
            maxSelect: 1,
            maxSize: 15728640,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          },
          { name: 'caption', type: 'text', required: true },
          { name: 'order', type: 'number', required: true, onlyInt: true, min: 0 },
          ...common,
        ],
        indexes: ["CREATE INDEX idx_report_photos_report_order ON report_photos (report, 'order')"],
      }),
    )

    app.save(
      new Collection({
        name: 'field_spreadsheets',
        type: 'base',
        listRule: signed,
        viewRule: signed,
        createRule: staff,
        updateRule:
          "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || status = 'draft')",
        deleteRule: admin,
        fields: [
          {
            name: 'project',
            type: 'relation',
            required: true,
            collectionId: projects,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'operator',
            type: 'relation',
            required: true,
            collectionId: auth,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'date', type: 'date', required: true },
          { name: 'area', type: 'text', required: true },
          { name: 'weather', type: 'text' },
          { name: 'pluviometer', type: 'number', min: 0 },
          { name: 'extraction_data', type: 'json', maxSize: 200000 },
          { name: 'infiltration_data', type: 'json', maxSize: 50000 },
          { name: 'nutrient_done', type: 'bool' },
          { name: 'nutrient_map_kg', type: 'number', min: 0 },
          { name: 'nutrient_ureia_kg', type: 'number', min: 0 },
          { name: 'compressor_data', type: 'json', maxSize: 50000 },
          { name: 'oil_removal_data', type: 'json', maxSize: 50000 },
          { name: 'waste_liquid_qty', type: 'number', min: 0 },
          { name: 'waste_solid_qty', type: 'number', min: 0 },
          { name: 'env_5s_check', type: 'bool' },
          { name: 'env_checklist_monthly', type: 'bool' },
          { name: 'observations', type: 'text' },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['draft', 'submitted', 'approved'],
            maxSelect: 1,
          },
          ...common,
        ],
        indexes: ['CREATE INDEX idx_field_project_date ON field_spreadsheets (project, date)'],
      }),
    )

    app.save(
      new Collection({
        name: 'audit_logs',
        type: 'base',
        listRule: admin,
        viewRule: admin,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'actor',
            type: 'relation',
            collectionId: auth,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'action',
            type: 'select',
            required: true,
            values: [
              'create',
              'update',
              'delete',
              'export_pdf',
              'export_excel',
              'approve',
              'return',
            ],
            maxSelect: 1,
          },
          { name: 'entity', type: 'text', required: true },
          { name: 'entity_record', type: 'text' },
          { name: 'details', type: 'json', maxSize: 50000 },
          ...common,
        ],
        indexes: [
          'CREATE INDEX idx_audit_created ON audit_logs (created)',
          'CREATE INDEX idx_audit_entity_record ON audit_logs (entity, entity_record)',
        ],
      }),
    )
  },
  (app) => {
    ;[
      'audit_logs',
      'field_spreadsheets',
      'report_photos',
      'report_wells',
      'reports_rdo',
      'wells',
      'projects',
      'contracts',
      'areas',
      'companies',
      'clients',
    ].forEach((name) => {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {}
    })
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const role = users.fields.getByName('role')
    if (role) users.fields.removeById(role.id)
    const active = users.fields.getByName('active')
    if (active) users.fields.removeById(active.id)
    app.save(users)
  },
)
