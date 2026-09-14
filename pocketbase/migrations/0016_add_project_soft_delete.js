migrate(
  (app) => {
    const usersColId = '_pb_users_auth_'

    // Adicionar campos de soft delete na coleção projects
    const projects = app.findCollectionByNameOrId('projects')
    if (!projects.fields.getByName('deleted')) {
      projects.fields.add(new BoolField({ name: 'deleted' }))
    }
    if (!projects.fields.getByName('deleted_reason')) {
      projects.fields.add(new TextField({ name: 'deleted_reason' }))
    }
    if (!projects.fields.getByName('deleted_by')) {
      projects.fields.add(
        new RelationField({
          name: 'deleted_by',
          collectionId: usersColId,
          maxSelect: 1,
        }),
      )
    }
    if (!projects.fields.getByName('deleted_at')) {
      projects.fields.add(new DateField({ name: 'deleted_at' }))
    }

    // List rule e View rule para projects:
    // Admin vê tudo (incluindo deleted=true).
    // Operador e Técnico vêem apenas seus projetos atribuídos e que não foram excluídos:
    projects.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || ((deleted = false || deleted:isset = false) && assigned_users ?~ @request.auth.id))"
    projects.viewRule = projects.listRule

    // Update rule para projects:
    // Admin pode atualizar tudo (incluindo deleted=true com justificativa).
    // Não-admin não pode atualizar projetos excluídos nem alterar os campos de exclusão lógica
    projects.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || ((deleted = false || deleted:isset = false) && @request.body.deleted:isset = false && @request.body.deleted_reason:isset = false && @request.body.deleted_by:isset = false && @request.body.deleted_at:isset = false && assigned_users ?~ @request.auth.id && @request.body.name:isset = false && @request.body.client:isset = false && @request.body.contract:isset = false && @request.body.location:isset = false && @request.body.epa_code:isset = false && @request.body.assigned_users:isset = false && @request.body.company:isset = false && @request.body.area:isset = false && @request.body.progress:isset = false && @request.body.status:isset = false))"

    // Delete rule física permanece restrita a admin
    projects.deleteRule =
      "@request.auth.id != '' && @request.auth.active = true && @request.auth.role = 'admin'"

    app.save(projects)
  },
  (app) => {
    const projects = app.findCollectionByNameOrId('projects')
    const pDel = projects.fields.getByName('deleted')
    if (pDel) projects.fields.removeById(pDel.id)
    const pReason = projects.fields.getByName('deleted_reason')
    if (pReason) projects.fields.removeById(pReason.id)
    const pBy = projects.fields.getByName('deleted_by')
    if (pBy) projects.fields.removeById(pBy.id)
    const pAt = projects.fields.getByName('deleted_at')
    if (pAt) projects.fields.removeById(pAt.id)

    projects.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || assigned_users ?~ @request.auth.id)"
    projects.viewRule = projects.listRule
    projects.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (assigned_users ?~ @request.auth.id && @request.body.name:isset = false && @request.body.client:isset = false && @request.body.contract:isset = false && @request.body.location:isset = false && @request.body.epa_code:isset = false && @request.body.assigned_users:isset = false && @request.body.company:isset = false && @request.body.area:isset = false && @request.body.progress:isset = false && @request.body.status:isset = false))"

    app.save(projects)
  },
)
