migrate(
  (app) => {
    // 1. Atualizar actions em audit_logs para permitir 'soft_delete' e 'restore' (caso necessário)
    const auditLogs = app.findCollectionByNameOrId('audit_logs')
    const actionField = auditLogs.fields.getByName('action')
    if (actionField) {
      actionField.values = [
        'create',
        'update',
        'delete',
        'soft_delete',
        'restore',
        'export_pdf',
        'export_excel',
        'approve',
        'return',
        'archive',
        'unarchive',
      ]
      app.save(auditLogs)
    }

    const usersColId = '_pb_users_auth_'

    // 2. Adicionar campos de soft delete em reports_rdo
    const reports = app.findCollectionByNameOrId('reports_rdo')
    if (!reports.fields.getByName('deleted')) {
      reports.fields.add(new BoolField({ name: 'deleted' }))
    }
    if (!reports.fields.getByName('deleted_reason')) {
      reports.fields.add(new TextField({ name: 'deleted_reason' }))
    }
    if (!reports.fields.getByName('deleted_by')) {
      reports.fields.add(
        new RelationField({
          name: 'deleted_by',
          collectionId: usersColId,
          maxSelect: 1,
        }),
      )
    }
    if (!reports.fields.getByName('deleted_at')) {
      reports.fields.add(new DateField({ name: 'deleted_at' }))
    }

    // List rule para reports_rdo:
    // Admin vê tudo (incluindo deleted=true).
    // Operadores atribuídos vêem apenas se deleted != true
    reports.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'operator' && (deleted = false || deleted:isset = false) && project.assigned_users ?~ @request.auth.id))"
    reports.viewRule = reports.listRule

    // Update rule: Admin pode atualizar tudo (incluindo deletar logicamente com justificativa).
    // Operadores não podem alterar itens deleted=true nem alterar campos de soft delete
    reports.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'operator' && (deleted = false || deleted:isset = false) && @request.body.deleted:isset = false && @request.body.deleted_reason:isset = false && @request.body.deleted_by:isset = false && @request.body.deleted_at:isset = false && project.assigned_users ?~ @request.auth.id && (status != 'approved' || (@request.body.activity_title:isset = false && @request.body.activity_description:isset = false && @request.body.weather:isset = false && @request.body.status:isset = false && @request.body.number:isset = false && @request.body.report_date:isset = false))) || (@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && @request.body.deleted:isset = false && @request.body.deleted_reason:isset = false && @request.body.deleted_by:isset = false && @request.body.deleted_at:isset = false && project.assigned_users ?~ @request.auth.id && @request.body.activity_title:isset = false && @request.body.activity_description:isset = false && @request.body.weather:isset = false && @request.body.status:isset = false && @request.body.number:isset = false && @request.body.report_date:isset = false && @request.body.time_displacement:isset = false && @request.body.time_waiting:isset = false && @request.body.interferences:isset = false && @request.body.plan_changes:isset = false && @request.body.accidents:isset = false && @request.body.review_notes:isset = false))"
    app.save(reports)

    // 3. Adicionar campos de soft delete em field_spreadsheets
    const sheets = app.findCollectionByNameOrId('field_spreadsheets')
    if (!sheets.fields.getByName('deleted')) {
      sheets.fields.add(new BoolField({ name: 'deleted' }))
    }
    if (!sheets.fields.getByName('deleted_reason')) {
      sheets.fields.add(new TextField({ name: 'deleted_reason' }))
    }
    if (!sheets.fields.getByName('deleted_by')) {
      sheets.fields.add(
        new RelationField({
          name: 'deleted_by',
          collectionId: usersColId,
          maxSelect: 1,
        }),
      )
    }
    if (!sheets.fields.getByName('deleted_at')) {
      sheets.fields.add(new DateField({ name: 'deleted_at' }))
    }

    // List rule para field_spreadsheets:
    // Admin vê tudo (incluindo deleted=true).
    // Técnicos atribuídos vêem apenas se deleted != true
    sheets.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && project.assigned_users ?~ @request.auth.id))"
    sheets.viewRule = sheets.listRule

    // Update rule para field_spreadsheets:
    sheets.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && @request.body.deleted:isset = false && @request.body.deleted_reason:isset = false && @request.body.deleted_by:isset = false && @request.body.deleted_at:isset = false && project.assigned_users ?~ @request.auth.id && (status != 'approved' || (@request.body.area:isset = false && @request.body.extraction_data:isset = false && @request.body.infiltration_data:isset = false && @request.body.status:isset = false && @request.body.date:isset = false))) || (@request.auth.role = 'operator' && (deleted = false || deleted:isset = false) && @request.body.deleted:isset = false && @request.body.deleted_reason:isset = false && @request.body.deleted_by:isset = false && @request.body.deleted_at:isset = false && project.assigned_users ?~ @request.auth.id && @request.body.area:isset = false && @request.body.extraction_data:isset = false && @request.body.infiltration_data:isset = false && @request.body.status:isset = false && @request.body.date:isset = false && @request.body.weather:isset = false && @request.body.pluviometer:isset = false && @request.body.observations:isset = false && @request.body.review_notes:isset = false))"
    app.save(sheets)
  },
  (app) => {
    const reports = app.findCollectionByNameOrId('reports_rdo')
    const rDel = reports.fields.getByName('deleted')
    if (rDel) reports.fields.removeById(rDel.id)
    const rReason = reports.fields.getByName('deleted_reason')
    if (rReason) reports.fields.removeById(rReason.id)
    const rBy = reports.fields.getByName('deleted_by')
    if (rBy) reports.fields.removeById(rBy.id)
    const rAt = reports.fields.getByName('deleted_at')
    if (rAt) reports.fields.removeById(rAt.id)
    reports.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'operator' && project.assigned_users ?~ @request.auth.id))"
    reports.viewRule = reports.listRule
    app.save(reports)

    const sheets = app.findCollectionByNameOrId('field_spreadsheets')
    const sDel = sheets.fields.getByName('deleted')
    if (sDel) sheets.fields.removeById(sDel.id)
    const sReason = sheets.fields.getByName('deleted_reason')
    if (sReason) sheets.fields.removeById(sReason.id)
    const sBy = sheets.fields.getByName('deleted_by')
    if (sBy) sheets.fields.removeById(sBy.id)
    const sAt = sheets.fields.getByName('deleted_at')
    if (sAt) sheets.fields.removeById(sAt.id)
    sheets.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && project.assigned_users ?~ @request.auth.id))"
    sheets.viewRule = sheets.listRule
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
        'archive',
        'unarchive',
      ]
      app.save(auditLogs)
    }
  },
)
