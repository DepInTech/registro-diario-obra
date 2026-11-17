/// <reference path="../pb_data/types.d.ts" />

// Migração 0040 — Visibilidade de Planilhas de Campo por técnico atribuído.
//
// 1. list/view: o técnico passa a ver a Planilha de Campo quando o ID dele está
//    em assigned_technicians DA PRÓPRIA PLANILHA **OU** em assigned_users DO
//    PROJETO vinculado (via anterior, preservada). As demais condições existentes
//    (auth ativo, deleted/archived) continuam valendo — nenhum acesso geral é aberto.
// 2. update: o técnico continua podendo editar os campos operacionais, mas NÃO
//    pode alterar assigned_technicians (@request.body.assigned_technicians:isset = false).
//    Apenas o Admin pode modificar a lista de responsáveis.
// 3. Backfill idempotente: adiciona o técnico Ronilson (twqw04gh0x3dg9t) aos
//    assigned_users dos projetos em que ele deve ter acesso (admin → técnica),
//    sem recriar vínculos existentes.
migrate(
  (app) => {
    const sheetsCol = app.findCollectionByNameOrId('field_spreadsheets')

    // Condições que a regra anterior já aplicava — preservadas
    const technicianList =
      "(@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && (assigned_technicians ?~ @request.auth.id || project.assigned_users ?~ @request.auth.id))"

    sheetsCol.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || " +
      technicianList +
      ')'
    sheetsCol.viewRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || " +
      technicianList +
      ')'

    // Update: além das proteções já existentes (deleted*/archived/project/status),
    // o técnico NÃO pode alterar assigned_technicians — só o Admin.
    sheetsCol.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && @request.body.deleted:isset = false && @request.body.deleted_reason:isset = false && @request.body.deleted_by:isset = false && @request.body.deleted_at:isset = false && @request.body.archived:isset = false && @request.body.project:isset = false && @request.body.assigned_technicians:isset = false && project.assigned_users ?~ @request.auth.id && (status = 'draft' || status = 'returned')))"
    app.save(sheetsCol)

    // ---- Backfill idempotente: assigned_users dos projetos de Ronilson ----
    // Estrutura existente: administrador (mb059ge3zci2tzr, Annik Almeida) gerencia os
    // projetos; o técnico Ronilson deve ter acesso aos mesmos projetos não excluídos.
    const techId = 'twqw04gh0x3dg9t'
    const adminId = 'mb059ge3zci2tzr'
    try {
      const tech = app.findFirstRecordByData('users', 'id', techId)
      if (tech && tech.getString('role') === 'technician') {
        const allProjects = app.findRecordsByFilter(
          'projects',
          'deleted = false || deleted:isset = false',
          '-created',
          200,
          0,
        )
        for (const proj of allProjects) {
          const current = proj.get('assigned_users') || []
          // Respeita a estrutura existente: só projetos já gerenciados pelo admin Annik
          if (current.indexOf(adminId) === -1) continue
          if (current.indexOf(techId) === -1) {
            proj.set('assigned_users', current.concat([techId]))
            app.save(proj)
          }
        }
      }
    } catch (e) {
      console.log('[0040] backfill assigned_users falhou (ignorado):', e)
    }
  },
  (app) => {
    const sheetsCol = app.findCollectionByNameOrId('field_spreadsheets')
    sheetsCol.listRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && project.assigned_users ?~ @request.auth.id))"
    sheetsCol.viewRule = sheetsCol.listRule
    sheetsCol.updateRule =
      "@request.auth.id != '' && @request.auth.active = true && (@request.auth.role = 'admin' || (@request.auth.role = 'technician' && (deleted = false || deleted:isset = false) && @request.body.deleted:isset = false && @request.body.deleted_reason:isset = false && @request.body.deleted_by:isset = false && @request.body.deleted_at:isset = false && @request.body.archived:isset = false && @request.body.project:isset = false && project.assigned_users ?~ @request.auth.id && (status = 'draft' || status = 'returned')))"
    app.save(sheetsCol)
  },
)
