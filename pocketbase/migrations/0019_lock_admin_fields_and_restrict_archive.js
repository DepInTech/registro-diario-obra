migrate(
  (app) => {
    // 1. Projects: Apenas Administrador pode atualizar qualquer campo, inclusive arquivar/desarquivar
    const projectsCol = app.findCollectionByNameOrId('projects')
    projectsCol.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    projectsCol.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    app.save(projectsCol)

    // 2. Reports RDO:
    // Técnico não pode alterar número, projeto, arquivar nem des-arquivar.
    // Técnico só pode editar se status = 'draft' ou 'returned'.
    const reportsCol = app.findCollectionByNameOrId('reports_rdo')
    reportsCol.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && @request.body.deleted:isset = false && @request.body.deleted_reason:isset = false && @request.body.deleted_by:isset = false && @request.body.deleted_at:isset = false && @request.body.archived:isset = false && @request.body.number:isset = false && @request.body.project:isset = false && project.assigned_users ?~ @request.auth.id && (status = 'draft' || status = 'returned' || (@request.body.activity_title:isset = false && @request.body.activity_description:isset = false && @request.body.weather:isset = false && @request.body.report_date:isset = false && @request.body.time_displacement:isset = false && @request.body.time_waiting:isset = false && @request.body.interferences:isset = false && @request.body.plan_changes:isset = false && @request.body.accidents:isset = false))))"
    reportsCol.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    app.save(reportsCol)

    // 3. Field Spreadsheets:
    // Técnico não pode alterar projeto, arquivar nem des-arquivar.
    // Técnico só pode editar se status = 'draft' ou 'returned'.
    const sheetsCol = app.findCollectionByNameOrId('field_spreadsheets')
    sheetsCol.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && @request.body.deleted:isset = false && @request.body.deleted_reason:isset = false && @request.body.deleted_by:isset = false && @request.body.deleted_at:isset = false && @request.body.archived:isset = false && @request.body.project:isset = false && project.assigned_users ?~ @request.auth.id && (status = 'draft' || status = 'returned' || (@request.body.area:isset = false && @request.body.extraction_data:isset = false && @request.body.infiltration_data:isset = false && @request.body.date:isset = false && @request.body.weather:isset = false && @request.body.pluviometer:isset = false && @request.body.observations:isset = false && @request.body.nutrient_done:isset = false && @request.body.nutrient_map_kg:isset = false && @request.body.nutrient_ureia_kg:isset = false && @request.body.compressor_data:isset = false && @request.body.oil_removal_data:isset = false && @request.body.waste_liquid_qty:isset = false && @request.body.waste_solid_qty:isset = false && @request.body.env_5s_check:isset = false && @request.body.env_checklist_monthly:isset = false && @request.body.morning_time:isset = false && @request.body.afternoon_time:isset = false && @request.body.infiltration_morning_time:isset = false && @request.body.infiltration_afternoon_time:isset = false))))"
    sheetsCol.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    app.save(sheetsCol)

    // 4. Wells: Técnico não pode criar, alterar ou excluir poços (apenas Admin)
    const wellsCol = app.findCollectionByNameOrId('wells')
    wellsCol.createRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    wellsCol.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    wellsCol.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    app.save(wellsCol)

    // 5. Report wells: somente Admin pode vincular ou remover poço do RDO.
    // O Técnico pode apenas atualizar profundidade, data de conclusão e diâmetro dos poços já vinculados pelo Admin quando o relatório estiver em draft/returned.
    const repWells = app.findCollectionByNameOrId('report_wells')
    repWells.createRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    repWells.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    repWells.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && report.project.assigned_users ?~ @request.auth.id && @request.body.well_id:isset = false && @request.body.report:isset = false && (report.status = 'draft' || report.status = 'returned')))"
    app.save(repWells)
  },
  (app) => {
    // Reverter para o estado anterior da migração 0018
    const projectsCol = app.findCollectionByNameOrId('projects')
    projectsCol.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    app.save(projectsCol)
  },
)
