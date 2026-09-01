/// <reference path="../pb_data/types.d.ts" />

routerAdd('GET', '/api/epa/export/field/{id}', (c) => {
  const auth = c.get('authRecord')
  if (!auth) {
    return c.json(401, { error: 'Não autenticado' })
  }
  if (auth.getString('role') !== 'admin') {
    return c.json(403, { error: 'Exportação restrita a Administradores' })
  }

  const id = c.pathParam('id')
  const sheet = $app.findRecordById('field_spreadsheets', id)
  const project = $app.findRecordById('projects', sheet.getString('project'))
  const operator = $app.findRecordById('users', sheet.getString('operator'))

  const extData = sheet.get('extraction_data') || []
  let extractionRows = ''
  if (Array.isArray(extData)) {
    extData.forEach((r) => {
      extractionRows += `<tr>
        <td style="border:1px solid #999;padding:6px;">${r.well || '—'}</td>
        <td style="border:1px solid #999;padding:6px;">${r.morning || '0'}</td>
        <td style="border:1px solid #999;padding:6px;">${r.afternoon || '0'}</td>
        <td style="border:1px solid #999;padding:6px;">${r.pump || '0'}</td>
        <td style="border:1px solid #999;padding:6px;">${r.autopump || '0'}</td>
      </tr>`
    })
  }

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
      th { background-color: #064e3b; color: #ffffff; border: 1px solid #999; padding: 7px; }
      td { border: 1px solid #999; padding: 6px; }
      .header-title { background-color: #064e3b; color: #ffffff; font-size: 14px; font-weight: bold; text-align: center; }
      .section-hdr { background-color: #e6f4ea; color: #064e3b; font-weight: bold; }
      .label-col { background-color: #f1f5f9; font-weight: bold; }
    </style>
  </head>
  <body>
    <table>
      <tr>
        <td colspan="5" class="header-title" style="padding: 12px;">GRUPO EPA — PLANILHA DE CAMPO & CONTROLE OPERACIONAL</td>
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
