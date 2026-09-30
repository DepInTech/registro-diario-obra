import { EPA_LOGO_BASE64 } from '@/assets/epaLogoBase64'
import { NaSheet, NaWellReadingRow } from '@/types/inSituAndNa'

/**
 * Divide a lista de poços em 4 colunas verticais (blocos)
 * Preenche de cima a baixo bloco 1, depois bloco 2, 3, 4.
 */
export function chunkInto4Columns<T>(items: T[]): T[][] {
  const total = items.length
  if (total === 0) return [[], [], [], []]

  const numCols = 4
  const baseRows = Math.floor(total / numCols)
  const remainder = total % numCols

  const cols: T[][] = []
  let currentIndex = 0

  for (let c = 0; c < numCols; c++) {
    const colSize = baseRows + (c < remainder ? 1 : 0)
    cols.push(items.slice(currentIndex, currentIndex + colSize))
    currentIndex += colSize
  }

  return cols
}

/**
 * Converte 4 colunas em linhas alinhadas para renderização matricial (máximo de linhas entre as 4)
 */
export function get4ColumnRows(
  readings: NaWellReadingRow[],
): Array<Array<NaWellReadingRow | null>> {
  const cols = chunkInto4Columns(readings)
  const maxRows = Math.max(...cols.map((col) => col.length), 0)
  const rows: Array<Array<NaWellReadingRow | null>> = []

  for (let r = 0; r < maxRows; r++) {
    rows.push([cols[0][r] || null, cols[1][r] || null, cols[2][r] || null, cols[3][r] || null])
  }

  return rows
}

/**
 * Gera o documento de impressão/PDF da Planilha de Monitoramento de Nível d'Água (NA)
 * Fiel ao layout físico da planilha XLSX:
 * - Cabeçalho com CONTRATO, Nº do contrato, Local/Área, Título e Subtítulo
 * - Linha de DATA: e Clima:
 * - 4 blocos de colunas (Poço | NA (m) | NO (m) | Obs.) lado a lado
 * - Linha ampla de Observações no rodapé
 */
export function printNaSheet(sheet: NaSheet): void {
  const win = window.open('', '_blank', 'width=1024,height=800')
  if (!win) {
    alert('Permita pop-ups no navegador para visualizar a impressão / exportar o PDF.')
    return
  }

  const rows = get4ColumnRows(sheet.readings || [])
  const maxDisplayRows = Math.max(rows.length, 18) // Garante linhas suficientes para preencher folha física como no modelo

  // Preenche até maxDisplayRows se necessário
  const displayRows: Array<Array<NaWellReadingRow | null>> = []
  for (let i = 0; i < maxDisplayRows; i++) {
    if (i < rows.length) {
      displayRows.push(rows[i])
    } else {
      displayRows.push([null, null, null, null])
    }
  }

  const tableRowsHtml = displayRows
    .map((row) => {
      const cellsHtml = [0, 1, 2, 3]
        .map((colIdx) => {
          const item = row[colIdx]
          const well = item?.well_code || '&nbsp;'
          const na = item?.na_m || '&nbsp;'
          const no = item?.no_m || '&nbsp;'
          const obs = item?.observation || '&nbsp;'
          return `
            <td class="col-poco">${well}</td>
            <td class="col-num">${na}</td>
            <td class="col-num">${no}</td>
            <td class="col-obs">${obs}</td>
          `
        })
        .join('')
      return `<tr>${cellsHtml}</tr>`
    })
    .join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Planilha de Campo - Monitoramento do Nível d'Água - ${sheet.area_name || 'NA'}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 8mm 10mm 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 0;
      color: #000;
      background: #fff;
      font-size: 9pt;
      line-height: 1.2;
    }
    .sheet-container {
      width: 100%;
      max-width: 190mm;
      margin: 0 auto;
    }

    /* Cabeçalho Fiel à Planilha de NA */
    .header-box {
      border: 1.5px solid #000;
      margin-bottom: 2px;
    }
    .header-row {
      display: flex;
      align-items: center;
      border-bottom: 1px solid #000;
    }
    .header-row:last-child {
      border-bottom: none;
    }
    .header-logo-cell {
      width: 130px;
      padding: 6px;
      border-right: 1px solid #000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .header-logo-cell img {
      max-height: 48px;
      max-width: 110px;
      object-fit: contain;
    }
    .header-meta-cell {
      flex: 1;
      padding: 0;
    }
    .meta-line {
      padding: 3px 8px;
      font-size: 8.5pt;
      border-bottom: 1px solid #000;
      display: flex;
      align-items: center;
    }
    .meta-line:last-child {
      border-bottom: none;
    }
    .meta-label {
      font-weight: bold;
      margin-right: 6px;
    }
    .title-banner {
      background-color: #dbeafe;
      border-bottom: 1px solid #000;
      padding: 5px 8px;
      text-align: center;
    }
    .title-banner h1 {
      margin: 0;
      font-size: 11pt;
      font-weight: bold;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #000;
    }
    .title-banner h2 {
      margin: 2px 0 0 0;
      font-size: 9.5pt;
      font-weight: 600;
      color: #1e3a8a;
    }

    /* Linha Data e Clima */
    .data-clima-bar {
      display: flex;
      border: 1.5px solid #000;
      border-top: none;
      background-color: #f1f5f9;
      font-size: 9pt;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .data-box {
      flex: 1;
      padding: 4px 8px;
      border-right: 1.5px solid #000;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .clima-box {
      width: 200px;
      padding: 4px 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .resp-box {
      width: 220px;
      padding: 4px 8px;
      border-left: 1.5px solid #000;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Tabela de 4 blocos de poços */
    table.na-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
      margin-bottom: 4px;
      table-layout: fixed;
    }
    table.na-table th, table.na-table td {
      border: 1px solid #000;
      padding: 2.5px 3px;
      font-size: 8pt;
      height: 18px;
      vertical-align: middle;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    table.na-table th {
      background-color: #cbd5e1;
      font-weight: bold;
      text-align: center;
    }
    /* Estilo de largura das colunas por bloco (4 blocos idênticos = 25% da largura cada) */
    .col-poco {
      width: 8.5%;
      font-weight: bold;
      text-align: center;
      background-color: #f8fafc;
    }
    .col-num {
      width: 5.5%;
      text-align: right;
      padding-right: 4px;
    }
    .col-obs {
      width: 11%;
      text-align: left;
    }

    /* Rodapé de Observações */
    .obs-footer {
      border: 1.5px solid #000;
      padding: 6px 8px;
      min-height: 55px;
      font-size: 8.5pt;
      background-color: #fafafa;
    }
    .obs-footer-label {
      font-weight: bold;
      margin-bottom: 3px;
      text-transform: uppercase;
      font-size: 8pt;
      color: #333;
    }
    .obs-footer-content {
      white-space: pre-wrap;
      font-family: inherit;
    }

    .no-print-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #1e293b;
      color: #fff;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }
    .no-print-bar button {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
    }
    .no-print-bar button:hover {
      background: #1d4ed8;
    }
    @media print {
      .no-print-bar { display: none !important; }
      body { padding: 0 !important; }
    }
    @media screen {
      body {
        padding-top: 60px;
        background: #e2e8f0;
        display: flex;
        justify-content: center;
      }
      .sheet-container {
        background: #fff;
        padding: 8mm;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div><strong>Grupo EPA — Visualização e Impressão de Planilha</strong> (Monitoramento do Nível d'Água)</div>
    <div>
      <button onclick="window.print()">Imprimir / Salvar PDF</button>
    </div>
  </div>

  <div class="sheet-container">
    <!-- Cabeçalho -->
    <div class="header-box">
      <div class="header-row">
        <div class="header-logo-cell">
          <img src="${EPA_LOGO_BASE64}" alt="Grupo EPA" />
        </div>
        <div class="header-meta-cell">
          <div class="meta-line">
            <span class="meta-label">CONTRATO:</span>
            <span>${sheet.contract_number ? sheet.contract_number : sheet.area_name ? `Contrato ref. ${sheet.area_name}` : '—'}</span>
          </div>
          <div class="meta-line">
            <span class="meta-label">LOCAL / ÁREA:</span>
            <span>${sheet.area_name || '—'}</span>
          </div>
        </div>
      </div>
      <div class="title-banner">
        <h1>PLANILHA DIÁRIA DE CAMPO</h1>
        <h2>Monitoramento do Nível d'Água</h2>
      </div>
    </div>

    <!-- Linha DATA / Clima / Responsável -->
    <div class="data-clima-bar">
      <div class="data-box">
        <span>DATA:</span>
        <span style="font-weight: normal; font-size: 9.5pt;">${sheet.date || '___/___/______'}</span>
      </div>
      <div class="clima-box">
        <span>Clima:</span>
        <span style="font-weight: normal;">${sheet.weather || '—'}</span>
      </div>
      <div class="resp-box">
        <span>Responsável:</span>
        <span style="font-weight: normal;">${sheet.responsible_name || '—'}</span>
      </div>
    </div>

    <!-- Tabela 4 Blocos Lado a Lado -->
    <table class="na-table">
      <thead>
        <tr>
          <!-- Bloco 1 -->
          <th style="width: 8.5%;">Poço</th>
          <th style="width: 5.5%;">NA (m)</th>
          <th style="width: 5.5%;">NO (m)</th>
          <th style="width: 11%;">Obs.</th>
          <!-- Bloco 2 -->
          <th style="width: 8.5%;">Poço</th>
          <th style="width: 5.5%;">NA (m)</th>
          <th style="width: 5.5%;">NO (m)</th>
          <th style="width: 11%;">Obs.</th>
          <!-- Bloco 3 -->
          <th style="width: 8.5%;">Poço</th>
          <th style="width: 5.5%;">NA (m)</th>
          <th style="width: 5.5%;">NO (m)</th>
          <th style="width: 11%;">Obs.</th>
          <!-- Bloco 4 -->
          <th style="width: 8.5%;">Poço</th>
          <th style="width: 5.5%;">NA (m)</th>
          <th style="width: 5.5%;">NO (m)</th>
          <th style="width: 11%;">Obs.</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>

    <!-- Rodapé: Observações -->
    <div class="obs-footer">
      <div class="obs-footer-label">Observações:</div>
      <div class="obs-footer-content">${sheet.notes ? sheet.notes.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Nenhuma observação registrada.'}</div>
    </div>
  </div>

  <script>
    // Foco e atalho
    window.onload = function() {
      // Aberto para conferência
    };
  </script>
</body>
</html>`

  win.document.open()
  win.document.write(html)
  win.document.close()
}
