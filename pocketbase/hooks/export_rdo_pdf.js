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
        <td style="border:1px solid #9ca3af;padding:6px;font-weight:600;">${w.getString('well_id')}</td>
        <td style="border:1px solid #9ca3af;padding:6px;">${w.getFloat('depth') ? w.getFloat('depth') + ' m' : '—'}</td>
        <td style="border:1px solid #9ca3af;padding:6px;">${w.getString('completion_date') ? w.getString('completion_date').slice(0, 10) : '—'}</td>
        <td style="border:1px solid #9ca3af;padding:6px;">${w.getString('diameter') || '—'}</td>
      </tr>`
    })
  } else {
    wellsHtml = `<tr><td colspan="4" style="border:1px solid #9ca3af;padding:8px;text-align:center;">Nenhum poço registrado.</td></tr>`
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
    fieldPhotoHtml = `
    <div style="border:1px solid #9ca3af;border-top:none;padding:8px;background:#f9fafb;break-inside:avoid;">
      <b style="font-size:9px;text-transform:uppercase;color:#086B63;display:block;margin-bottom:6px;">Fotografia do Campo / Local das Inspeções:</b>
      <div style="display:flex;gap:12px;align-items:flex-start;">
        <img src="${fieldSrc}" style="width:240px;height:150px;object-fit:cover;border:1px solid #9ca3af;border-radius:4px;flex-shrink:0;" />
        <div style="font-size:10px;color:#374151;line-height:1.4;">
          <b>Legenda / Identificação do Local:</b><br />
          ${fieldPhotoRecord.getString('caption') || 'Registro fotográfico do local onde foram realizadas as inspeções.'}
        </div>
      </div>
    </div>`
  }

  if (generalPhotos.length > 0) {
    generalPhotos.forEach((p, idx) => {
      const imgFile = p.getString('image')
      const imgSrc = imgFile
        ? `/api/files/report_photos/${p.id}/${imgFile}`
        : 'https://img.usecurling.com/p/640/420?q=monitoring%20well'

      photoCards += `<figure style="border:1px solid #9ca3af;padding:6px;margin:0;break-inside:avoid;page-break-inside:avoid;">
        <img src="${imgSrc}" style="width:100%;height:180px;object-fit:cover;display:block;" />
        <figcaption style="padding:6px;text-align:center;font-size:10px;font-weight:500;">
          <b>Foto ${idx + 1}:</b> ${p.getString('caption') || 'Registro fotográfico'}
        </figcaption>
      </figure>`
    })
  } else {
    photoCards = `<p style="border:1px solid #9ca3af;padding:12px;text-align:center;font-size:11px;grid-column:1/-1;">Sem registros fotográficos adicionados.</p>`
  }

  const logoUrl = '/og-image.png'

  const dateStr = rdo.getString('report_date') ? rdo.getString('report_date').slice(0, 10) : '—'

  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>RDO Nº ${rdo.getInt('number')} — EPA Gestão</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 26mm 14mm 16mm 14mm;
        @top-center {
          content: element(pageHeader);
        }
      }
      * { box-sizing: border-box; }
      body {
        font-family: Arial, sans-serif;
        font-size: 11px;
        color: #1f2937;
        margin: 0;
        padding: 0;
      }
      .page-header {
        position: fixed;
        top: -22mm;
        left: 0;
        right: 0;
        height: 18mm;
        border-bottom: 2px solid #086B63;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .page-header img {
        height: 44px;
        max-width: 170px;
        object-fit: contain;
      }
      .page-header .doc-id {
        text-align: right;
        font-size: 9px;
        color: #086B63;
        font-weight: bold;
      }
      .main-title {
        background: #086B63;
        color: #ffffff;
        text-align: center;
        padding: 8px;
        font-size: 14px;
        font-weight: bold;
        letter-spacing: 0.5px;
        margin: 0 0 8px 0;
      }
      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
      .grid-cell {
        border: 1px solid #9ca3af;
        padding: 6px;
        min-height: 32px;
      }
      .grid-cell b {
        display: block;
        font-size: 8px;
        text-transform: uppercase;
        color: #086B63;
        margin-bottom: 2px;
      }
      .section-block {
        margin-top: 8px;
        break-inside: avoid;
      }
      .section-block h3 {
        margin: 0;
        background: #e6f5f3;
        color: #086B63;
        border: 1px solid #8cb8b3;
        padding: 5px 8px;
        font-size: 10px;
        text-transform: uppercase;
      }
      .text-box {
        border: 1px solid #9ca3af;
        border-top: none;
        padding: 8px;
        min-height: 44px;
        white-space: pre-wrap;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th {
        background: #e6f5f3;
        color: #086B63;
        border: 1px solid #9ca3af;
        padding: 6px;
        font-size: 9px;
        text-transform: uppercase;
      }
      .photos-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        border: 1px solid #9ca3af;
        border-top: none;
        padding: 8px;
      }
      .signatures {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 40px;
        margin-top: 30px;
        break-inside: avoid;
      }
      .sign-box {
        text-align: center;
        border-top: 1px solid #374151;
        padding-top: 6px;
        font-size: 10px;
      }
    </style>
  </head>
  <body>
    <div class="page-header">
      <img src="${logoUrl}" alt="EPA Logo" />
      <div class="doc-id">
        RELATÓRIO DIÁRIO DE OBRA<br />
        RDO Nº ${String(rdo.getInt('number')).padStart(3, '0')}
      </div>
    </div>

    <h1 class="main-title">RELATÓRIO DIÁRIO DE ACOMPANHAMENTO DE OBRAS</h1>

    <div class="grid-2">
      <div class="grid-cell"><b>Cliente</b>${client.getString('name')}</div>
      <div class="grid-cell"><b>Contrato</b>${contract.getString('code')}</div>
      <div class="grid-cell"><b>Local</b>${project.getString('location')}</div>
      <div class="grid-cell"><b>Projeto EPA</b>${project.getString('name')}</div>
      <div class="grid-cell"><b>Empresa Executora</b>${company.getString('name')}</div>
      <div class="grid-cell"><b>Data / Clima</b>${dateStr} · ${rdo.getString('weather')}</div>
      <div class="grid-cell"><b>Realizado por</b>${performer.getString('name')}</div>
      <div class="grid-cell"><b>Supervisionado por</b>${supervisorName}</div>
    </div>

    <div class="section-block">
      <h3>Atividade</h3>
      <div class="text-box">${rdo.getString('activity_title') || '—'}</div>
    </div>

    <div class="section-block">
      <h3>Descrição da Atividade & Foto do Campo</h3>
      <div class="text-box">${rdo.getString('activity_description') || '—'}</div>
      ${fieldPhotoHtml}
    </div>

    <div class="section-block">
      <h3>Tabela de Poços</h3>
      <table>
        <thead>
          <tr>
            <th>ID do Poço</th>
            <th>Profundidade</th>
            <th>Data Conclusão</th>
            <th>Diâmetro</th>
          </tr>
        </thead>
        <tbody>
          ${wellsHtml}
        </tbody>
      </table>
    </div>

    <div class="section-block">
      <h3>Registro Fotográfico</h3>
      <div class="photos-grid">
        ${photoCards}
      </div>
    </div>

    <div class="section-block">
      <h3>Observações Técnicas & Controle</h3>
      <table>
        <tr>
          <th style="width:35%;">Acidentes / Incidentes</th>
          <td style="border:1px solid #9ca3af;padding:6px;">${rdo.getString('accidents') || 'Não houve'}</td>
        </tr>
        <tr>
          <th>Interferências / Dificuldades</th>
          <td style="border:1px solid #9ca3af;padding:6px;">${rdo.getString('interferences') || 'Não houve'}</td>
        </tr>
        <tr>
          <th>Mudanças no Plano de Trabalho</th>
          <td style="border:1px solid #9ca3af;padding:6px;">${rdo.getString('plan_changes') || 'Não houve'}</td>
        </tr>
        <tr>
          <th>Tempo de Espera / Deslocamento</th>
          <td style="border:1px solid #9ca3af;padding:6px;">${rdo.getString('time_waiting') || 'Sem ocorrências'} · ${rdo.getString('time_displacement') || '01h20'}</td>
        </tr>
      </table>
    </div>

    <div class="signatures">
      <div class="sign-box">
        <b>${performer.getString('name')}</b><br />
        Execução em Campo
      </div>
      <div class="sign-box">
        <b>${supervisorName}</b><br />
        Supervisão Técnica
      </div>
    </div>
  </body>
  </html>`

  return c.html(200, html)
})
