migrate(
  (app) => {
    const projects = app.findCollectionByNameOrId('projects')
    if (!projects.fields.getByName('assigned_users')) {
      projects.fields.add(
        new RelationField({
          name: 'assigned_users',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 50,
        }),
      )
    }
    projects.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || assigned_users ?~ @request.auth.id)"
    projects.viewRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || assigned_users ?~ @request.auth.id)"
    app.save(projects)

    const wells = app.findCollectionByNameOrId('wells')
    wells.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || project.assigned_users ?~ @request.auth.id)"
    wells.viewRule = wells.listRule
    wells.createRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || ((@request.auth.role = 'operator' || @request.auth.role = 'technician') && project.assigned_users ?~ @request.auth.id))"
    wells.updateRule = wells.createRule
    app.save(wells)

    const reports = app.findCollectionByNameOrId('reports_rdo')
    reports.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || project.assigned_users ?~ @request.auth.id)"
    reports.viewRule = reports.listRule
    reports.createRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || ((@request.auth.role = 'operator' || @request.auth.role = 'technician') && project.assigned_users ?~ @request.auth.id))"
    reports.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || ((@request.auth.role = 'operator' || @request.auth.role = 'technician') && project.assigned_users ?~ @request.auth.id && status != 'approved'))"
    app.save(reports)

    const reportWells = app.findCollectionByNameOrId('report_wells')
    reportWells.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || report.project.assigned_users ?~ @request.auth.id)"
    reportWells.viewRule = reportWells.listRule
    reportWells.createRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || ((@request.auth.role = 'operator' || @request.auth.role = 'technician') && report.project.assigned_users ?~ @request.auth.id && report.status != 'approved'))"
    reportWells.updateRule = reportWells.createRule
    reportWells.deleteRule = reportWells.createRule
    app.save(reportWells)

    const reportPhotos = app.findCollectionByNameOrId('report_photos')
    reportPhotos.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || report.project.assigned_users ?~ @request.auth.id)"
    reportPhotos.viewRule = reportPhotos.listRule
    reportPhotos.createRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || ((@request.auth.role = 'operator' || @request.auth.role = 'technician') && report.project.assigned_users ?~ @request.auth.id && report.status != 'approved'))"
    reportPhotos.updateRule = reportPhotos.createRule
    reportPhotos.deleteRule = reportPhotos.createRule
    app.save(reportPhotos)

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
  (app) => {
    const projects = app.findCollectionByNameOrId('projects')
    const assigned = projects.fields.getByName('assigned_users')
    if (assigned) projects.fields.removeById(assigned.id)
    projects.listRule = "@request.auth.id != '' && @request.auth.active = true"
    projects.viewRule = projects.listRule
    app.save(projects)
  },
)
