migrate(
  (app) => {
    // 1. Reports RDO:
    // Técnico só pode atualizar quando status for 'draft' ou 'returned'.
    // Quando status for 'submitted' ou 'approved', o Técnico é totalmente proibido de editar.
    const reportsCol = app.findCollectionByNameOrId('reports_rdo')
    reportsCol.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && @request.body.deleted:isset = false && @request.body.deleted_reason:isset = false && @request.body.deleted_by:isset = false && @request.body.deleted_at:isset = false && @request.body.archived:isset = false && @request.body.number:isset = false && @request.body.project:isset = false && project.assigned_users ?~ @request.auth.id && (status = 'draft' || status = 'returned')))"
    reportsCol.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    app.save(reportsCol)

    // 2. Field Spreadsheets:
    // Técnico só pode atualizar quando status for 'draft' ou 'returned'.
    // Quando status for 'submitted' ou 'approved', o Técnico é totalmente proibido de editar.
    const sheetsCol = app.findCollectionByNameOrId('field_spreadsheets')
    sheetsCol.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && @request.body.deleted:isset = false && @request.body.deleted_reason:isset = false && @request.body.deleted_by:isset = false && @request.body.deleted_at:isset = false && @request.body.archived:isset = false && @request.body.project:isset = false && project.assigned_users ?~ @request.auth.id && (status = 'draft' || status = 'returned')))"
    sheetsCol.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    app.save(sheetsCol)

    // 3. Report Wells:
    // Técnico só pode atualizar profundidade, conclusão e diâmetro se o relatório pai estiver em 'draft' ou 'returned'
    const repWells = app.findCollectionByNameOrId('report_wells')
    repWells.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && report.project.assigned_users ?~ @request.auth.id && @request.body.well_id:isset = false && @request.body.report:isset = false && (report.status = 'draft' || report.status = 'returned')))"
    repWells.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    app.save(repWells)

    // 4. Report Photos:
    // Técnico só pode criar, atualizar ou excluir fotos se o relatório pai estiver em 'draft' ou 'returned'
    const repPhotos = app.findCollectionByNameOrId('report_photos')
    repPhotos.createRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && report.project.assigned_users ?~ @request.auth.id && (report.status = 'draft' || report.status = 'returned')))"
    repPhotos.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && report.project.assigned_users ?~ @request.auth.id && (report.status = 'draft' || report.status = 'returned')))"
    repPhotos.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && report.project.assigned_users ?~ @request.auth.id && (report.status = 'draft' || report.status = 'returned')))"
    app.save(repPhotos)
  },
  (app) => {
    // Reverter para as regras da migração 0019
    const reportsCol = app.findCollectionByNameOrId('reports_rdo')
    reportsCol.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && @request.body.deleted:isset = false && @request.body.deleted_reason:isset = false && @request.body.deleted_by:isset = false && @request.body.deleted_at:isset = false && @request.body.archived:isset = false && @request.body.number:isset = false && @request.body.project:isset = false && project.assigned_users ?~ @request.auth.id && (status = 'draft' || status = 'returned' || (@request.body.activity_title:isset = false && @request.body.activity_description:isset = false && @request.body.weather:isset = false && @request.body.report_date:isset = false && @request.body.time_displacement:isset = false && @request.body.time_waiting:isset = false && @request.body.interferences:isset = false && @request.body.plan_changes:isset = false && @request.body.accidents:isset = false))))"
    app.save(reportsCol)

    const sheetsCol = app.findCollectionByNameOrId('field_spreadsheets')
    sheetsCol.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && @request.body.deleted:isset = false && @request.body.deleted_reason:isset = false && @request.body.deleted_by:isset = false && @request.body.deleted_at:isset = false && @request.body.archived:isset = false && @request.body.project:isset = false && project.assigned_users ?~ @request.auth.id && (status = 'draft' || status = 'returned' || (@request.body.area:isset = false && @request.body.extraction_data:isset = false && @request.body.infiltration_data:isset = false && @request.body.date:isset = false && @request.body.weather:isset = false && @request.body.pluviometer:isset = false && @request.body.observations:isset = false && @request.body.nutrient_done:isset = false && @request.body.nutrient_map_kg:isset = false && @request.body.nutrient_ureia_kg:isset = false && @request.body.compressor_data:isset = false && @request.body.oil_removal_data:isset = false && @request.body.waste_liquid_qty:isset = false && @request.body.waste_solid_qty:isset = false && @request.body.env_5s_check:isset = false && @request.body.env_checklist_monthly:isset = false && @request.body.morning_time:isset = false && @request.body.afternoon_time:isset = false && @request.body.infiltration_morning_time:isset = false && @request.body.infiltration_afternoon_time:isset = false))))"
    app.save(sheetsCol)
  },
)
