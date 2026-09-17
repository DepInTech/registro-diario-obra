migrate(
  (app) => {
    const reportsCol = app.findCollectionByNameOrId('reports_rdo')
    if (!reportsCol.fields.getByName('empresa_executora')) {
      reportsCol.fields.add(
        new TextField({
          name: 'empresa_executora',
        }),
      )
    }

    // Regra de update:
    // Administrador pode alterar empresa_executora.
    // Técnico NÃO pode alterar empresa_executora (@request.body.empresa_executora:isset = false).
    // Atualizamos a updateRule de reports_rdo para garantir que @request.body.empresa_executora:isset = false seja exigido para technician.
    reportsCol.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && @request.body.deleted:isset = false && @request.body.deleted_reason:isset = false && @request.body.deleted_by:isset = false && @request.body.deleted_at:isset = false && @request.body.archived:isset = false && @request.body.number:isset = false && @request.body.project:isset = false && @request.body.empresa_executora:isset = false && project.assigned_users ?~ @request.auth.id && (status = 'draft' || status = 'returned' || (@request.body.activity_title:isset = false && @request.body.activity_description:isset = false && @request.body.weather:isset = false && @request.body.report_date:isset = false && @request.body.time_displacement:isset = false && @request.body.time_waiting:isset = false && @request.body.interferences:isset = false && @request.body.plan_changes:isset = false && @request.body.accidents:isset = false))))"

    app.save(reportsCol)
  },
  (app) => {
    const reportsCol = app.findCollectionByNameOrId('reports_rdo')
    const field = reportsCol.fields.getByName('empresa_executora')
    if (field) {
      reportsCol.fields.removeById(field.id)
    }
    app.save(reportsCol)
  },
)
