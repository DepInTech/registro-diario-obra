routerAdd(
  'GET',
  '/backend/v1/export/field/{id}',
  (e) => {
    const auth = e.auth
    if (!auth || auth.getString('role') !== 'admin' || !auth.getBool('active'))
      throw new ForbiddenError('Somente administradores podem exportar planilhas')
    const sheet = $app.findRecordById('field_spreadsheets', e.request.pathValue('id'))
    $app.expandRecord(sheet, ['project', 'operator'], null)
    const project = sheet.expandedOne('project')
    const operator = sheet.expandedOne('operator')
    const safe = (value) =>
      String(value === null || value === undefined || value === '' ? '—' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    let extraction = ''
    const rows = sheet.get('extraction_data') || []
    for (const row of rows)
      extraction +=
        '<tr><td>' +
        safe(row.well) +
        '</td><td>' +
        safe(row.morning) +
        '</td><td>' +
        safe(row.afternoon) +
        '</td><td>' +
        safe(row.pump) +
        '</td><td>' +
        safe(row.autopump) +
        '</td></tr>'
    const compressor = sheet.get('compressor_data') || {}
    const oil = sheet.get('oil_removal_data') || {}
    const infiltration = sheet.get('infiltration_data') || {}
    const html =
      "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:excel'><head><meta charset='utf-8'><style>body{font-family:Arial}table{border-collapse:collapse}td,th{border:1px solid #53646b;padding:7px}th{background:#08766c;color:white}.section{background:#dcece9;color:#075d56;font-weight:bold}.logo{font-size:24px;font-weight:bold;color:#08766c}.label{font-weight:bold;background:#eef5f3}</style></head><body><table><tr><td colspan='5' class='logo'>◉ GRUPO EPA — GESTÃO AMBIENTAL</td></tr><tr><th colspan='5'>PLANILHA DE CAMPO — CONTROLE OPERACIONAL</th></tr><tr><td class='label'>Projeto</td><td colspan='2'>" +
      safe(project?.getString('name')) +
      "</td><td class='label'>Código</td><td>" +
      safe(project?.getString('epa_code')) +
      "</td></tr><tr><td class='label'>Data</td><td>" +
      safe(sheet.getString('date').slice(0, 10)) +
      "</td><td class='label'>Área</td><td colspan='2'>" +
      safe(sheet.getString('area')) +
      "</td></tr><tr><td class='label'>Operador</td><td colspan='2'>" +
      safe(operator?.getString('name')) +
      "</td><td class='label'>Clima / Pluviômetro</td><td>" +
      safe(sheet.getString('weather')) +
      ' / ' +
      safe(sheet.get('pluviometer')) +
      " mm</td></tr><tr><td colspan='5' class='section'>EXTRAÇÃO / VOLUME BOMBEADO</td></tr><tr><th>Poço</th><th>Hidrômetro manhã</th><th>Hidrômetro tarde</th><th>Bomba</th><th>Auto bomba</th></tr>" +
      extraction +
      "<tr><td colspan='5' class='section'>INFILTRAÇÃO</td></tr><tr><td>Geral manhã</td><td>" +
      safe(infiltration.geralMorning) +
      "</td><td>Geral tarde</td><td colspan='2'>" +
      safe(infiltration.geralAfternoon) +
      "</td></tr><tr><td colspan='5' class='section'>DOSAGEM DE NUTRIENTES</td></tr><tr><td>Aplicação realizada</td><td>" +
      (sheet.getBool('nutrient_done') ? 'Sim' : 'Não') +
      '</td><td>MAP (kg)</td><td>Ureia (kg)</td><td>Total (kg)</td></tr><tr><td></td><td></td><td>' +
      safe(sheet.get('nutrient_map_kg')) +
      '</td><td>' +
      safe(sheet.get('nutrient_ureia_kg')) +
      '</td><td>' +
      safe(
        Number(sheet.get('nutrient_map_kg') || 0) + Number(sheet.get('nutrient_ureia_kg') || 0),
      ) +
      "</td></tr><tr><td colspan='5' class='section'>COMPRESSORES</td></tr><tr><td>Pressão 01</td><td>" +
      safe(compressor.pressure1) +
      "</td><td>Pressão 02</td><td colspan='2'>" +
      safe(compressor.pressure2) +
      "</td></tr><tr><td colspan='5' class='section'>REMOÇÃO DE ÓLEO / RESÍDUOS</td></tr><tr><td>SAO 01</td><td>" +
      safe(oil.sao1Volume) +
      "</td><td>SAO 02</td><td colspan='2'>" +
      safe(oil.sao2Volume) +
      '</td></tr><tr><td>Resíduo líquido</td><td>' +
      safe(sheet.get('waste_liquid_qty')) +
      "</td><td>Resíduo sólido</td><td colspan='2'>" +
      safe(sheet.get('waste_solid_qty')) +
      "</td></tr><tr><td colspan='5' class='section'>CONTROLE AMBIENTAL</td></tr><tr><td>5S</td><td>" +
      (sheet.getBool('env_5s_check') ? 'Conforme' : 'Pendente') +
      "</td><td>Checklist mensal</td><td colspan='2'>" +
      (sheet.getBool('env_checklist_monthly') ? 'Conforme' : 'Pendente') +
      "</td></tr><tr><td class='label'>Observações</td><td colspan='4'>" +
      safe(sheet.getString('observations')) +
      '</td></tr></table></body></html>'
    const logs = $app.findCollectionByNameOrId('audit_logs')
    const log = new Record(logs)
    log.set('actor', auth.id)
    log.set('action', 'export_excel')
    log.set('entity', 'field_spreadsheets')
    log.set('entity_record', sheet.id)
    log.set('details', { template: 'EPA Planilha de Campo', date: sheet.getString('date') })
    $app.save(log)
    e.response.header().set('Content-Type', 'application/vnd.ms-excel; charset=utf-8')
    e.response
      .header()
      .set(
        'Content-Disposition',
        'attachment; filename=Planilha-Campo-EPA-' + sheet.getString('date').slice(0, 10) + '.xls',
      )
    return e.string(200, html)
  },
  $apis.requireAuth(),
)
