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
  // O modelo Excel original possui 31 linhas de medição (linhas 8 a 38)
  const maxDisplayRows = Math.max(rows.length, 31)

  // Preenche até maxDisplayRows se necessário
  const displayRows: Array<Array<NaWellReadingRow | null>> = []
  for (let i = 0; i < maxDisplayRows; i++) {
    if (i < rows.length) {
      displayRows.push(rows[i])
    } else {
      displayRows.push([null, null, null, null])
    }
  }

  const escapeHtml = (text?: string) =>
    (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

  const tableRowsHtml = displayRows
    .map((row) => {
      const cellsHtml = [0, 1, 2, 3]
        .map((colIdx) => {
          const item = row[colIdx]
          const well = item?.well_code ? escapeHtml(item.well_code) : '&nbsp;'
          const na = item?.na_m ? escapeHtml(item.na_m) : '&nbsp;'
          const no = item?.no_m ? escapeHtml(item.no_m) : '&nbsp;'
          const obs = item?.observation ? escapeHtml(item.observation) : '&nbsp;'
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

  const contractDisplay = sheet.contract_number ? escapeHtml(sheet.contract_number) : '—'
  const areaDisplay = sheet.area_name ? escapeHtml(sheet.area_name) : '—'
  const dateDisplay = sheet.date ? escapeHtml(sheet.date) : '___/___/______'
  const weatherDisplay = sheet.weather ? escapeHtml(sheet.weather) : '—'
  const notesDisplay = sheet.notes ? escapeHtml(sheet.notes).replace(/\n/g, '<br/>') : ''

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Planilha NA Semanal - ${sheet.area_name || 'Monitoramento'}</title>
<style>
  @page {
    size: A4 portrait;
    margin: 8mm 6mm 8mm 6mm;
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
    font-size: 8.5pt;
    line-height: 1.15;
  }
  .sheet-wrapper {
    width: 100%;
    max-width: 198mm;
    margin: 0 auto;
  }

  /* Tabela da Planilha Completa - Fiel à grade do Excel */
  table.excel-sheet {
    width: 100%;
    border-collapse: collapse;
    border: 1.5px solid #000;
    table-layout: fixed;
  }

  table.excel-sheet td, table.excel-sheet th {
    border: 1px solid #777;
    padding: 2px 4px;
    font-size: 8pt;
    vertical-align: middle;
    height: 19px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Linhas do Cabeçalho Excel */
  .hdr-contrato-title {
    font-weight: bold;
    font-size: 8.5pt;
    background: #fff;
    text-align: left;
    border-bottom: 1px solid #777 !important;
  }
  .hdr-contrato-val {
    font-weight: bold;
    font-size: 9pt;
    background: #fff;
    text-align: left;
    border-bottom: 1px solid #777 !important;
  }
  .hdr-local {
    font-weight: bold;
    font-size: 9pt;
    background: #fff;
    text-align: left;
    border-bottom: 1px solid #777 !important;
  }
  .hdr-title-diaria {
    font-weight: bold;
    font-size: 10pt;
    background: #fff;
    text-align: left;
    text-transform: uppercase;
    border-bottom: 1px solid #777 !important;
  }
  .hdr-subtitle-na {
    font-weight: bold;
    font-size: 9.5pt;
    background: #fff;
    text-align: left;
    border-bottom: 1.5px solid #000 !important;
  }

  /* Linha Data / Clima */
  .hdr-data-cell {
    background: #fff;
    border-bottom: 1.5px solid #000 !important;
  }
  .hdr-clima-cell {
    background: #fff;
    border-bottom: 1.5px solid #000 !important;
    text-align: left;
  }

  /* Cabeçalhos dos 4 Blocos: Poço | NA (m) | NO (m) | Obs. */
  .col-hdr {
    background-color: #f1f5f9;
    font-weight: bold;
    text-align: center;
    border-top: 1.5px solid #000 !important;
    border-bottom: 1.5px solid #000 !important;
    font-size: 8pt;
  }

  .col-poco {
    width: 7%;
    font-weight: bold;
    text-align: center;
    background-color: #fcfcfc;
    font-family: Consolas, "Courier New", monospace;
  }
  .col-num {
    width: 5.5%;
    text-align: right;
    padding-right: 4px;
    font-family: Consolas, "Courier New", monospace;
  }
  .col-obs {
    width: 7%;
    text-align: left;
    font-size: 7.5pt;
  }

  /* Rodapé: Observações */
  .obs-cell {
    vertical-align: top;
    padding: 6px 8px;
    min-height: 60px;
    height: 65px;
    white-space: normal;
    word-break: break-word;
    font-size: 8pt;
    background: #fff;
    border-top: 1.5px solid #000 !important;
  }
  .obs-title {
    font-weight: bold;
    margin-bottom: 4px;
  }
  .obs-content {
    font-weight: normal;
    white-space: pre-wrap;
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

  <div class="sheet-wrapper">
    <table class="excel-sheet">
      <tbody>
        <!-- Linha 1: CONTRATO -->
        <tr>
          <td colspan="16" class="hdr-contrato-title">CONTRATO</td>
        </tr>
        <!-- Linha 2: CT ... -->
        <tr>
          <td colspan="16" class="hdr-contrato-val">${contractDisplay}</td>
        </tr>
        <!-- Linha 3: KM244 - ... -->
        <tr>
          <td colspan="16" class="hdr-local">${areaDisplay}</td>
        </tr>
        <!-- Linha 4: PLANILHA DIÁRIA DE CAMPO -->
        <tr>
          <td colspan="16" class="hdr-title-diaria">PLANILHA DIÁRIA DE CAMPO</td>
        </tr>
        <!-- Linha 5: Monitoramento do Nível d'Água -->
        <tr>
          <td colspan="16" class="hdr-subtitle-na">Monitoramento do Nível d'Água</td>
        </tr>
        <!-- Linha 6: DATA: (cols 1-12) e Clima: (cols 13-16) -->
        <tr>
          <td colspan="12" class="hdr-data-cell">
            <strong>DATA:</strong> &nbsp;<span style="font-family: Consolas, monospace; font-size: 8.5pt;">${dateDisplay}</span>
          </td>
          <td colspan="4" class="hdr-clima-cell">
            <strong>Clima:</strong> &nbsp;<span>${weatherDisplay}</span>
          </td>
        </tr>

        <!-- Linha 7: Cabeçalho dos 4 Blocos -->
        <tr>
          <!-- Bloco 1 -->
          <th class="col-hdr col-poco">Poço</th>
          <th class="col-hdr col-num">NA (m)</th>
          <th class="col-hdr col-num">NO (m)</th>
          <th class="col-hdr col-obs">Obs.</th>
          <!-- Bloco 2 -->
          <th class="col-hdr col-poco">Poço</th>
          <th class="col-hdr col-num">NA (m)</th>
          <th class="col-hdr col-num">NO (m)</th>
          <th class="col-hdr col-obs">Obs.</th>
          <!-- Bloco 3 -->
          <th class="col-hdr col-poco">Poço</th>
          <th class="col-hdr col-num">NA (m)</th>
          <th class="col-hdr col-num">NO (m)</th>
          <th class="col-hdr col-obs">Obs.</th>
          <!-- Bloco 4 -->
          <th class="col-hdr col-poco">Poço</th>
          <th class="col-hdr col-num">NA (m)</th>
          <th class="col-hdr col-num">NO (m)</th>
          <th class="col-hdr col-obs">Obs.</th>
        </tr>

        <!-- Linhas de Poços (4 blocos lado a lado) -->
        ${tableRowsHtml}

        <!-- Linha Final: Observações -->
        <tr>
          <td colspan="16" class="obs-cell">
            <div class="obs-title">Observações</div>
            <div class="obs-content">${notesDisplay || '&nbsp;'}</div>
          </td>
        </tr>
      </tbody>
    </table>
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
