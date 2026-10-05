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
      let finalAutopump = r.autopump || ''
      if (!finalAutopump && r.autopump_condition) {
        finalAutopump =
          r.autopump_condition === 'Outros' && r.autopump_condition_other
            ? `Outros — ${r.autopump_condition_other}`
            : r.autopump_condition
      }

      extractionRows += `<tr>
        <td style="border:1px solid #777;padding:5px 8px;text-align:center;font-weight:bold;">${r.well || '—'}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:right;">${r.morning || ''}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:right;">${r.afternoon || ''}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:center;">${r.pump || ''}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:center;">${finalAutopump}</td>
      </tr>`
    })
  } else {
    extractionRows = `<tr><td colspan="5" style="border:1px solid #777;padding:8px;text-align:center;color:#666;">Nenhum poço registrado</td></tr>`
  }

  let infData = sheet.get('infiltration_data') || {}
  if (typeof infData === 'string' && infData.trim() !== '') {
    try {
      infData = JSON.parse(infData)
    } catch (_) {
      infData = {}
    }
  }
  let compData = sheet.get('compressor_data') || {}
  if (typeof compData === 'string' && compData.trim() !== '') {
    try {
      compData = JSON.parse(compData)
    } catch (_) {
      compData = {}
    }
  }
  let oilData = sheet.get('oil_removal_data') || {}
  if (typeof oilData === 'string' && oilData.trim() !== '') {
    try {
      oilData = JSON.parse(oilData)
    } catch (_) {
      oilData = {}
    }
  }

  // Determinação dinâmica de compressores
  const compIndicesSet = new Set([1, 2])
  if (compData && typeof compData === 'object') {
    Object.keys(compData).forEach((key) => {
      const match = key.match(/\d+$/)
      if (match) {
        const num = parseInt(match[0], 10)
        if (!isNaN(num) && num >= 1 && num <= 100) {
          compIndicesSet.add(num)
        }
      }
    })
  }
  const compIndices = Array.from(compIndicesSet).sort((a, b) => a - b)

  // Determinação dinâmica de saídas de infiltração
  const infExitsSet = new Set([1, 2, 3])
  if (infData && typeof infData === 'object') {
    Object.keys(infData).forEach((key) => {
      const match = key.match(/^out(\d+)(Morning|Afternoon)$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num >= 1 && num <= 100) {
          infExitsSet.add(num)
        }
      }
    })
  }
  const infExits = Array.from(infExitsSet).sort((a, b) => a - b)

  let dynamicInfExitRows = ''
  for (let i = 0; i < infExits.length; i++) {
    const n = infExits[i]
    const padStr = String(n).padStart(2, '0')
    const mVal = infData['out' + n + 'Morning'] || ''
    const aVal = infData['out' + n + 'Afternoon'] || ''
    dynamicInfExitRows +=
      '<tr>' +
      '<td class="label-col">Saída ' +
      padStr +
      '</td>' +
      '<td colspan="2" style="text-align:right;">' +
      mVal +
      '</td>' +
      '<td colspan="2" style="text-align:right;">' +
      aVal +
      '</td>' +
      '</tr>'
  }

  let compHeaderCells = ''
  let linhaArHeaderCells = ''
  for (let i = 0; i < compIndices.length; i++) {
    const c = compIndices[i]
    const pad = String(c).padStart(2, '0')
    compHeaderCells += '<th style="text-align:center;">COMPRESSOR ' + pad + '</th>'
    linhaArHeaderCells +=
      '<th style="text-align:center; background-color:#145a32;">COMPRESSOR ' + pad + '</th>'
  }

  const compParamSpecs = [
    { label: 'Horímetro (hr)', prefix: 'horimetro' },
    { label: 'Pressão (bar)', prefix: 'pressao', fallbackPrefix: 'pressure' },
    { label: 'Drenagem de água (mL)', prefix: 'drenagem' },
    { label: 'Tempo Desligado', prefix: 'tempoDesligado' },
    { label: 'Troca do filtro de ar', prefix: 'filtroAr' },
    { label: 'Nível de óleo', prefix: 'nivelOleo' },
    { label: 'Troca de óleo e filtro (a cada 1000hrs)', prefix: 'trocaOleo' },
  ]

  let compParamRows = ''
  for (let s = 0; s < compParamSpecs.length; s++) {
    const spec = compParamSpecs[s]
    let cells = ''
    for (let i = 0; i < compIndices.length; i++) {
      const c = compIndices[i]
      const val =
        compData[spec.prefix + c] ||
        (spec.fallbackPrefix ? compData[spec.fallbackPrefix + c] : '') ||
        ''
      cells += '<td style="text-align:center;">' + val + '</td>'
    }
    compParamRows += '<tr><td class="label-col">' + spec.label + '</td>' + cells + '</tr>'
  }

  let linhaArCells = ''
  for (let i = 0; i < compIndices.length; i++) {
    const c = compIndices[i]
    const val = compData['linhaAr' + c] || ''
    linhaArCells += '<td style="text-align:center; font-weight:bold;">' + val + '</td>'
  }

  const tableColSpan = Math.max(5, 1 + compIndices.length)

  const dateStr = sheet.getString('date') ? sheet.getString('date').slice(0, 10) : ''
  const mapKg = sheet.getFloat('nutrient_map_kg') || 0
  const ureiaKg = sheet.getFloat('nutrient_ureia_kg') || 0
  const wasteLiquid = sheet.getString('waste_liquid_qty') || '—'
  const wasteSolid = sheet.getString('waste_solid_qty') || '—'
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
        <td colspan="${tableColSpan}" class="header-title" style="padding: 12px; font-size: 14px;">
          Controle Operacional Diário de Remediação
        </td>
      </tr>

      <!-- CABEÇALHO DE METADADOS -->
      <tr>
        <td class="label-col" style="width: 20%;">TÉCNICO / RESPONSÁVEL:</td>
        <td style="width: 25%; font-weight: bold;">${sheet.operatorName || ''}</td>
        <td class="label-col" style="width: 15%;">DATA:</td>
        <td colspan="${tableColSpan - 3}" style="width: 40%; font-weight: bold;">${sheet.date || ''}</td>
      </tr>
      <tr>
        <td class="label-col">ÁREA:</td>
        <td>${sheet.area || ''}</td>
        <td class="label-col">CLIMA:</td>
        <td colspan="${tableColSpan - 3}">${sheet.weather || 'Ensolarado'}</td>
      </tr>
      <tr>
        <td class="label-col">PLUVIÔMETRO:</td>
        <td colspan="${tableColSpan - 1}">${sheet.pluviometer || 0} mm</td>
      </tr>

      <!-- 1. EXTRAÇÃO/VOLUME BOMBEADO -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 7px;">1. EXTRAÇÃO/VOLUME BOMBEADO</td>
      </tr>
      <tr>
        <th style="width: 20%;">Poço de Remediação</th>
        <th style="width: 20%;">
          Hidrômetro (Manhã)<br>
          <span style="font-size: 9px; font-weight: normal; color: #111827;">Hora: ${morningTime || '—'}</span>
        </th>
        <th style="width: 20%;">
          Hidrômetro (Tarde)<br>
          <span style="font-size: 9px; font-weight: normal; color: #111827;">Hora: ${afternoonTime || '—'}</span>
        </th>
        <th style="width: 18%;">Altura da bomba (m)</th>
        <th colspan="${tableColSpan - 4}" style="width: 22%;">Saída Autopump (500mL)*</th>
      </tr>
      ${extractionRows}

      <!-- 2. INFILTRAÇÃO/VOLUME INFILTRADO -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 7px;">2. INFILTRAÇÃO/VOLUME INFILTRADO</td>
      </tr>
      <tr>
        <th style="width: 30%;">Hidrômetro</th>
        <th colspan="2" style="width: 35%;">
          Manhã<br>
          <span style="font-size: 9px; font-weight: normal; color: #111827;">Hora: ${infMorningTime || '—'}</span>
        </th>
        <th colspan="${tableColSpan - 3}" style="width: 35%;">
          Tarde<br>
          <span style="font-size: 9px; font-weight: normal; color: #111827;">Hora: ${infAfternoonTime || '—'}</span>
        </th>
      </tr>
      <tr>
        <td class="label-col">Geral</td>
        <td colspan="2" style="text-align:right;">${infData.geralMorning || ''}</td>
        <td colspan="${tableColSpan - 3}" style="text-align:right;">${infData.geralAfternoon || ''}</td>
      </tr>
      ${dynamicInfExitRows}
      <tr>
        <td class="label-col">Pressão da Bomba (Infiltração)</td>
        <td colspan="2" style="text-align:center;">${infData.bombaInfiltracao || ''}</td>
        <td class="label-col">Pressão da Bomba - Geral</td>
        <td colspan="${Math.max(1, tableColSpan - 4)}" style="text-align:center;">${infData.bombaGeral || ''}</td>
      </tr>

      <!-- 3. DOSAGEM DE NUTRIENTES -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 7px;">3. DOSAGEM DE NUTRIENTES</td>
      </tr>
      <tr>
        <th style="width: 30%;">Realizada (S/N)</th>
        <th colspan="2" style="width: 35%;">Quantidade MAP (Kg)</th>
        <th colspan="${tableColSpan - 3}" style="width: 35%;">Quantidade Ureia (Kg)</th>
      </tr>
      <tr>
        <td style="text-align:center; font-weight:bold;">${nutrientDone ? 'Sim' : 'Não'}</td>
        <td colspan="2" style="text-align:center; font-weight:bold;">${mapKg}</td>
        <td colspan="${tableColSpan - 3}" style="text-align:center; font-weight:bold;">${ureiaKg}</td>
      </tr>

      <!-- 4. COMPRESSORES -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 7px;">4. COMPRESSORES</td>
      </tr>
      <tr>
        <th style="width: 35%;">PARÂMETROS</th>
        ${compHeaderCells}
      </tr>
      ${compParamRows}
      <tr>
        <th style="width: 35%; background-color:#145a32;">LINHA DE AR</th>
        ${linhaArHeaderCells}
      </tr>
      <tr>
        <td class="label-col">Pressão da Linha de Ar</td>
        ${linhaArCells}
      </tr>

      <!-- 5. REMOÇÃO DE ÓLEO -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 7px;">5. REMOÇÃO DE ÓLEO</td>
      </tr>
      <tr>
        <td colspan="${tableColSpan}" style="background-color:#f9fbf9; font-weight:bold; border:1px solid #777;">Caixa Separadora (SAO 01)</td>
      </tr>
      <tr>
        <td class="label-col">Volume de óleo removido (mL):</td>
        <td colspan="2" style="text-align:center;">${oilData.sao1Volume || ''}</td>
        <td class="label-col">Data da última limpeza:</td>
        <td colspan="${Math.max(1, tableColSpan - 4)}" style="text-align:center; font-weight:bold;">${oilData.sao1DataLimpeza || oilData.sao1Date || ''}</td>
      </tr>
      <tr>
        <td colspan="${tableColSpan}" style="background-color:#f9fbf9; font-weight:bold; border:1px solid #777;">Caixa Separadora (SAO 02)</td>
      </tr>
      <tr>
        <td class="label-col">Volume de óleo removido (mL):</td>
        <td colspan="2" style="text-align:center;">${oilData.sao2Volume || ''}</td>
        <td class="label-col">Data da última limpeza:</td>
        <td colspan="${Math.max(1, tableColSpan - 4)}" style="text-align:center; font-weight:bold;">${oilData.sao2DataLimpeza || oilData.sao2Date || ''}</td>
      </tr>

      <!-- 6. RESÍDUOS SÓLIDOS E LÍQUIDOS -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 7px;">6. RESÍDUOS SÓLIDOS E LÍQUIDOS</td>
      </tr>
      <tr>
        <td colspan="2" class="label-col" style="text-align:center;">TAMBORES PARA RETIRADA (QNTD) - Líquido</td>
        <td colspan="${tableColSpan - 2}" class="label-col" style="text-align:center;">TAMBORES PARA RETIRADA (QNTD) - Sólido</td>
      </tr>
      <tr>
        <td colspan="2" style="text-align:center; font-size: 13px; font-weight:bold;">${sheet.waste_liquid_qty || '—'}</td>
        <td colspan="${tableColSpan - 2}" style="text-align:center; font-size: 13px; font-weight:bold;">${sheet.waste_solid_qty || '—'}</td>
      </tr>

      <!-- 7. CONTROLES AMBIENTAIS E 5S -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 7px;">7. CONTROLES AMBIENTAIS E 5S</td>
      </tr>
      <tr>
        <td class="label-col">5S (S/N):</td>
        <td style="text-align:center; font-weight:bold;">${sheet.env_5s_check ? 'Sim' : 'Não'}</td>
        <td class="label-col">CHECKLIST MENSAL (S/N):</td>
        <td colspan="${tableColSpan - 3}" style="text-align:center; font-weight:bold;">${sheet.env_checklist_monthly ? 'Sim' : 'Não'}</td>
      </tr>

      <!-- 8. OBSERVAÇÕES E MANUTENÇÕES -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 7px;">8. OBSERVAÇÕES E MANUTENÇÕES</td>
      </tr>
      <tr>
        <td colspan="${tableColSpan}" style="padding: 10px; min-height: 50px;">${sheet.observations || '—'}</td>
      </tr>    </table>
  </body>
  </html>`

  c.response().header().set('Content-Type', 'application/vnd.ms-excel; charset=utf-8')
  c.response()
    .header()
    .set('Content-Disposition', `attachment; filename="Planilha-Campo-EPA-${dateStr}.xls"`)
  return c.string(200, html)
})
