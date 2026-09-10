/// <reference path="../pb_data/types.d.ts" />

routerAdd('GET', '/backend/v1/epa/export/rdo/{id}', (c) => {
  const auth = c.get('authRecord')
  if (!auth) {
    return c.json(401, { error: 'Não autenticado' })
  }
  const role = auth.getString('role')
  if (role !== 'admin' && role !== 'operator') {
    return c.json(403, { error: 'Exportação permitida apenas para Administradores e Operadores' })
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

  // Wells
  const wells = $app.findRecordsByFilter('report_wells', `report = "${id}"`, 'created')
  let wellsHtml = ''
  if (wells.length > 0) {
    wells.forEach((w) => {
      wellsHtml += `<tr>
        <td style="border:1px solid #000;padding:5px 6px;font-weight:600;text-align:center;">${w.getString('well_id') || '—'}</td>
        <td style="border:1px solid #000;padding:5px 6px;text-align:center;">${w.getFloat('depth') ? w.getFloat('depth') + ' m' : '—'}</td>
        <td style="border:1px solid #000;padding:5px 6px;text-align:center;">${w.getString('completion_date') ? w.getString('completion_date').slice(0, 10) : '—'}</td>
        <td style="border:1px solid #000;padding:5px 6px;text-align:center;">${w.getString('diameter') || '—'}</td>
      </tr>`
    })
  } else {
    wellsHtml = `<tr><td colspan="4" style="border:1px solid #000;padding:8px;text-align:center;">Nenhum poço registrado.</td></tr>`
  }

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
  const rdoNumStr = `RDO ${String(rdoNumber).padStart(2, '0')} – ${project.getString('location') || ''}`

  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>RDO Nº ${rdoNumber} — EPA Gestão</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 22mm 15mm 20mm 15mm;
        @top-center {
          content: element(docHeader);
        }
        @bottom-center {
          content: element(docFooter);
        }
      }
      @page :left {
        @top-center { content: element(docHeader); }
        @bottom-center { content: element(docFooter); }
      }
      @page :right {
        @top-center { content: element(docHeader); }
        @bottom-center { content: element(docFooter); }
      }
      * { box-sizing: border-box; }
      body {
        font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
        font-size: 11px;
        color: #000000;
        margin: 0;
        padding: 0;
        background: #fff;
        line-height: 1.35;
      }

      /* Running Header strictly printed on top of every page */
      .doc-header-running {
        position: fixed;
        top: -19mm;
        left: 0;
        right: 0;
        height: 18mm;
        border: 1px solid #000;
        display: flex;
        align-items: center;
        background: #fff;
        padding: 0 10px;
      }
      .doc-header-running table {
        width: 100%;
        border-collapse: collapse;
        border: none;
      }
      .doc-header-running td {
        border: none;
        padding: 0;
        vertical-align: middle;
      }
      .doc-header-running .header-logo {
        height: 48px;
        max-width: 170px;
        object-fit: contain;
        display: block;
      }
      .doc-header-running .header-text {
        text-align: center;
        font-size: 12.5px;
        font-weight: bold;
        color: #000;
        letter-spacing: 0.2px;
      }

      /* Running Footer strictly printed on bottom of every page */
      .doc-footer-running {
        position: fixed;
        bottom: -15mm;
        left: 0;
        right: 0;
        height: 12mm;
        border-top: 1px solid #000;
        padding-top: 6px;
        font-size: 11px;
        font-weight: bold;
        color: #000;
        background: #fff;
      }

      /* Tabela de Metadados / Cabeçalho */
      .header-meta-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 0;
        margin-bottom: 12px;
      }
      .header-meta-table td {
        border: 1px solid #000;
        padding: 4.5px 7px;
        font-size: 11px;
        color: #000;
        vertical-align: middle;
      }
      .header-meta-table td b {
        font-weight: bold;
        color: #000;
      }

      /* Faixas Oficiais EPA */
      .official-banner {
        border: 1px solid #000;
        text-align: center;
        font-weight: bold;
        font-size: 11px;
        text-transform: uppercase;
        padding: 3.5px 6px;
        background: #fff;
        color: #000;
        letter-spacing: 0.5px;
      }
      .official-box {
        border: 1px solid #000;
        border-top: none;
        padding: 7px 9px;
        min-height: 24px;
        font-size: 11px;
        color: #000;
        background: #fff;
        line-height: 1.4;
      }

      /* Tabela de Poços */
      table.wells-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 0;
      }
      table.wells-table th {
        background: #fff;
        color: #000;
        border: 1px solid #000;
        padding: 5px 6px;
        font-size: 10px;
        font-weight: bold;
        text-align: center;
        line-height: 1.25;
      }
      table.wells-table td {
        border: 1px solid #000;
        padding: 5px 6px;
        font-size: 10.5px;
        color: #000;
      }

      /* Bloco das seções de controle / observações técnicas */
      .control-section-item {
        margin-top: 10px;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      /* Quebras e páginas */
      .page-break {
        page-break-before: always;
        break-before: page;
      }
      .keep-together {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      @media screen {
        body {
          padding: 24px;
          background: #f1f5f9;
        }
        .screen-container {
          max-width: 800px;
          margin: 0 auto;
          background: #fff;
          padding: 32px 36px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.1);
        }
        .doc-header-running {
          position: static;
          margin-bottom: 0;
        }
        .doc-footer-running {
          position: static;
          margin-top: 24px;
        }
      }
    </style>
  </head>
  <body>
    <!-- Running Header em todas as páginas -->
    <div class="doc-header-running">
      <table>
        <tr>
          <td style="width:180px;text-align:left;">
            <img src="${logoSrc}" class="header-logo" alt="Grupo EPA" />
          </td>
          <td class="header-text">
            Relatório Diário de Acompanhamento de Obras
          </td>
        </tr>
      </table>
    </div>

    <!-- Running Footer em todas as páginas -->
    <div class="doc-footer-running">
      ${rdoNumStr}
    </div>

    <div class="screen-container">
      <!-- CABEÇALHO OFICIAL DE METADADOS -->
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

      <!-- FAIXA ATIVIDADE -->
      <div class="official-banner">ATIVIDADE</div>
      <div class="official-box">${rdo.getString('activity_title') || '—'}</div>

      <!-- FAIXA DESCRIÇÃO DA ATIVIDADE -->
      <div class="official-banner" style="margin-top:10px;">DESCRIÇÃO DA ATIVIDADE</div>
      <div class="official-box">
        ${rdo.getString('activity_description') ? `<div style="white-space:pre-wrap;">${rdo.getString('activity_description')}</div>` : ''}
        ${fieldPhotoHtml}
      </div>

      <!-- QUEBRA PARA TABELA DE POÇOS CONFORME MODELO OFICIAL -->
      <div class="page-break"></div>

      <!-- TABELA DE POÇOS -->
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
          ${wellsHtml}
        </tbody>
      </table>

      <!-- SEÇÃO FOTOGRÁFICA -->
      <div class="page-break"></div>
      <div style="font-size:11px;font-weight:bold;margin-bottom:8px;text-align:center;">
        As fotos evidenciam os trabalhos executados.
      </div>
      <div>
        ${photoCards}
      </div>

      <!-- SEÇÃO FINAL: OBSERVAÇÕES E CONTROLE OPERACIONAL -->
      <div class="page-break"></div>

      <div class="control-section-item">
        <div class="official-banner">Tempo em deslocamento de máquinas e equipamentos</div>
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

      <div class="keep-together" style="display:flex;justify-content:space-between;margin-top:36px;gap:40px;">
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
  </body>
  </html>`

  return c.html(200, html)
})
