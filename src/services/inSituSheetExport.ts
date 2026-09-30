import { EPA_LOGO_BASE64 } from '@/assets/epaLogoBase64'
import { InSituSheet, InSituMeasurementRow, InSituNutrientRowData } from '@/types/inSituAndNa'

export const NUTRIENT_ROW_TYPES: Array<'ENTRADA' | 'SAÍDA' | 'T. NUTRIENTES'> = [
  'ENTRADA',
  'SAÍDA',
  'T. NUTRIENTES',
]

/**
 * Cria ou sincroniza as 12 linhas da seção de nutrientes conforme a sequência do papel:
 * ENTRADA / SAÍDA / T. NUTRIENTES repetidos 4 vezes (sistemas 0 a 3).
 * Garante compatibilidade caso já existam dados ou dados legados.
 */
export function buildDefaultNutrientRows(
  existing?: InSituNutrientRowData[],
  legacyRecords?: InSituMeasurementRow[],
): InSituNutrientRowData[] {
  const rows: InSituNutrientRowData[] = []
  let index = 0

  for (let s = 0; s < 4; s++) {
    for (const type of NUTRIENT_ROW_TYPES) {
      const rowId = `nutr_sys${s}_${type.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
      const found = existing?.find(
        (r) =>
          r.id === rowId ||
          (r.system_index === s && r.type === type) ||
          (existing.indexOf(r) === index && r.type === type),
      )

      // Verificação de fallback legado: se não havia nutrient_rows, tentar extrair de records legados
      let fallbackPh = ''
      let fallbackConductivity = ''
      let fallbackOd = ''
      if (!found && legacyRecords && legacyRecords.length > 0) {
        const firstRecord = legacyRecords[0]
        const pair = firstRecord.nutrients?.[s]
        if (pair) {
          if (type === 'ENTRADA' && pair.entry) fallbackPh = pair.entry
          if (type === 'SAÍDA' && pair.exit) fallbackPh = pair.exit
        } else if (s === 0) {
          if (type === 'ENTRADA' && firstRecord.nutrients_in) fallbackPh = firstRecord.nutrients_in
          if (type === 'SAÍDA' && firstRecord.nutrients_out) fallbackPh = firstRecord.nutrients_out
        }
      }

      rows.push({
        id: rowId,
        type,
        system_index: s,
        date: found?.date || '',
        time: found?.time || '',
        ph: found?.ph ?? fallbackPh,
        conductivity: found?.conductivity ?? fallbackConductivity,
        conductivity_unit: found?.conductivity_unit || 'µS/cm',
        od_mg_l: found?.od_mg_l ?? fallbackOd,
        temperature_c: found?.temperature_c || '',
        orp: found?.orp || '',
        turbidity: found?.turbidity || '',
        weather: found?.weather || '',
        responsible: found?.responsible || '',
        notes: found?.notes || '',
      })
      index++
    }
  }

  return rows
}

/**
 * Retorna as medições preenchendo até pelo menos minRows linhas (como no modelo físico)
 */
export function padInSituRows(
  records: InSituMeasurementRow[],
  minRows = 6,
): Array<InSituMeasurementRow | null> {
  const list: Array<InSituMeasurementRow | null> = [...records]
  while (list.length < minRows) {
    list.push(null)
  }
  return list
}

/**
 * Obtém entrada e saída para um dos 4 blocos de sistemas (legado)
 */
export function getNutrientPair(
  row: InSituMeasurementRow | null,
  systemIndex: number,
): { in: string; out: string } {
  if (!row) return { in: '', out: '' }
  if (row.nutrients && row.nutrients[systemIndex]) {
    return {
      in: row.nutrients[systemIndex].entry || '',
      out: row.nutrients[systemIndex].exit || '',
    }
  }
  if (systemIndex === 0) {
    return {
      in: row.nutrients_in || '',
      out: row.nutrients_out || '',
    }
  }
  return { in: '', out: '' }
}

/**
 * Gera o documento de impressão/PDF da Planilha de Medições In-Situ (REV 02)
 * Fiel ao documento físico:
 * - Cabeçalho: Logo EPA, Título "MEDIÇÕES IN-SITU", identificação "Planilha in-situ / REV 02. 15/07/26"
 * - Campos de identificação: PROJETO: | SISTEMA: | NÚMERO ATIVO:
 * - Colunas da tabela na ordem exata:
 *   PONTO DE MEDIÇÃO | DATA | HORA | pH | Cond. | OD (mg/L) | Temp. (ºC) | ORP | TURVA (sim/não) | CLIMA | RESPONSÁVEL PELAS MEDIÇÕES |
 *   T. NUTRIENTES (Sist 1: Entrada | Saída) | T. NUTRIENTES (Sist 2: Entrada | Saída) | T. NUTRIENTES (Sist 3: Entrada | Saída) | T. NUTRIENTES (Sist 4: Entrada | Saída)
 * - Notas de rodapé com destaque:
 *   "ATENÇÃO AS UNIDADES DE MEDIDAS: OD SEMPRE DEVE SER MEDIDO EM MG/L NUNCA EM %"
 *   "CONDUTIVIDADE A UNIDADE ALTERA-SE AUTOMATICAMENTE, ANOTE SEMPRE A UNIDADE QUE ESTÁ NO VISOR!"
 */
/**
 * Gera o documento de impressão/PDF da Planilha de Medições In-Situ (REV 02)
 * Fiel ao layout do papel oficial de referência:
 * - Cabeçalho: Logo EPA, Título "MEDIÇÕES IN-SITU", identificação "Planilha in-situ / REV 02. 15/07/26"
 * - Faixa de identificação: PROJETO: | SISTEMA: | NÚMERO ATIVO:
 * - Tabela com colunas:
 *   PONTO DE MEDIÇÃO | DATA | HORA | pH | Cond. | OD (mg/L) | Temp. (ºC) | ORP | TURVA (sim/não) | CLIMA | RESPONSÁVEL PELAS MEDIÇÕES
 * - Seção de Medições regulares
 * - Seção final de Nutrientes idêntica ao papel:
 *   Primeira coluna com a sequência repetida 4 vezes em letras maiúsculas azuis:
 *     ENTRADA
 *     SAÍDA
 *     T. NUTRIENTES
 *     (repetido 4x)
 *   Demais colunas são células de preenchimento alinhadas com as colunas de medição.
 * - Notas de rodapé com destaque obrigatório de calibração/unidades.
 */
export function printInSituSheet(sheet: InSituSheet): void {
  const win = window.open('', '_blank', 'width=1200,height=800')
  if (!win) {
    alert('Permita pop-ups no navegador para visualizar a impressão / exportar o PDF.')
    return
  }

  const paddedRows = padInSituRows(sheet.records || [], 5)
  const nutrientRows = buildDefaultNutrientRows(sheet.nutrient_rows, sheet.records)

  // Tabela de Medições principais (10 colunas de dados além do ponto de medição)
  const measurementsRowsHtml = paddedRows
    .map((row) => {
      const ponto = row?.point || (row ? sheet.measurement_point || '' : '')
      const data = row?.date || '&nbsp;'
      const hora = row?.time || '&nbsp;'
      const ph = row?.ph || '&nbsp;'
      const condVal = row?.conductivity || ''
      const condUnit = row?.conductivity_unit ? ` <small>${row.conductivity_unit}</small>` : ''
      const cond = condVal ? `${condVal}${condUnit}` : '&nbsp;'
      const od = row?.od_mg_l || '&nbsp;'
      const temp = row?.temperature_c || '&nbsp;'
      const orp = row?.orp || '&nbsp;'
      const turva = row?.turbidity || '&nbsp;'
      const clima = row?.weather || '&nbsp;'
      const resp = row?.responsible || (row ? sheet.responsible_name || '' : '')

      return `
        <tr>
          <td class="col-center fw-bold">${ponto || '&nbsp;'}</td>
          <td class="col-center">${data}</td>
          <td class="col-center">${hora}</td>
          <td class="col-center">${ph}</td>
          <td class="col-center">${cond}</td>
          <td class="col-center">${od}</td>
          <td class="col-center">${temp}</td>
          <td class="col-center">${orp}</td>
          <td class="col-center">${turva}</td>
          <td class="col-center">${clima}</td>
          <td class="col-center font-sm">${resp || '&nbsp;'}</td>
        </tr>
      `
    })
    .join('')

  // Tabela de Nutrientes In-Situ exatamente como no modelo oficial da EPA (anexo):
  // Tabela única contínua, sem botões nem colunas empilhadas:
  // Primeira coluna estreita com rótulo em AZUL e NEGRITO (ENTRADA, SAÍDA, T. NUTRIENTES repetidos 4 vezes = 12 linhas)
  // À direita, grade de 10 colunas de células de largura igual com bordas finas
  const nutrientTableRowsHtml = nutrientRows
    .map((row) => {
      const condVal = row.conductivity || ''
      const condUnit = row.conductivity_unit ? ` <small>${row.conductivity_unit}</small>` : ''
      const cond = condVal ? `${condVal}${condUnit}` : '&nbsp;'

      return `
        <tr>
          <td class="nutr-label-cell">${row.type}</td>
          <td class="nutr-data-cell">${row.date || '&nbsp;'}</td>
          <td class="nutr-data-cell">${row.time || '&nbsp;'}</td>
          <td class="nutr-data-cell">${row.ph || '&nbsp;'}</td>
          <td class="nutr-data-cell">${cond}</td>
          <td class="nutr-data-cell">${row.od_mg_l || '&nbsp;'}</td>
          <td class="nutr-data-cell">${row.temperature_c || '&nbsp;'}</td>
          <td class="nutr-data-cell">${row.orp || '&nbsp;'}</td>
          <td class="nutr-data-cell">${row.turbidity || '&nbsp;'}</td>
          <td class="nutr-data-cell">${row.weather || '&nbsp;'}</td>
          <td class="nutr-data-cell font-sm">${row.responsible || '&nbsp;'}</td>
        </tr>
      `
    })
    .join('')
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Medições In-Situ - ${sheet.project_name || 'In-Situ'}</title>
  <style>
    @page {
      size: A4 landscape;
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
      font-size: 8pt;
      line-height: 1.15;
    }
    .sheet-container {
      width: 100%;
      max-width: 285mm;
      margin: 0 auto;
    }

    /* Cabeçalho do Modelo Original */
    .top-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .logo-container {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      width: 160px;
    }
    .logo-container img {
      max-height: 44px;
      max-width: 130px;
      object-fit: contain;
    }
    .center-title {
      flex: 1;
      text-align: center;
    }
    .center-title h1 {
      margin: 0;
      font-size: 17pt;
      font-weight: 800;
      color: #0c4a6e;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .rev-badge {
      width: 160px;
      text-align: right;
    }
    .rev-box {
      display: inline-block;
      background-color: #ecfccb;
      color: #3f6212;
      border: 1px solid #bef264;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: bold;
      line-height: 1.2;
    }

    /* Faixa de Identificação: PROJETO | SISTEMA | NÚMERO ATIVO */
    .meta-bar {
      display: flex;
      border: 1.5px solid #000;
      background-color: #fff;
      margin-bottom: 6px;
      font-size: 9pt;
      font-weight: bold;
    }
    .meta-item {
      padding: 5px 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .meta-item.proj {
      flex: 1.4;
      border-right: 1.5px solid #000;
    }
    .meta-item.syst {
      flex: 1.8;
      border-right: 1.5px solid #000;
    }
    .meta-item.ativo {
      flex: 1.6;
    }
    .meta-value {
      font-weight: normal;
      color: #1e293b;
    }

    /* Tabela Medições In-Situ */
    table.insitu-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
      margin-bottom: 6px;
      table-layout: fixed;
    }
    table.insitu-table th, table.insitu-table td {
      border: 1px solid #000;
      padding: 3px 4px;
      height: 20px;
      vertical-align: middle;
      font-size: 7.5pt;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    table.insitu-table thead th {
      background-color: #bae6fd;
      color: #0369a1;
      font-weight: bold;
      text-align: center;
      line-height: 1.15;
    }
    .col-center {
      text-align: center;
    }
    .fw-bold {
      font-weight: bold;
    }
    .font-sm {
      font-size: 7pt;
    }

    /* Tabela de Nutrientes In-Situ oficial EPA (única grade contínua) */
    table.nutrient-grid-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
      margin-top: -1px;
      margin-bottom: 6px;
      table-layout: fixed;
    }
    table.nutrient-grid-table td {
      border: 1px solid #000;
      padding: 3px 4px;
      height: 20px;
      vertical-align: middle;
      font-size: 7.5pt;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nutr-label-cell {
      width: 11%;
      font-weight: bold;
      color: #004b87; /* Azul EPA oficial */
      text-align: left;
      padding-left: 6px !important;
      font-size: 7.5pt;
      letter-spacing: 0.2px;
    }
    .nutr-data-cell {
      text-align: center;
      background-color: #fff;
    }

    /* Avisos de Rodapé em Destaque */
    .warning-box {
      border: 1.5px solid #f97316;
      background-color: #ffedd5;
      padding: 6px 10px;
      font-size: 8pt;
      line-height: 1.35;
      color: #9a3412;
      border-radius: 2px;
    }
    .warning-line {
      font-weight: bold;
    }
    .warning-line strong {
      text-decoration: underline;
    }

    .no-print-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #0f172a;
      color: #fff;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .no-print-bar button {
      background: #0284c7;
      color: #fff;
      border: none;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
    }
    .no-print-bar button:hover {
      background: #0369a1;
    }
    @media print {
      .no-print-bar { display: none !important; }
      body { padding: 0 !important; }
    }
    @media screen {
      body {
        padding-top: 60px;
        background: #f1f5f9;
        display: flex;
        justify-content: center;
      }
      .sheet-container {
        background: #fff;
        padding: 8mm;
        box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div><strong>Grupo EPA — Visualização e Impressão de Medições In-Situ</strong> (REV 02)</div>
    <div>
      <button onclick="window.print()">Imprimir / Salvar PDF (Paisagem)</button>
    </div>
  </div>

  <div class="sheet-container">
    <!-- Cabeçalho -->
    <div class="top-header">
      <div class="logo-container">
        <img src="${EPA_LOGO_BASE64}" alt="Grupo EPA" />
      </div>
      <div class="center-title">
        <h1>MEDIÇÕES IN-SITU</h1>
      </div>
      <div class="rev-badge">
        <div class="rev-box">
          Planilha in-situ<br>
          REV 02. 15/07/26
        </div>
      </div>
    </div>

    <!-- Faixa: PROJETO | SISTEMA | NÚMERO ATIVO -->
    <div class="meta-bar">
      <div class="meta-item proj">
        <span>PROJETO:</span>
        <span class="meta-value">${sheet.project_name || '—'}</span>
      </div>
      <div class="meta-item syst">
        <span>SISTEMA:</span>
        <span class="meta-value">${sheet.system_name || '—'}</span>
      </div>
      <div class="meta-item ativo">
        <span>NÚMERO ATIVO:</span>
        <span class="meta-value">${sheet.active_number || '—'}</span>
      </div>
    </div>

    <!-- Tabela Principal de Medições -->
    <table class="insitu-table">
      <thead>
        <tr>
          <th style="width: 11%;">PONTO DE<br>MEDIÇÃO</th>
          <th style="width: 8.9%;">DATA</th>
          <th style="width: 8.9%;">HORA</th>
          <th style="width: 8.9%;">pH</th>
          <th style="width: 8.9%;">Cond.</th>
          <th style="width: 8.9%;">OD<br>(mg/L)</th>
          <th style="width: 8.9%;">Temp.<br>(ºC)</th>
          <th style="width: 8.9%;">ORP</th>
          <th style="width: 8.9%;">TURVA<br>(sim/não)</th>
          <th style="width: 8.9%;">CLIMA</th>
          <th style="width: 8.9%;">RESPONSÁVEL PELAS<br>MEDIÇÕES</th>
        </tr>
      </thead>
      <tbody>
        ${measurementsRowsHtml}
      </tbody>
    </table>

    <!-- Tabela de Nutrientes In-Situ (Tabela Única Contínua conforme Modelo Oficial EPA do Anexo) -->
    <table class="nutrient-grid-table">
      <colgroup>
        <col style="width: 11%;" />
        <col style="width: 8.9%;" />
        <col style="width: 8.9%;" />
        <col style="width: 8.9%;" />
        <col style="width: 8.9%;" />
        <col style="width: 8.9%;" />
        <col style="width: 8.9%;" />
        <col style="width: 8.9%;" />
        <col style="width: 8.9%;" />
        <col style="width: 8.9%;" />
        <col style="width: 8.9%;" />
      </colgroup>
      <tbody>
        ${nutrientTableRowsHtml}
      </tbody>
    </table>

    <!-- Rodapé: Avisos Obrigatórios -->
    <div class="warning-box">
      <div class="warning-line">ATENÇÃO AS UNIDADES DE MEDIDAS: OD SEMPRE DEVE SER MEDIDO EM MG/L <strong>NUNCA</strong> EM %</div>
      <div class="warning-line">CONDUTIVIDADE A UNIDADE ALTERA-SE AUTOMATICAMENTE, ANOTE SEMPRE A UNIDADE QUE ESTÁ NO VISOR!</div>
    </div>
  </div>
</body>
</html>`

  win.document.open()
  win.document.write(html)
  win.document.close()
}
