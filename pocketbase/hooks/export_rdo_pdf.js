/// <reference path="../pb_data/types.d.ts" />

routerAdd('GET', '/backend/v1/epa/export/rdo/{id}', (c) => {
  const auth = c.get('authRecord')
  if (!auth) {
    return c.json(401, { error: 'Não autenticado' })
  }
  const role = auth.getString('role')
  if (role !== 'admin' && role !== 'technician') {
    return c.json(403, { error: 'Exportação permitida apenas para Administradores e Técnicos' })
  }

  const id = c.pathParam('id')
  const rdo = $app.findRecordById('reports_rdo', id)
  const project = $app.findRecordById('projects', rdo.getString('project'))
  const client = $app.findRecordById('clients', project.getString('client'))
  const contract = $app.findRecordById('contracts', project.getString('contract'))
  const company = $app.findRecordById('companies', project.getString('company'))
  const performer = $app.findRecordById('users', rdo.getString('performed_by'))
  let supervisorName = 'Marina Santos'
  if (rdo.getString('supervised_by')) {
    try {
      const sup = $app.findRecordById('users', rdo.getString('supervised_by'))
      supervisorName = sup.getString('name')
    } catch (_) {}
  }

  // Wells: se houver poços cadastrados usa eles, senão usa poços modelo de tamponamento
  let wells = $app.findRecordsByFilter('report_wells', `report = "${id}"`, 'created')
  let wellsList = []
  if (wells.length > 0) {
    wellsList = wells.map((w) => ({
      well_id: w.getString('well_id') || '',
      depth: w.getFloat('depth') ? w.getFloat('depth') + ' m' : '',
      completion_date: w.getString('completion_date')
        ? w.getString('completion_date').slice(0, 10)
        : '',
      diameter: w.getString('diameter') || '',
    }))
  } else {
    wellsList = [
      { well_id: 'AS-26', depth: '', completion_date: '', diameter: '1/2"' },
      { well_id: 'AS-27', depth: '', completion_date: '', diameter: '1/2"' },
      { well_id: 'AS-28', depth: '', completion_date: '', diameter: '1/2"' },
      { well_id: 'AS-29', depth: '', completion_date: '', diameter: '1/2"' },
      { well_id: 'AS-30', depth: '', completion_date: '', diameter: '1/2"' },
      { well_id: 'AS-31', depth: '', completion_date: '', diameter: '1/2"' },
      { well_id: 'AS-32', depth: '', completion_date: '', diameter: '1/2"' },
      { well_id: 'AS-33', depth: '', completion_date: '', diameter: '1/2"' },
      { well_id: 'AS-34', depth: '', completion_date: '', diameter: '1/2"' },
      { well_id: 'AS-35', depth: '', completion_date: '', diameter: '1/2"' },
      { well_id: 'PB-127', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-128', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-129', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-130', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-131', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-132', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-134', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-136', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-137', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-138', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-140', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-141', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-25', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-26', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-27', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-28', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-29', depth: '', completion_date: '', diameter: '2"' },
      { well_id: 'PB-30', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-31', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-33', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-34', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-35', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-36', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-37', depth: '28,00', completion_date: '27/05/2026', diameter: '4"' },
      { well_id: 'PB-38', depth: '28,01', completion_date: '27/05/2026', diameter: '4"' },
      { well_id: 'PB-39', depth: '28,00', completion_date: '27/05/2026', diameter: '4"' },
      { well_id: 'PB-40', depth: '28,03', completion_date: '27/05/2026', diameter: '4"' },
      { well_id: 'PB-41', depth: '', completion_date: '', diameter: '4"' },
      { well_id: 'PB-42', depth: '28,06', completion_date: '26/05/2026', diameter: '4"' },
      { well_id: 'PM-18', depth: '', completion_date: '', diameter: '2"' },
      { well_id: 'PM-19', depth: '', completion_date: '', diameter: '2"' },
      { well_id: 'PM-20', depth: '', completion_date: '', diameter: '2"' },
      { well_id: 'PM-21', depth: '', completion_date: '', diameter: '2"' },
      { well_id: 'PM-37', depth: '', completion_date: '', diameter: '2"' },
      { well_id: 'PM-38', depth: '', completion_date: '', diameter: '2"' },
      { well_id: 'PM-48', depth: '', completion_date: '', diameter: '2"' },
      { well_id: 'PM-49', depth: '', completion_date: '', diameter: '2"' },
      { well_id: 'PM-51', depth: '', completion_date: '', diameter: '2"' },
      { well_id: 'PM-52', depth: '', completion_date: '', diameter: '2"' },
      { well_id: 'PM-53', depth: '', completion_date: '', diameter: '2"' },
    ]
  }

  const wellsPage1 = wellsList.slice(0, 25)
  const wellsPage2 = wellsList.slice(25)

  const renderWellsRows = (list) =>
    list
      .map(
        (w) => `<tr>
    <td style="text-align:center;font-weight:bold;">${w.well_id || ''}</td>
    <td style="text-align:center;">${w.depth || ''}</td>
    <td style="text-align:center;">${w.completion_date || ''}</td>
    <td style="text-align:center;">${w.diameter || ''}</td>
  </tr>`,
      )
      .join('')

  // Photos
  const photos = $app.findRecordsByFilter('report_photos', `report = "${id}"`, 'order')
  let photoCards = ''
  let fieldPhotoHtml = ''

  const fieldPhotoRecord = photos.find((p) => p.getString('category') === 'field_inspection')
  const generalPhotos = photos.filter((p) => p.getString('category') !== 'field_inspection')

  if (fieldPhotoRecord) {
    const fieldImg = fieldPhotoRecord.getString('image')
    const fieldSrc = fieldImg
      ? `/api/files/report_photos/${fieldPhotoRecord.id}/${fieldImg}`
      : 'https://img.usecurling.com/p/640/420?q=field%20site'
    const fieldCaption =
      fieldPhotoRecord.getString('caption') ||
      'Figura 01 – Mapa de localização da área de interesse.'

    fieldPhotoHtml = `
    <div style="margin-top:14px;text-align:center;break-inside:avoid;page-break-inside:avoid;">
      <p style="margin:0 0 8px 0;text-align:center;font-size:11px;font-weight:bold;color:#000;">${fieldCaption}</p>
      <div style="display:inline-block;width:100%;max-width:680px;text-align:center;">
        <img src="${fieldSrc}" style="width:100%;max-height:480px;object-fit:contain;border:1px solid #000;display:block;margin:0 auto;" alt="${fieldCaption}" />
      </div>
    </div>`
  }

  if (generalPhotos.length > 0) {
    let photoPairs = []
    for (let i = 0; i < generalPhotos.length; i += 2) {
      photoPairs.push(generalPhotos.slice(i, i + 2))
    }

    photoPairs.forEach((pair, pairIdx) => {
      const idx1 = pairIdx * 2 + 1
      const p1 = pair[0]
      const img1 = p1.getString('image')
      const src1 = img1
        ? `/api/files/report_photos/${p1.id}/${img1}`
        : 'https://img.usecurling.com/p/640/420?q=monitoring%20well'

      let img2Block = ''
      let defaultCaption = ''
      if (pair.length > 1) {
        const idx2 = pairIdx * 2 + 2
        const p2 = pair[1]
        const img2 = p2.getString('image')
        const src2 = img2
          ? `/api/files/report_photos/${p2.id}/${img2}`
          : 'https://img.usecurling.com/p/640/420?q=monitoring%20well'

        img2Block = `<div style="flex:1;text-align:center;">
          <img src="${src2}" style="width:100%;height:320px;object-fit:cover;display:block;" />
        </div>`

        const str1 = String(idx1).padStart(2, '0')
        const str2 = String(idx2).padStart(2, '0')
        defaultCaption = `Fotos ${str1} e ${str2} – ${p1.getString('caption') || p2.getString('caption') || 'Registro fotográfico de campo'}`
      } else {
        const str1 = String(idx1).padStart(2, '0')
        defaultCaption = `Foto ${str1} – ${p1.getString('caption') || 'Registro fotográfico de campo'}`
      }

      photoCards += `
      <div style="margin-top:14px;border:1px solid #000;break-inside:avoid;page-break-inside:avoid;background:#fff;">
        <div style="display:flex;flex-direction:row;gap:6px;padding:6px;border-bottom:1px solid #000;">
          <div style="flex:1;text-align:center;">
            <img src="${src1}" style="width:100%;height:320px;object-fit:cover;display:block;" />
          </div>
          ${img2Block}
        </div>
        <div style="padding:6px 10px;text-align:center;font-size:10.5px;font-weight:bold;color:#000;">
          ${defaultCaption}
        </div>
      </div>`
    })
  } else {
    photoCards = `<p style="border:1px solid #000;padding:12px;text-align:center;font-size:11px;margin-top:10px;">Sem registros fotográficos adicionados.</p>`
  }

  // Logo oficial EPA
  let logoSrc = '/og-image.png'
  try {
    const fs = $os.readFile('src/assets/logo-epa-3e647.png')
    if (fs && fs.length > 0) {
      const b64 = $security.base64Encode(fs)
      logoSrc = 'data:image/png;base64,' + b64
    }
  } catch (_) {}

  const dateStr = rdo.getString('report_date') ? rdo.getString('report_date').slice(0, 10) : '—'
  const rdoNumber = rdo.getInt('number')
  const rdoNumStr = `RDO ${String(rdoNumber).padStart(2, '0')} – ${project.getString('location') || 'Açailândia - MA'}`
  const activityTitleVal =
    rdo.getString('activity_title')?.trim() || 'Tamponamento de poços – Açailândia - MA'

  // Cabeçalho Oficial Repetido no topo de cada página (Logo + Título + Metadados)
  const pageHeaderHtml = `
    <div class="rdo-page-header">
      <div class="logo-title-box">
        <div class="logo-cell">
          <img src="${logoSrc}" class="epa-logo-img" alt="Grupo EPA" />
        </div>
        <div class="title-cell">
          Relatório Diário de Acompanhamento de Obras
        </div>
      </div>
      <table class="header-meta-table">
        <tr>
          <td style="width:50%;"><b>Cliente:</b> ${client.getString('name')}</td>
          <td style="width:50%;"><b>Local:</b> ${project.getString('location')}</td>
        </tr>
        <tr>
          <td><b>Contrato:</b> ${contract.getString('code')}</td>
          <td><b>Projeto EPA:</b> ${project.getString('name')}</td>
        </tr>
        <tr>
          <td colspan="2"><b>Empresa:</b> ${company.getString('name')}</td>
        </tr>
        <tr>
          <td colspan="2"><b>Realizado por:</b> ${performer.getString('name')}</td>
        </tr>
        <tr>
          <td colspan="2"><b>Supervisionado por:</b> ${supervisorName}</td>
        </tr>
        <tr>
          <td colspan="2"><b>Data:</b> ${dateStr}</td>
        </tr>
        <tr>
          <td colspan="2"><b>Clima:</b> ${rdo.getString('weather')}</td>
        </tr>
      </table>
    </div>
  `

  const pageFooterHtml = `
    <div class="rdo-page-footer">
      <div class="footer-line"></div>
      <div class="footer-text">${rdoNumStr}</div>
    </div>
  `

  // Fotos em pares
  let photoPagesHtml = []
  if (generalPhotos.length > 0) {
    let photoPairs = []
    for (let i = 0; i < generalPhotos.length; i += 2) {
      photoPairs.push(generalPhotos.slice(i, i + 2))
    }

    photoPairs.forEach((pair, pairIdx) => {
      const idx1 = pairIdx * 2 + 1
      const p1 = pair[0]
      const img1 = p1.getString('image')
      const src1 = img1
        ? `/api/files/report_photos/${p1.id}/${img1}`
        : 'https://img.usecurling.com/p/640/420?q=monitoring%20well'

      let img2Block = ''
      let defaultCaption = ''
      if (pair.length > 1) {
        const idx2 = pairIdx * 2 + 2
        const p2 = pair[1]
        const img2 = p2.getString('image')
        const src2 = img2
          ? `/api/files/report_photos/${p2.id}/${img2}`
          : 'https://img.usecurling.com/p/640/420?q=monitoring%20well'

        img2Block = `<td style="width:50%;padding:4px;text-align:center;border:none;vertical-align:top;">
          <img src="${src2}" style="width:100%;max-height:360px;object-fit:cover;border:1px solid #000;display:block;" alt="Foto ${idx2}" />
        </td>`

        const str1 = String(idx1).padStart(2, '0')
        const str2 = String(idx2).padStart(2, '0')
        defaultCaption = `Fotos ${str1} e ${str2} – ${p1.getString('caption') || p2.getString('caption') || 'Tamponamento do poço.'}`
      } else {
        const str1 = String(idx1).padStart(2, '0')
        defaultCaption = `Foto ${str1} – ${p1.getString('caption') || 'Tamponamento do poço.'}`
      }

      const isFirst = pairIdx === 0
      photoPagesHtml.push(`
        <div class="rdo-page">
          ${pageHeaderHtml}
          <div class="rdo-page-content">
            ${isFirst ? `<div style="font-size:11px;font-weight:normal;margin-bottom:8px;text-align:center;">As fotos 01 a ${String(generalPhotos.length).padStart(2, '0')} evidenciam os trabalhos executados.</div>` : ''}
            <div class="photo-pair-block">
              <table style="width:100%;border-collapse:collapse;border:none;">
                <tr>
                  <td style="width:50%;padding:4px;text-align:center;border:none;vertical-align:top;">
                    <img src="${src1}" style="width:100%;max-height:360px;object-fit:cover;border:1px solid #000;display:block;" alt="Foto ${idx1}" />
                  </td>
                  ${img2Block}
                </tr>
              </table>
              <div class="photo-caption-box">
                ${defaultCaption}
              </div>
            </div>
          </div>
          ${pageFooterHtml}
        </div>
      `)
    })
  }

  const html = `<!doctype html>
  <html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <title>${rdoNumStr}</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 0;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000000;
        font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
        font-size: 11px;
        line-height: 1.35;
      }

      /* Folha da página formatada em A4 com margens internas */
      .rdo-page {
        width: 210mm;
        min-height: 297mm;
        height: 297mm;
        padding: 14mm 15mm 14mm 15mm;
        margin: 0 auto;
        position: relative;
        background: #ffffff;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        page-break-after: always;
        break-after: page;
        box-sizing: border-box;
      }

      .rdo-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }

      .rdo-page-header {
        width: 100%;
        margin-bottom: 8px;
      }

      /* Logo + Título no Topo */
      .logo-title-box {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        border: 1px solid #000000;
        padding: 6px 12px;
        margin-bottom: -1px;
        background: #ffffff;
      }
      .logo-cell {
        flex: 0 0 160px;
        display: flex;
        align-items: center;
        justify-content: flex-start;
      }
      .epa-logo-img {
        height: 44px;
        max-width: 155px;
        object-fit: contain;
        display: block;
      }
      .title-cell {
        flex: 1;
        text-align: center;
        font-size: 13px;
        font-weight: bold;
        color: #000000;
        padding-right: 20px;
        letter-spacing: 0.1px;
      }

      /* Tabela de Metadados / Cabeçalho */
      .header-meta-table {
        width: 100%;
        border-collapse: collapse;
        margin: 0;
      }
      .header-meta-table td {
        border: 1px solid #000000;
        padding: 4.5px 7px;
        font-size: 11px;
        color: #000000;
        vertical-align: middle;
      }
      .header-meta-table td b {
        font-weight: bold;
        color: #000000;
      }

      /* Conteúdo Principal da Página */
      .rdo-page-content {
        flex: 1;
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      }

      /* Faixas Oficiais EPA */
      .official-banner {
        border: 1px solid #000000;
        text-align: center;
        font-weight: bold;
        font-size: 11px;
        text-transform: uppercase;
        padding: 3.5px 6px;
        background: #ffffff;
        color: #000000;
        letter-spacing: 0.5px;
        margin-top: 10px;
      }
      .official-box {
        border: 1px solid #000000;
        border-top: none;
        padding: 6px 8px;
        min-height: 22px;
        font-size: 11px;
        color: #000000;
        background: #ffffff;
        line-height: 1.35;
      }

      /* Tabela de Poços */
      table.wells-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 6px;
      }
      table.wells-table th {
        background: #ffffff;
        color: #000000;
        border: 1px solid #000000;
        padding: 4.5px 6px;
        font-size: 10px;
        font-weight: bold;
        text-align: center;
        line-height: 1.2;
      }
      table.wells-table td {
        border: 1px solid #000000;
        padding: 3.5px 6px;
        font-size: 10px;
        color: #000000;
      }

      /* Fotos e Legendas */
      .photo-pair-block {
        width: 100%;
        margin-top: 10px;
      }
      .photo-caption-box {
        border: 1px solid #000000;
        text-align: center;
        font-size: 10px;
        padding: 5px 8px;
        margin-top: 4px;
        background: #ffffff;
        font-weight: bold;
        color: #000000;
      }

      /* Seções de Controle / Observações Técnicas */
      .control-section-item {
        margin-top: 8px;
      }
      .control-section-item:first-child {
        margin-top: 0;
      }

      /* Rodapé da Página */
      .rdo-page-footer {
        width: 100%;
        margin-top: auto;
        padding-top: 8px;
      }
      .footer-line {
        border-top: 1px solid #000000;
        width: 100%;
        margin-bottom: 5px;
      }
      .footer-text {
        font-size: 11px;
        font-weight: bold;
        color: #000000;
        text-align: left;
      }

      @media screen {
        body {
          background: #e2e8f0;
          padding: 20px 0;
        }
        .rdo-page {
          box-shadow: 0 4px 14px rgba(0,0,0,0.18);
          margin-bottom: 24px;
        }
      }
    </style>
  </head>
  <body>

    <!-- PÁGINA 1: ATIVIDADE E DESCRIÇÃO COM FIGURA -->
    <div class="rdo-page">
      ${pageHeaderHtml}
      <div class="rdo-page-content">
        <div class="official-banner" style="margin-top:0;">ATIVIDADE</div>
        <div class="official-box">${activityTitleVal}</div>

        <div class="official-banner">DESCRIÇÃO DA ATIVIDADE</div>
        <div class="official-box">
          <div style="white-space:pre-wrap;">${rdo.getString('activity_description') || 'No dia de hoje, a equipe da EPA Engenharia realizou atividades de tamponamento na área.'}</div>
          ${fieldPhotoHtml}
        </div>
      </div>
      ${pageFooterHtml}
    </div>

    <!-- PÁGINA 2: TABELA DE POÇOS PARTE 1 -->
    <div class="rdo-page">
      ${pageHeaderHtml}
      <div class="rdo-page-content">
        <table class="wells-table">
          <thead>
            <tr>
              <th style="width:25%;">Identificação<br />do Poço</th>
              <th style="width:25%;">Profundidade</th>
              <th style="width:25%;">Data de<br />finalização</th>
              <th style="width:25%;">Diâmetro do<br />Poço (pol.)</th>
            </tr>
          </thead>
          <tbody>
            ${renderWellsRows(wellsPage1)}
          </tbody>
        </table>
      </div>
      ${pageFooterHtml}
    </div>

    ${
      wellsPage2.length > 0
        ? `
    <!-- PÁGINA 3: TABELA DE POÇOS PARTE 2 -->
    <div class="rdo-page">
      ${pageHeaderHtml}
      <div class="rdo-page-content">
        <table class="wells-table">
          <thead>
            <tr>
              <th style="width:25%;">Identificação<br />do Poço</th>
              <th style="width:25%;">Profundidade</th>
              <th style="width:25%;">Data de<br />finalização</th>
              <th style="width:25%;">Diâmetro do<br />Poço (pol.)</th>
            </tr>
          </thead>
          <tbody>
            ${renderWellsRows(wellsPage2)}
          </tbody>
        </table>
      </div>
      ${pageFooterHtml}
    </div>
    `
        : ''
    }

    <!-- PÁGINAS FOTOGRÁFICAS -->
    ${photoPagesHtml.join('\n')}

    <!-- PÁGINA FINAL: CONTROLE OPERACIONAL / OBSERVAÇÕES -->
    <div class="rdo-page">
      ${pageHeaderHtml}
      <div class="rdo-page-content">
        <div class="control-section-item">
          <div class="official-banner" style="margin-top:0;">Tempo em deslocamento de máquinas e equipamentos</div>
          <div class="official-box">${rdo.getString('time_displacement') || 'N.A'}</div>
        </div>

        <div class="control-section-item">
          <div class="official-banner">Tempo aguardando liberação (externa)</div>
          <div class="official-box">${rdo.getString('time_waiting') || 'N.A'}</div>
        </div>

        <div class="control-section-item">
          <div class="official-banner">Interferências/Dificuldades</div>
          <div class="official-box">${rdo.getString('interferences') || 'Sem interferências ou dificuldades.'}</div>
        </div>

        <div class="control-section-item">
          <div class="official-banner">Mudanças no Plano de Trabalho</div>
          <div class="official-box">${rdo.getString('plan_changes') || 'Sem mudanças no Plano de Trabalho.'}</div>
        </div>

        <div class="control-section-item">
          <div class="official-banner">Acidentes/Incidentes</div>
          <div class="official-box">${rdo.getString('accidents') || 'Sem acidentes e/ou incidentes.'}</div>
        </div>

        <div style="display:flex;justify-content:space-between;margin-top:40px;gap:40px;">
          <div style="flex:1;text-align:center;border-top:1px solid #000;padding-top:6px;font-size:10px;">
            <b>${performer.getString('name')}</b><br />
            Realizado por
          </div>
          <div style="flex:1;text-align:center;border-top:1px solid #000;padding-top:6px;font-size:10px;">
            <b>${supervisorName}</b><br />
            Supervisionado por
          </div>
        </div>
      </div>
      ${pageFooterHtml}
    </div>

  </body>
  </html>`

  return c.html(200, html)
})
