routerAdd(
  'GET',
  '/backend/v1/export/rdo/{id}',
  (e) => {
    const auth = e.auth
    if (!auth || auth.getString('role') !== 'admin' || !auth.getBool('active')) {
      throw new ForbiddenError('Somente administradores podem exportar RDOs')
    }
    const report = $app.findRecordById('reports_rdo', e.request.pathValue('id'))
    $app.expandRecord(
      report,
      [
        'project',
        'project.client',
        'project.contract',
        'project.company',
        'performed_by',
        'supervised_by',
      ],
      null,
    )
    const wells = $app.findRecordsByFilter('report_wells', 'report = {:id}', 'created', 100, 0, {
      id: report.id,
    })
    const photos = $app.findRecordsByFilter('report_photos', 'report = {:id}', 'order', 100, 0, {
      id: report.id,
    })
    const project = report.expandedOne('project')
    const client = project ? project.expandedOne('client') : null
    const contract = project ? project.expandedOne('contract') : null
    const company = project ? project.expandedOne('company') : null
    const performer = report.expandedOne('performed_by')
    const supervisor = report.expandedOne('supervised_by')
    const safe = (value) =>
      String(value || '—')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    let wellRows = ''
    for (const item of wells)
      wellRows +=
        '<tr><td>' +
        safe(item.getString('well_id')) +
        '</td><td>' +
        safe(item.get('depth')) +
        ' m</td><td>' +
        safe(item.getString('completion_date').slice(0, 10)) +
        '</td><td>' +
        safe(item.getString('diameter')) +
        '</td></tr>'
    if (!wellRows) wellRows = "<tr><td colspan='4'>Nenhum poço registrado</td></tr>"
    let photoCards = ''
    for (const photo of photos) {
      const url =
        $app.settings().meta.appURL +
        '/api/files/' +
        photo.collection().id +
        '/' +
        photo.id +
        '/' +
        photo.getString('image')
      photoCards +=
        "<figure><img src='" +
        safe(url) +
        "'><figcaption>" +
        safe(photo.getString('caption')) +
        '</figcaption></figure>'
    }
    if (!photoCards) photoCards = "<p class='empty'>Sem registros fotográficos neste relatório.</p>"
    const logo =
      "<div class='brand'><span class='mark'>EPA</span><span><small>GRUPO</small> EPA</span></div>"
    const html =
      "<!doctype html><html><head><meta charset='utf-8'><title>RDO " +
      safe(report.get('number')) +
      "</title><style>@page{size:A4;margin:28mm 12mm 15mm}*{box-sizing:border-box}body{font:11px Arial;color:#17212b;margin:0}.page-head{position:fixed;top:-21mm;left:0;right:0;height:18mm;border-bottom:2px solid #08766c;display:flex;align-items:center;justify-content:space-between}.brand{display:flex;align-items:center;gap:8px;color:#08766c;font-size:19px;font-weight:700}.brand small{font-size:7px;display:block;letter-spacing:3px}.mark{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#08766c;color:white;font-size:11px}.doc{font-size:9px;text-align:right}.title{background:#08766c;color:white;padding:9px;text-align:center;font-size:16px;letter-spacing:.4px;margin:0 0 7px}.grid{display:grid;grid-template-columns:1fr 1fr}.cell{border:1px solid #9ca3af;padding:5px;min-height:29px}.cell b{display:block;color:#08766c;font-size:8px;text-transform:uppercase;margin-bottom:3px}.section{margin-top:9px;break-inside:avoid}.section h2{margin:0;background:#dcece9;color:#075d56;border:1px solid #8cb8b3;padding:5px;font-size:10px;text-transform:uppercase}p.box{border:1px solid #9ca3af;margin:0;padding:7px;min-height:42px;white-space:pre-wrap}table{width:100%;border-collapse:collapse}th,td{border:1px solid #9ca3af;padding:5px;text-align:left}th{background:#edf5f3;color:#075d56;font-size:9px}.photos{display:grid;grid-template-columns:1fr 1fr;gap:7px}.photos figure{margin:0;border:1px solid #9ca3af;padding:4px;break-inside:avoid}.photos img{width:100%;height:170px;object-fit:cover}.photos figcaption{text-align:center;padding:5px;font-size:9px}.empty{border:1px solid #9ca3af;padding:20px;text-align:center}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:35px}.sign{text-align:center;border-top:1px solid #374151;padding-top:5px}</style></head><body><div class='page-head'>" +
      logo +
      "<div class='doc'>RELATÓRIO DIÁRIO DE OBRA<br>RDO Nº " +
      safe(report.get('number')) +
      "</div></div><h1 class='title'>RELATÓRIO DIÁRIO DE ACOMPANHAMENTO DE OBRAS</h1><div class='grid'><div class='cell'><b>Cliente</b>" +
      safe(client?.getString('name')) +
      "</div><div class='cell'><b>Contrato</b>" +
      safe(contract?.getString('code')) +
      "</div><div class='cell'><b>Local</b>" +
      safe(project?.getString('location')) +
      "</div><div class='cell'><b>Projeto EPA</b>" +
      safe(project?.getString('epa_code')) +
      "</div><div class='cell'><b>Empresa</b>" +
      safe(company?.getString('name')) +
      "</div><div class='cell'><b>Data / Clima</b>" +
      safe(report.getString('report_date').slice(0, 10)) +
      ' · ' +
      safe(report.getString('weather')) +
      "</div><div class='cell'><b>Realizado por</b>" +
      safe(performer?.getString('name')) +
      "</div><div class='cell'><b>Supervisionado por</b>" +
      safe(supervisor?.getString('name')) +
      "</div></div><section class='section'><h2>Atividade</h2><p class='box'>" +
      safe(report.getString('activity_title')) +
      "</p></section><section class='section'><h2>Descrição da atividade</h2><p class='box'>" +
      safe(report.getString('activity_description')) +
      "</p></section><section class='section'><h2>Tabela de poços</h2><table><thead><tr><th>ID</th><th>Profundidade</th><th>Data</th><th>Diâmetro</th></tr></thead><tbody>" +
      wellRows +
      "</tbody></table></section><section class='section'><h2>Registro fotográfico</h2><div class='photos'>" +
      photoCards +
      "</div></section><section class='section'><h2>Observações técnicas</h2><table><tr><th>Acidentes</th><td>" +
      safe(report.getString('accidents')) +
      '</td></tr><tr><th>Interferências</th><td>' +
      safe(report.getString('interferences')) +
      '</td></tr><tr><th>Mudanças</th><td>' +
      safe(report.getString('plan_changes')) +
      '</td></tr><tr><th>Espera / Deslocamento</th><td>' +
      safe(report.getString('time_waiting')) +
      ' / ' +
      safe(report.getString('time_displacement')) +
      "</td></tr></table></section><div class='signatures'><div class='sign'>" +
      safe(performer?.getString('name')) +
      "<br>Responsável pela execução</div><div class='sign'>" +
      safe(supervisor?.getString('name')) +
      '<br>Supervisão / Aprovação</div></div></body></html>'
    const logs = $app.findCollectionByNameOrId('audit_logs')
    const log = new Record(logs)
    log.set('actor', auth.id)
    log.set('action', 'export_pdf')
    log.set('entity', 'reports_rdo')
    log.set('entity_record', report.id)
    log.set('details', { number: report.get('number'), template: 'EPA RDO' })
    $app.save(log)
    e.response
      .header()
      .set('Content-Disposition', 'inline; filename=RDO-' + report.get('number') + '.html')
    return e.html(200, html)
  },
  $apis.requireAuth(),
)
