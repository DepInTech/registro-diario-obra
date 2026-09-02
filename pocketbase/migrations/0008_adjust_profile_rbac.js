migrate(
  (app) => {
    // 1. reports_rdo RBAC: Admin ou Operador atribuído ao projeto
    const reports = app.findCollectionByNameOrId('reports_rdo')
    reports.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'operator' && project.assigned_users ?~ @request.auth.id))"
    reports.viewRule = reports.listRule
    reports.createRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'operator' && project.assigned_users ?~ @request.auth.id))"
    reports.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'operator' && project.assigned_users ?~ @request.auth.id && status != 'approved'))"
    app.save(reports)

    // 2. report_wells RBAC: Admin ou Operador atribuído ao projeto
    const reportWells = app.findCollectionByNameOrId('report_wells')
    reportWells.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'operator' && report.project.assigned_users ?~ @request.auth.id))"
    reportWells.viewRule = reportWells.listRule
    reportWells.createRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'operator' && report.project.assigned_users ?~ @request.auth.id && report.status != 'approved'))"
    reportWells.updateRule = reportWells.createRule
    reportWells.deleteRule = reportWells.createRule
    app.save(reportWells)

    // 3. report_photos RBAC: Admin ou Operador atribuído ao projeto
    const reportPhotos = app.findCollectionByNameOrId('report_photos')
    reportPhotos.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'operator' && report.project.assigned_users ?~ @request.auth.id))"
    reportPhotos.viewRule = reportPhotos.listRule
    reportPhotos.createRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'operator' && report.project.assigned_users ?~ @request.auth.id && report.status != 'approved'))"
    reportPhotos.updateRule = reportPhotos.createRule
    reportPhotos.deleteRule = reportPhotos.createRule
    app.save(reportPhotos)

    // 4. field_spreadsheets RBAC: Admin ou Técnico atribuído ao projeto
    const sheets = app.findCollectionByNameOrId('field_spreadsheets')
    sheets.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && project.assigned_users ?~ @request.auth.id))"
    sheets.viewRule = sheets.listRule
    sheets.createRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && project.assigned_users ?~ @request.auth.id))"
    sheets.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && project.assigned_users ?~ @request.auth.id && status != 'approved'))"
    app.save(sheets)

    // 5. wells: Acessível por admin, e oper/tech atribuídos para consulta/criação
    const wells = app.findCollectionByNameOrId('wells')
    wells.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || project.assigned_users ?~ @request.auth.id)"
    wells.viewRule = wells.listRule
    wells.createRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || ((@request.auth.role = 'operator' || @request.auth.role = 'technician') && project.assigned_users ?~ @request.auth.id))"
    wells.updateRule = wells.createRule
    app.save(wells)
  },
  (app) => {
    const reports = app.findCollectionByNameOrId('reports_rdo')
    reports.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || project.assigned_users ?~ @request.auth.id)"
    reports.viewRule = reports.listRule
    reports.createRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || ((@request.auth.role = 'operator' || @request.auth.role = 'technician') && project.assigned_users ?~ @request.auth.id))"
    reports.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || ((@request.auth.role = 'operator' || @request.auth.role = 'technician') && project.assigned_users ?~ @request.auth.id && status != 'approved'))"
    app.save(reports)

    const sheets = app.findCollectionByNameOrId('field_spreadsheets')
    sheets.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || project.assigned_users ?~ @request.auth.id)"
    sheets.viewRule = sheets.listRule
    sheets.createRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || ((@request.auth.role = 'operator' || @request.auth.role = 'technician') && project.assigned_users ?~ @request.auth.id))"
    sheets.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || ((@request.auth.role = 'operator' || @request.auth.role = 'technician') && project.assigned_users ?~ @request.auth.id && status != 'approved'))"
    app.save(sheets)
  },
)
