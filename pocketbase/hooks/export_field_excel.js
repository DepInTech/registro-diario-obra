/// <reference path="../pb_data/types.d.ts" />

routerAdd('GET', '/backend/v1/epa/export/field/{id}', (c) => {
  const auth = c.get('authRecord')
  if (!auth) {
    return c.json(401, { error: 'Não autenticado' })
  }
  const role = auth.getString('role')
  if (role !== 'admin') {
    return c.json(403, { error: 'Exportação de planilha permitida apenas para Administradores' })
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

  const morningTime = sheet.getString('morning_time') || fallbackMorning || ''
  const afternoonTime = sheet.getString('afternoon_time') || fallbackAfternoon || ''
  const infMorningTime = sheet.getString('infiltration_morning_time') || ''
  const infAfternoonTime = sheet.getString('infiltration_afternoon_time') || ''

  let extractionRows = ''
  if (Array.isArray(extData) && extData.length > 0) {
    extData.forEach((r) => {
      extractionRows += `<tr>
        <td style="border:1px solid #777;padding:5px 8px;text-align:center;font-weight:bold;">${r.well || '—'}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:right;">${r.morning || ''}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:right;">${r.afternoon || ''}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:center;">${r.pump || ''}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:center;">${r.autopump || ''}</td>
      </tr>`
    })
  } else {
    extractionRows = `<tr><td colspan="5" style="border:1px solid #777;padding:8px;text-align:center;color:#666;">Nenhum poço registrado</td></tr>`
  }

  const infData = sheet.get('infiltration_data') || {}
  const compData = sheet.get('compressor_data') || {}
  const oilData = sheet.get('oil_removal_data') || {}

  const dateStr = sheet.getString('date') ? sheet.getString('date').slice(0, 10) : ''
  const mapKg = sheet.getFloat('nutrient_map_kg') || 0
  const ureiaKg = sheet.getFloat('nutrient_ureia_kg') || 0
  const wasteLiquid = sheet.getFloat('waste_liquid_qty') || 0
  const wasteSolid = sheet.getFloat('waste_solid_qty') || 0
  const env5s = sheet.getBool('env_5s_check')
  const envChecklist = sheet.getBool('env_checklist_monthly')
  const nutrientDone = sheet.getBool('nutrient_done')

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8">
    <style>
      table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11px; }
      th { background-color: #0b5345; color: #ffffff; border: 1px solid #555; padding: 6px; font-weight: bold; }
      td { border: 1px solid #777; padding: 5px 6px; }
      .header-title { background-color: #0b5345; color: #ffffff; font-size: 13px; font-weight: bold; text-align: center; }
      .section-hdr { background-color: #d1e7dd; color: #0b5345; font-weight: bold; font-size: 11px; border: 1px solid #777; }
      .label-col { background-color: #f2f7f5; font-weight: bold; border: 1px solid #777; }
    </style>
  </head>
  <body>
    <table style="width:100%;">
      <!-- CABEÇALHO OFICIAL -->
      <tr>
        <td colspan="5" class="header-title" style="padding: 12px; font-size: 14px;">
          Controle Operacional Diário de Remediação
        </td>
      </tr>

      <!-- CABEÇALHO DE METADADOS -->
      <tr>
        <td class="label-col" style="width: 20%;">OPERADOR:</td>
        <td style="width: 25%; font-weight: bold;">${operator.getString('name')}</td>
        <td class="label-col" style="width: 15%;">DATA:</td>
        <td colspan="2" style="width: 40%; font-weight: bold;">${dateStr}</td>
      </tr>
      <tr>
        <td class="label-col">ÁREA:</td>
        <td>${sheet.getString('area')}</td>
        <td class="label-col">CLIMA:</td>
        <td colspan="2">${sheet.getString('weather') || 'Sol'}</td>
      </tr>
      <tr>
        <td class="label-col">PLUVIÔMETRO:</td>
        <td colspan="4">${sheet.getFloat('pluviometer') || 0} mm</td>
      </tr>

      <!-- 1. EXTRAÇÃO/VOLUME BOMBEADO -->
      <tr>
        <td colspan="5" class="section-hdr" style="padding: 7px;">1. EXTRAÇÃO/VOLUME BOMBEADO</td>
      </tr>
      <tr>
        <th style="width: 22%;">Poço de Remediação</th>
        <th style="width: 20%;">
          Hidrômetro (Manhã)<br>
          <span style="font-size: 9px; font-weight: normal; color: #d1fae5;">Hora: ${morningTime || '—'}</span>
        </th>
        <th style="width: 20%;">
          Hidrômetro (Tarde)<br>
          <span style="font-size: 9px; font-weight: normal; color: #d1fae5;">Hora: ${afternoonTime || '—'}</span>
        </th>
        <th style="width: 18%;">Altura da bomba (m)</th>
        <th style="width: 20%;">Saída de Cada Autopump (500mL)*</th>
      </tr>
      ${extractionRows}

      <!-- 2. INFILTRAÇÃO/VOLUME INFILTRADO -->
      <tr>
        <td colspan="5" class="section-hdr" style="padding: 7px;">2. INFILTRAÇÃO/VOLUME INFILTRADO</td>
      </tr>
      <tr>
        <th style="width: 30%;">Hidrômetro</th>
        <th colspan="2" style="width: 35%;">
          Manhã<br>
          <span style="font-size: 9px; font-weight: normal; color: #d1fae5;">Hora: ${infMorningTime || '—'}</span>
        </th>
        <th colspan="2" style="width: 35%;">
          Tarde<br>
          <span style="font-size: 9px; font-weight: normal; color: #d1fae5;">Hora: ${infAfternoonTime || '—'}</span>
        </th>
      </tr>
      <tr>
        <td class="label-col">Geral</td>
        <td colspan="2" style="text-align:right;">${infData.geralMorning || ''}</td>
        <td colspan="2" style="text-align:right;">${infData.geralAfternoon || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Saída 01</td>
        <td colspan="2" style="text-align:right;">${infData.out1Morning || ''}</td>
        <td colspan="2" style="text-align:right;">${infData.out1Afternoon || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Saída 02</td>
        <td colspan="2" style="text-align:right;">${infData.out2Morning || ''}</td>
        <td colspan="2" style="text-align:right;">${infData.out2Afternoon || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Saída 03</td>
        <td colspan="2" style="text-align:right;">${infData.out3Morning || ''}</td>
        <td colspan="2" style="text-align:right;">${infData.out3Afternoon || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Pressão da Bomba (Infiltração)</td>
        <td colspan="2" style="text-align:center;">${infData.bombaInfiltracao || ''}</td>
        <td class="label-col">Pressão da Bomba - Geral</td>
        <td style="text-align:center;">${infData.bombaGeral || ''}</td>
      </tr>

      <!-- 3. DOSAGEM DE NUTRIENTES -->
      <tr>
        <td colspan="5" class="section-hdr" style="padding: 7px;">3. DOSAGEM DE NUTRIENTES</td>
      </tr>
      <tr>
        <th style="width: 30%;">Realizada (S/N)</th>
        <th colspan="2" style="width: 35%;">Quantidade MAP (Kg)</th>
        <th colspan="2" style="width: 35%;">Quantidade Ureia (Kg)</th>
      </tr>
      <tr>
        <td style="text-align:center; font-weight:bold;">${nutrientDone ? 'Sim' : 'Não'}</td>
        <td colspan="2" style="text-align:center; font-weight:bold;">${mapKg}</td>
        <td colspan="2" style="text-align:center; font-weight:bold;">${ureiaKg}</td>
      </tr>

      <!-- 4. COMPRESSORES -->
      <tr>
        <td colspan="5" class="section-hdr" style="padding: 7px;">4. COMPRESSORES</td>
      </tr>
      <tr>
        <th style="width: 40%;">PARÂMETROS</th>
        <th colspan="2" style="width: 30%;">COMPRESSOR 01</th>
        <th colspan="2" style="width: 30%;">COMPRESSOR 02</th>
      </tr>
      <tr>
        <td class="label-col">Horímetro (hr)</td>
        <td colspan="2" style="text-align:center;">${compData.horimetro1 || ''}</td>
        <td colspan="2" style="text-align:center;">${compData.horimetro2 || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Pressão (bar)</td>
        <td colspan="2" style="text-align:center;">${compData.pressao1 || compData.pressure1 || ''}</td>
        <td colspan="2" style="text-align:center;">${compData.pressao2 || compData.pressure2 || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Drenagem de água (mL)</td>
        <td colspan="2" style="text-align:center;">${compData.drenagem1 || ''}</td>
        <td colspan="2" style="text-align:center;">${compData.drenagem2 || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Tempo Desligado</td>
        <td colspan="2" style="text-align:center;">${compData.tempoDesligado1 || ''}</td>
        <td colspan="2" style="text-align:center;">${compData.tempoDesligado2 || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Troca do filtro de ar</td>
        <td colspan="2" style="text-align:center;">${compData.filtroAr1 || ''}</td>
        <td colspan="2" style="text-align:center;">${compData.filtroAr2 || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Nível de óleo</td>
        <td colspan="2" style="text-align:center;">${compData.nivelOleo1 || ''}</td>
        <td colspan="2" style="text-align:center;">${compData.nivelOleo2 || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Troca de óleo e filtro (a cada 1000hrs)</td>
        <td colspan="2" style="text-align:center;">${compData.trocaOleo1 || ''}</td>
        <td colspan="2" style="text-align:center;">${compData.trocaOleo2 || ''}</td>
      </tr>
      <tr>
        <th style="width: 40%; background-color:#145a32;">LINHA DE AR</th>
        <th colspan="2" style="width: 30%; background-color:#145a32;">COMPRESSOR 01</th>
        <th colspan="2" style="width: 30%; background-color:#145a32;">COMPRESSOR 02</th>
      </tr>
      <tr>
        <td class="label-col">Pressão da Linha de Ar</td>
        <td colspan="2" style="text-align:center; font-weight:bold;">${compData.linhaAr1 || ''}</td>
        <td colspan="2" style="text-align:center; font-weight:bold;">${compData.linhaAr2 || ''}</td>
      </tr>

      <!-- 5. REMOÇÃO DE ÓLEO -->
      <tr>
        <td colspan="5" class="section-hdr" style="padding: 7px;">5. REMOÇÃO DE ÓLEO</td>
      </tr>
      <tr>
        <td colspan="5" style="background-color:#f9fbf9; font-weight:bold; border:1px solid #777;">Caixa Separadora (SAO 01)</td>
      </tr>
      <tr>
        <td class="label-col">Volume de óleo removido (mL):</td>
        <td colspan="2" style="text-align:center;">${oilData.sao1Volume || ''}</td>
        <td class="label-col">Data da última limpeza:</td>
        <td style="text-align:center; font-weight:bold;">${oilData.sao1DataLimpeza || oilData.sao1Date || ''}</td>
      </tr>
      <tr>
        <td colspan="5" style="background-color:#f9fbf9; font-weight:bold; border:1px solid #777;">Caixa Separadora (SAO 02)</td>
      </tr>
      <tr>
        <td class="label-col">Volume de óleo removido (mL):</td>
        <td colspan="2" style="text-align:center;">${oilData.sao2Volume || ''}</td>
        <td class="label-col">Data da última limpeza:</td>
        <td style="text-align:center; font-weight:bold;">${oilData.sao2DataLimpeza || oilData.sao2Date || ''}</td>
      </tr>

      <!-- 6. RESÍDUOS SÓLIDOS E LÍQUIDOS -->
      <tr>
        <td colspan="5" class="section-hdr" style="padding: 7px;">6. RESÍDUOS SÓLIDOS E LÍQUIDOS</td>
      </tr>
      <tr>
        <td colspan="2" class="label-col" style="text-align:center;">TAMBORES PARA RETIRADA (QNTD) - Líquido</td>
        <td colspan="3" class="label-col" style="text-align:center;">TAMBORES PARA RETIRADA (QNTD) - Sólido</td>
      </tr>
      <tr>
        <td colspan="2" style="text-align:center; font-size: 13px; font-weight:bold;">${wasteLiquid}</td>
        <td colspan="3" style="text-align:center; font-size: 13px; font-weight:bold;">${wasteSolid}</td>
      </tr>

      <!-- 7. CONTROLES AMBIENTAIS E 5S -->
      <tr>
        <td colspan="5" class="section-hdr" style="padding: 7px;">7. CONTROLES AMBIENTAIS E 5S</td>
      </tr>
      <tr>
        <td class="label-col">5S (S/N):</td>
        <td style="text-align:center; font-weight:bold;">${env5s ? 'Sim' : 'Não'}</td>
        <td class="label-col">CHECKLIST MENSAL (S/N):</td>
        <td colspan="2" style="text-align:center; font-weight:bold;">${envChecklist ? 'Sim' : 'Não'}</td>
      </tr>

      <!-- 8. OBSERVAÇÕES E MANUTENÇÕES -->
      <tr>
        <td colspan="5" class="section-hdr" style="padding: 7px;">8. OBSERVAÇÕES E MANUTENÇÕES</td>
      </tr>
      <tr>
        <td colspan="5" style="padding: 10px; min-height: 50px;">${sheet.getString('observations') || '—'}</td>
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
