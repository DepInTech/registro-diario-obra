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

  // Linhas combinadas: medições principais (11 colunas) + 4 blocos de T. Nutrientes
  // Cada bloco possui 2 subcolunas (Rótulo da linha: ENTRADA / SAÍDA | Célula de valor)
  // Conforme o documento físico: a célula da esquerda é rotulada "ENTRADA" na 1ª linha e "SAÍDA" na 2ª linha.
  const combinedRowsHtml = paddedRows
    .map((row, rowIdx) => {
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

      const n0 = getNutrientPair(row, 0)
      const n1 = getNutrientPair(row, 1)
      const n2 = getNutrientPair(row, 2)
      const n3 = getNutrientPair(row, 3)

      // Células dos 4 blocos de nutrientes com disposição em linhas:
      // Na linha do registro, renderiza a sub-tabela com linha ENTRADA e linha SAÍDA
      const nutrColsHtml = [n0, n1, n2, n3]
        .map((pair) => {
          const entryVal = pair.in || '&nbsp;'
          const exitVal = pair.out || '&nbsp;'
          return `
            <td colspan="2" class="td-nutr-block">
              <table class="nutr-subtable">
                <tbody>
                  <tr class="nutr-subtr">
                    <td class="nutr-sublbl">ENTRADA</td>
                    <td class="nutr-subval">${entryVal}</td>
                  </tr>
                  <tr class="nutr-subtr">
                    <td class="nutr-sublbl">SAÍDA</td>
                    <td class="nutr-subval">${exitVal}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          `
        })
        .join('')

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
          ${nutrColsHtml}
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

    /* Cabeçalhos e sub-tabela dos 4 Blocos de T. Nutrientes (Disposição em Linhas) */
    .th-nutr-hdr {
      background-color: #dbeafe !important;
      color: #1e3a8a !important;
      font-weight: 800 !important;
      text-align: center;
      font-size: 7.5pt;
    }
    .th-nutr-label {
      background-color: #eff6ff !important;
      color: #1e40af !important;
      font-weight: 700;
      text-align: center;
      font-size: 6.5pt;
      width: 48%;
    }
    .th-nutr-val {
      background-color: #eff6ff !important;
      color: #1e40af !important;
      font-weight: 700;
      text-align: center;
      font-size: 6.5pt;
      width: 52%;
    }
    .td-nutr-block {
      padding: 0 !important;
      vertical-align: middle;
    }
    table.nutr-subtable {
      width: 100%;
      height: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.nutr-subtable td {
      border: none !important;
      padding: 1.5px 3px !important;
      font-size: 7pt !important;
      height: 12px;
    }
    .nutr-subtr:first-child td {
      border-bottom: 1px dotted #94a3b8 !important;
    }
    .nutr-sublbl {
      width: 48%;
      font-weight: 800;
      color: #0369a1;
      text-align: center;
      background-color: #f8fafc;
      border-right: 1px solid #cbd5e1 !important;
      letter-spacing: 0.3px;
    }
    .nutr-subval {
      width: 52%;
      text-align: center;
      font-family: monospace;
      font-weight: 600;
      color: #0f172a;
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

    <!-- Tabela Principal Fiel ao Layout Físico com Bloco Lateral de T. Nutrientes -->
    <table class="insitu-table">
      <thead>
        <tr>
          <th rowspan="2" style="width: 11%;">PONTO DE<br>MEDIÇÃO</th>
          <th rowspan="2" style="width: 7%;">DATA</th>
          <th rowspan="2" style="width: 5.5%;">HORA</th>
          <th rowspan="2" style="width: 5%;">pH</th>
          <th rowspan="2" style="width: 7.5%;">Cond.</th>
          <th rowspan="2" style="width: 6.5%;">OD<br>(mg/L)</th>
          <th rowspan="2" style="width: 5.5%;">Temp.<br>(ºC)</th>
          <th rowspan="2" style="width: 5%;">ORP</th>
          <th rowspan="2" style="width: 6.5%;">TURVA<br>(sim/não)</th>
          <th rowspan="2" style="width: 8.5%;">CLIMA</th>
          <th rowspan="2" style="width: 10.5%;">RESPONSÁVEL PELAS<br>MEDIÇÕES</th>
          <th colspan="2" class="th-nutr-hdr" style="width: 8%;">SISTEMA 01</th>
          <th colspan="2" class="th-nutr-hdr" style="width: 8%;">SISTEMA 02</th>
          <th colspan="2" class="th-nutr-hdr" style="width: 8%;">SISTEMA 03</th>
          <th colspan="2" class="th-nutr-hdr" style="width: 8%;">SISTEMA 04</th>
        </tr>
        <tr>
          <!-- Sist 1 -->
          <th class="th-nutr-label">T. NUTRIENTES</th>
          <th class="th-nutr-val">VALOR</th>
          <!-- Sist 2 -->
          <th class="th-nutr-label">T. NUTRIENTES</th>
          <th class="th-nutr-val">VALOR</th>
          <!-- Sist 3 -->
          <th class="th-nutr-label">T. NUTRIENTES</th>
          <th class="th-nutr-val">VALOR</th>
          <!-- Sist 4 -->
          <th class="th-nutr-label">T. NUTRIENTES</th>
          <th class="th-nutr-val">VALOR</th>
        </tr>
      </thead>
      <tbody>
        ${combinedRowsHtml}
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
