migrate(
  (app) => {
    // 1. Atualizar actions em audit_logs para permitir 'archive' e 'unarchive'
    const auditLogs = app.findCollectionByNameOrId('audit_logs')
    const actionField = auditLogs.fields.getByName('action')
    if (actionField) {
      actionField.values = [
        'create',
        'update',
        'delete',
        'export_pdf',
        'export_excel',
        'approve',
        'return',
        'archive',
        'unarchive',
      ]
      app.save(auditLogs)
    }

    // 2. Adicionar campo 'archived' em projects
    const projects = app.findCollectionByNameOrId('projects')
    if (!projects.fields.getByName('archived')) {
      projects.fields.add(
        new BoolField({
          name: 'archived',
        }),
      )
    }
    // Update rule para projects: Admin pode tudo; usuários atribuídos podem apenas arquivar/desarquivar
    projects.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (assigned_users ?~ @request.auth.id && @request.body.name:isset = false && @request.body.client:isset = false && @request.body.contract:isset = false && @request.body.location:isset = false && @request.body.epa_code:isset = false && @request.body.assigned_users:isset = false && @request.body.company:isset = false && @request.body.area:isset = false && @request.body.progress:isset = false && @request.body.status:isset = false))"
    projects.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    app.save(projects)

    // 3. Adicionar campo 'archived' em reports_rdo
    const reports = app.findCollectionByNameOrId('reports_rdo')
    if (!reports.fields.getByName('archived')) {
      reports.fields.add(
        new BoolField({
          name: 'archived',
        }),
      )
    }
    // Update rule para reports_rdo:
    // Admin pode atualizar tudo.
    // Operador atribuído ao projeto pode atualizar se status != 'approved', OU se estiver aprovado pode apenas arquivar/desarquivar (não mexendo em campos operacionais).
    // Técnico atribuído ao projeto pode arquivar/desarquivar (mas não alterar dados de RDO).
    reports.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'operator' && project.assigned_users ?~ @request.auth.id && (status != 'approved' || (@request.body.activity_title:isset = false && @request.body.activity_description:isset = false && @request.body.weather:isset = false && @request.body.status:isset = false && @request.body.number:isset = false && @request.body.report_date:isset = false))) || (@request.auth.role = 'technician' && project.assigned_users ?~ @request.auth.id && @request.body.activity_title:isset = false && @request.body.activity_description:isset = false && @request.body.weather:isset = false && @request.body.status:isset = false && @request.body.number:isset = false && @request.body.report_date:isset = false && @request.body.time_displacement:isset = false && @request.body.time_waiting:isset = false && @request.body.interferences:isset = false && @request.body.plan_changes:isset = false && @request.body.accidents:isset = false && @request.body.review_notes:isset = false))"
    reports.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    app.save(reports)

    // 4. Adicionar campo 'archived' em field_spreadsheets
    const sheets = app.findCollectionByNameOrId('field_spreadsheets')
    if (!sheets.fields.getByName('archived')) {
      sheets.fields.add(
        new BoolField({
          name: 'archived',
        }),
      )
    }
    // Update rule para field_spreadsheets:
    // Admin pode atualizar tudo.
    // Técnico atribuído ao projeto pode atualizar se status != 'approved', OU se aprovado pode apenas arquivar/desarquivar.
    // Operador atribuído ao projeto pode apenas arquivar/desarquivar (não mexendo em dados de planilha).
    sheets.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && project.assigned_users ?~ @request.auth.id && (status != 'approved' || (@request.body.area:isset = false && @request.body.extraction_data:isset = false && @request.body.infiltration_data:isset = false && @request.body.status:isset = false && @request.body.date:isset = false))) || (@request.auth.role = 'operator' && project.assigned_users ?~ @request.auth.id && @request.body.area:isset = false && @request.body.extraction_data:isset = false && @request.body.infiltration_data:isset = false && @request.body.status:isset = false && @request.body.date:isset = false && @request.body.weather:isset = false && @request.body.pluviometer:isset = false && @request.body.observations:isset = false && @request.body.review_notes:isset = false))"
    sheets.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    app.save(sheets)
  },
  (app) => {
    const projects = app.findCollectionByNameOrId('projects')
    const pArchived = projects.fields.getByName('archived')
    if (pArchived) projects.fields.removeById(pArchived.id)
    projects.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    app.save(projects)

    const reports = app.findCollectionByNameOrId('reports_rdo')
    const rArchived = reports.fields.getByName('archived')
    if (rArchived) reports.fields.removeById(rArchived.id)
    reports.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'operator' && project.assigned_users ?~ @request.auth.id && status != 'approved'))"
    app.save(reports)

    const sheets = app.findCollectionByNameOrId('field_spreadsheets')
    const sArchived = sheets.fields.getByName('archived')
    if (sArchived) sheets.fields.removeById(sArchived.id)
    sheets.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && project.assigned_users ?~ @request.auth.id && status != 'approved'))"
    app.save(sheets)

    const auditLogs = app.findCollectionByNameOrId('audit_logs')
    const actionField = auditLogs.fields.getByName('action')
    if (actionField) {
      actionField.values = [
        'create',
        'update',
        'delete',
        'export_pdf',
        'export_excel',
        'approve',
        'return',
      ]
      app.save(auditLogs)
    }
  },
)
