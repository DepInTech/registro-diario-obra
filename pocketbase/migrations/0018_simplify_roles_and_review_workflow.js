migrate(
  (app) => {
    // 1. Atualizar usuários com role 'operator' para 'technician' (não apagar dados, migrar perfil)
    app.db().newQuery("UPDATE users SET role = 'technician' WHERE role = 'operator'").execute()

    // 2. Atualizar campo role em users para permitir 'admin' | 'technician'
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const roleField = usersCol.fields.getByName('role')
    if (roleField) {
      roleField.values = ['admin', 'technician']
      app.save(usersCol)
    }

    // 3. Poços (wells): Somente Administrador pode criar, alterar ou excluir.
    // Técnicos atribuídos podem listar e visualizar poços dos seus projetos.
    const wellsCol = app.findCollectionByNameOrId('wells')
    wellsCol.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || project.assigned_users ?~ @request.auth.id)"
    wellsCol.viewRule = wellsCol.listRule
    wellsCol.createRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    wellsCol.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    wellsCol.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    app.save(wellsCol)

    // 4. Adicionar returned_fields e change_history em field_spreadsheets
    const sheetsCol = app.findCollectionByNameOrId('field_spreadsheets')
    if (!sheetsCol.fields.getByName('returned_fields')) {
      sheetsCol.fields.add(
        new JSONField({
          name: 'returned_fields',
        }),
      )
    }
    if (!sheetsCol.fields.getByName('change_history')) {
      sheetsCol.fields.add(
        new JSONField({
          name: 'change_history',
        }),
      )
    }

    // Regras de acesso em field_spreadsheets:
    // Técnico pode criar rascunho se atribuído ao projeto
    // Técnico pode atualizar se (status = 'draft' || status = 'returned'), mas NÃO quando status = 'submitted' ou 'approved'.
    // Admin pode atualizar tudo (incluindo aprovar e devolver).
    sheetsCol.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && project.assigned_users ?~ @request.auth.id))"
    sheetsCol.viewRule = sheetsCol.listRule
    sheetsCol.createRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && project.assigned_users ?~ @request.auth.id))"
    sheetsCol.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && @request.body.deleted:isset = false && @request.body.deleted_reason:isset = false && @request.body.deleted_by:isset = false && @request.body.deleted_at:isset = false && project.assigned_users ?~ @request.auth.id && (status = 'draft' || status = 'returned' || (@request.body.area:isset = false && @request.body.extraction_data:isset = false && @request.body.infiltration_data:isset = false && @request.body.date:isset = false && @request.body.weather:isset = false && @request.body.pluviometer:isset = false && @request.body.observations:isset = false && @request.body.nutrient_done:isset = false && @request.body.nutrient_map_kg:isset = false && @request.body.nutrient_ureia_kg:isset = false && @request.body.compressor_data:isset = false && @request.body.oil_removal_data:isset = false && @request.body.waste_liquid_qty:isset = false && @request.body.waste_solid_qty:isset = false && @request.body.env_5s_check:isset = false && @request.body.env_checklist_monthly:isset = false && @request.body.morning_time:isset = false && @request.body.afternoon_time:isset = false && @request.body.infiltration_morning_time:isset = false && @request.body.infiltration_afternoon_time:isset = false))))"
    sheetsCol.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    app.save(sheetsCol)

    // 5. Adicionar returned_fields e change_history em reports_rdo, e estender permissões para Technician
    const reportsCol = app.findCollectionByNameOrId('reports_rdo')
    if (!reportsCol.fields.getByName('returned_fields')) {
      reportsCol.fields.add(
        new JSONField({
          name: 'returned_fields',
        }),
      )
    }
    if (!reportsCol.fields.getByName('change_history')) {
      reportsCol.fields.add(
        new JSONField({
          name: 'change_history',
        }),
      )
    }
    // Técnico agora pode gerenciar e submeter RDOs também, pois o perfil Operador foi extinto.
    // Bloqueado para edição quando status = 'submitted' ou 'approved'.
    reportsCol.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && project.assigned_users ?~ @request.auth.id))"
    reportsCol.viewRule = reportsCol.listRule
    reportsCol.createRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && project.assigned_users ?~ @request.auth.id))"
    reportsCol.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && @request.body.deleted:isset = false && @request.body.deleted_reason:isset = false && @request.body.deleted_by:isset = false && @request.body.deleted_at:isset = false && project.assigned_users ?~ @request.auth.id && (status = 'draft' || status = 'returned' || (@request.body.activity_title:isset = false && @request.body.activity_description:isset = false && @request.body.weather:isset = false && @request.body.number:isset = false && @request.body.report_date:isset = false && @request.body.time_displacement:isset = false && @request.body.time_waiting:isset = false && @request.body.interferences:isset = false && @request.body.plan_changes:isset = false && @request.body.accidents:isset = false))))"
    reportsCol.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"
    app.save(reportsCol)

    // 6. Atualizar report_wells e report_photos para permitir Technician
    const repWells = app.findCollectionByNameOrId('report_wells')
    repWells.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && report.project.assigned_users ?~ @request.auth.id))"
    repWells.viewRule = repWells.listRule
    repWells.createRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && report.project.assigned_users ?~ @request.auth.id && (report.status = 'draft' || report.status = 'returned')))"
    repWells.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && report.project.assigned_users ?~ @request.auth.id && (report.status = 'draft' || report.status = 'returned')))"
    repWells.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && report.project.assigned_users ?~ @request.auth.id && (report.status = 'draft' || report.status = 'returned')))"
    app.save(repWells)

    const repPhotos = app.findCollectionByNameOrId('report_photos')
    repPhotos.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && report.project.assigned_users ?~ @request.auth.id))"
    repPhotos.viewRule = repPhotos.listRule
    repPhotos.createRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && report.project.assigned_users ?~ @request.auth.id && (report.status = 'draft' || report.status = 'returned')))"
    repPhotos.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && report.project.assigned_users ?~ @request.auth.id && (report.status = 'draft' || report.status = 'returned')))"
    repPhotos.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && report.project.assigned_users ?~ @request.auth.id && (report.status = 'draft' || report.status = 'returned')))"
    app.save(repPhotos)
  },
  (app) => {
    // Reverter apenas se necessário
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const roleField = usersCol.fields.getByName('role')
    if (roleField) {
      roleField.values = ['admin', 'operator', 'technician']
      app.save(usersCol)
    }
  },
)
