/// <reference path="../pb_data/types.d.ts" />

routerAdd('GET', '/api/epa/export/field/{id}', (c) => {
  const auth = c.get('authRecord')
  if (!auth) {
    return c.json(401, { error: 'Não autenticado' })
  }
  const role = auth.getString('role')
  if (role !== 'admin' && role !== 'technician') {
    return c.json(403, { error: 'Exportação permitida apenas para Administradores e Técnicos' })
  }

  const id = c.pathParam('id')
  const sheet = $app.findRecordById('field_spreadsheets', id)
  const project = $app.findRecordById('projects', sheet.getString('project'))
  const operator = $app.findRecordById('users', sheet.getString('operator'))

  const extData = sheet.get('extraction_data') || []
  let fallbackMorning = ''
  let fallbackAfternoon = ''
  if (Array.isArray(extData)) {
    for (let i = 0; i < extData.length; i++) {
      if (!fallbackMorning && extData[i].morning_time) fallbackMorning = extData[i].morning_time
      if (!fallbackAfternoon && extData[i].afternoon_time)
        fallbackAfternoon = extData[i].afternoon_time
    }
  }

  const morningTime = sheet.getString('morning_time') || fallbackMorning || '—'
  const afternoonTime = sheet.getString('afternoon_time') || fallbackAfternoon || '—'

  let extractionRows = ''
  if (Array.isArray(extData)) {
    extData.forEach((r) => {
      extractionRows += `<tr>
        <td style="border:1px solid #999;padding:6px;">${r.well || '—'}</td>
        <td style="border:1px solid #999;padding:6px;text-align:right;">${r.morning || '0'}</td>
        <td style="border:1px solid #999;padding:6px;text-align:right;">${r.afternoon || '0'}</td>
        <td style="border:1px solid #999;padding:6px;text-align:right;">${r.pump || '0'}</td>
        <td style="border:1px solid #999;padding:6px;text-align:right;">${r.autopump || '0'}</td>
      </tr>`
    })
  }

  const timeRow = `<tr>
    <td style="border:1px solid #999;padding:6px;background-color:#f0fdfa;font-weight:bold;">Horário da Leitura</td>
    <td style="border:1px solid #999;padding:6px;background-color:#f8fafc;font-weight:bold;text-align:center;">${morningTime}</td>
    <td style="border:1px solid #999;padding:6px;background-color:#f8fafc;font-weight:bold;text-align:center;">${afternoonTime}</td>
    <td colspan="2" style="border:1px solid #999;padding:6px;background-color:#f8fafc;color:#64748b;font-style:italic;">Registro único de horário das leituras</td>
  </tr>`

  const infData = sheet.get('infiltration_data') || {}
  const compData = sheet.get('compressor_data') || {}
  const oilData = sheet.get('oil_removal_data') || {}

  const dateStr = sheet.getString('date') ? sheet.getString('date').slice(0, 10) : '—'
  const mapKg = sheet.getFloat('nutrient_map_kg') || 0
  const ureiaKg = sheet.getFloat('nutrient_ureia_kg') || 0

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8">
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; }
      th { background-color: #086B63; color: #ffffff; border: 1px solid #999; padding: 7px; }
      td { border: 1px solid #999; padding: 6px; }
      .header-title { background-color: #086B63; color: #ffffff; font-size: 14px; font-weight: bold; text-align: center; }
      .section-hdr { background-color: #e6f5f3; color: #086B63; font-weight: bold; }
      .label-col { background-color: #f0fdfa; font-weight: bold; }
    </style>
  </head>
  <body>
    <table>
      <tr>
        <td colspan="5" style="background-color: #044741; color: #ffffff; padding: 14px; text-align: center;">
          <div style="font-size: 16px; font-weight: bold; letter-spacing: 1px;">GRUPO EPA</div>
          <div style="font-size: 11px; margin-top: 4px; color: #a7f3d0;">SISTEMA INTEGRADO DE GESTÃO AMBIENTAL</div>
        </td>
      </tr>
      <tr>
        <td colspan="5" class="header-title" style="padding: 10px;">PLANILHA DE CAMPO & CONTROLE OPERACIONAL</td>
      </tr>
      <tr>
        <td class="label-col">Projeto</td>
        <td colspan="2">${project.getString('name')}</td>
        <td class="label-col">Data</td>
        <td>${dateStr}</td>
      </tr>
      <tr>
        <td class="label-col">Área</td>
        <td colspan="2">${sheet.getString('area')}</td>
        <td class="label-col">Operador</td>
        <td>${operator.getString('name')}</td>
      </tr>
      <tr>
        <td class="label-col">Clima</td>
        <td colspan="2">${sheet.getString('weather') || 'Sol'}</td>
        <td class="label-col">Pluviômetro</td>
        <td>${sheet.getFloat('pluviometer') || 0} mm</td>
      </tr>
      <tr>
        <td colspan="5" class="section-hdr">EXTRAÇÃO / VOLUME BOMBEADO</td>
      </tr>
      <tr>
        <th>Poço</th>
        <th>Hidrômetro Manhã</th>
        <th>Hidrômetro Tarde</th>
        <th>Bomba</th>
        <th>Auto Bomba</th>
      </tr>
      ${extractionRows}
      ${timeRow}
      <tr>
        <td colspan="5" class="section-hdr">INFILTRAÇÃO</td>
      </tr>
      <tr>
        <td class="label-col">Geral Manhã</td>
        <td>${infData.geralMorning || '—'}</td>
        <td class="label-col">Geral Tarde</td>
        <td colspan="2">${infData.geralAfternoon || '—'}</td>
      </tr>
      <tr>
        <td colspan="5" class="section-hdr">DOSAGEM DE NUTRIENTES</td>
      </tr>
      <tr>
        <td class="label-col">MAP (kg)</td>
        <td>${mapKg}</td>
        <td class="label-col">Ureia (kg)</td>
        <td>${ureiaKg}</td>
        <td><b>Total: ${mapKg + ureiaKg} kg</b></td>
      </tr>
      <tr>
        <td colspan="5" class="section-hdr">COMPRESSORES & SAO</td>
      </tr>
      <tr>
        <td class="label-col">Pressão 01</td>
        <td>${compData.pressure1 || '7,2 bar'}</td>
        <td class="label-col">Pressão 02</td>
        <td colspan="2">${compData.pressure2 || '7,0 bar'}</td>
      </tr>
      <tr>
        <td class="label-col">SAO 01 (L)</td>
        <td>${oilData.sao1Volume || '2,5'}</td>
        <td class="label-col">SAO 02 (L)</td>
        <td colspan="2">${oilData.sao2Volume || '1,2'}</td>
      </tr>
      <tr>
        <td colspan="5" class="section-hdr">CONTROLE AMBIENTAL & OBSERVAÇÕES</td>
      </tr>
      <tr>
        <td class="label-col">5S</td>
        <td>${sheet.getBool('env_5s_check') ? 'Conforme' : 'Pendente'}</td>
        <td class="label-col">Checklist</td>
        <td colspan="2">${sheet.getBool('env_checklist_monthly') ? 'Conforme' : 'Pendente'}</td>
      </tr>
      <tr>
        <td class="label-col">Observações</td>
        <td colspan="4">${sheet.getString('observations') || '—'}</td>
      </tr>
    </table>
  </body>
  </html>`

  c.response().header().set('Content-Type', 'application/vnd.ms-excel; charset=utf-8')
  c.response()
    .header()
    .set('Content-Disposition', `attachment; filename="Planilha-Campo-EPA-${dateStr}.xls"`)
  return c.string(200, html)
})
