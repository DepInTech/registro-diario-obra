import { EPA_LOGO_BASE64 } from '@/assets/epaLogoBase64'
import { InSituSheet, InSituMeasurementRow } from '@/types/inSituAndNa'

/**
 * Retorna as medições preenchendo até pelo menos 14 linhas (como no modelo físico REV 02 da imagem)
 */
export function padInSituRows(
  records: InSituMeasurementRow[],
  minRows = 14,
): Array<InSituMeasurementRow | null> {
  const list: Array<InSituMeasurementRow | null> = [...records]
  while (list.length < minRows) {
    list.push(null)
  }
  return list
}

/**
 * Obtém entrada e saída para um dos 4 blocos de sistemas (índices 0, 1, 2, 3)
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
  // Compatibilidade com colunas antigas simples se for o sistema 0
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
export function printInSituSheet(sheet: InSituSheet): void {
  const win = window.open('', '_blank', 'width=1200,height=800')
  if (!win) {
    alert('Permita pop-ups no navegador para visualizar a impressão / exportar o PDF.')
    return
  }

  const paddedRows = padInSituRows(sheet.records || [], 12)

  const rowsHtml = paddedRows
    .map((row) => {
      const ponto = row?.point || sheet.measurement_point || '&nbsp;'
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
      const resp = row?.responsible || sheet.responsible_name || '&nbsp;'

      // 4 blocos de Nutrientes (Entrada / Saída)
      const n0 = getNutrientPair(row, 0)
      const n1 = getNutrientPair(row, 1)
      const n2 = getNutrientPair(row, 2)
      const n3 = getNutrientPair(row, 3)

      return `
        <tr>
          <td class="col-center fw-bold">${ponto}</td>
          <td class="col-center">${data}</td>
          <td class="col-center">${hora}</td>
          <td class="col-center">${ph}</td>
          <td class="col-center">${cond}</td>
          <td class="col-center">${od}</td>
          <td class="col-center">${temp}</td>
          <td class="col-center">${orp}</td>
          <td class="col-center">${turva}</td>
          <td class="col-center">${clima}</td>
          <td class="col-center font-sm">${resp}</td>

          <td class="col-center">${n0.in || '&nbsp;'}</td>
          <td class="col-center">${n0.out || '&nbsp;'}</td>

          <td class="col-center">${n1.in || '&nbsp;'}</td>
          <td class="col-center">${n1.out || '&nbsp;'}</td>

          <td class="col-center">${n2.in || '&nbsp;'}</td>
          <td class="col-center">${n2.out || '&nbsp;'}</td>

          <td class="col-center">${n3.in || '&nbsp;'}</td>
          <td class="col-center">${n3.out || '&nbsp;'}</td>
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
      color: #1e293b;
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
      margin-bottom: 5px;
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
      padding: 3px 2px;
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
      line-height: 1.1;
    }
    .th-nutrientes {
      background-color: #e0f2fe !important;
      color: #075985 !important;
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .th-subcol {
      background-color: #f0f9ff !important;
      color: #0369a1 !important;
      font-size: 6.5pt;
      font-weight: 700;
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

    <!-- Tabela Principal com os 4 Blocos T. Nutrientes -->
    <table class="insitu-table">
      <thead>
        <tr>
          <th rowspan="2" style="width: 7.5%;">PONTO DE<br>MEDIÇÃO</th>
          <th rowspan="2" style="width: 6%;">DATA</th>
          <th rowspan="2" style="width: 4%;">HORA</th>
          <th rowspan="2" style="width: 4%;">pH</th>
          <th rowspan="2" style="width: 6.5%;">Cond.</th>
          <th rowspan="2" style="width: 5%;">OD<br>(mg/L)</th>
          <th rowspan="2" style="width: 4.5%;">Temp.<br>(ºC)</th>
          <th rowspan="2" style="width: 4.5%;">ORP</th>
          <th rowspan="2" style="width: 5.5%;">TURVA<br>(sim/não)</th>
          <th rowspan="2" style="width: 6%;">CLIMA</th>
          <th rowspan="2" style="width: 8.5%;">RESPONSÁVEL PELAS<br>MEDIÇÕES</th>
          <th colspan="2" class="th-nutrientes" style="width: 10.5%;">T. NUTRIENTES (1)</th>
          <th colspan="2" class="th-nutrientes" style="width: 10.5%;">T. NUTRIENTES (2)</th>
          <th colspan="2" class="th-nutrientes" style="width: 10.5%;">T. NUTRIENTES (3)</th>
          <th colspan="2" class="th-nutrientes" style="width: 10.5%;">T. NUTRIENTES (4)</th>
        </tr>
        <tr>
          <!-- 1 -->
          <th class="th-subcol" style="width: 5.25%;">ENTRADA</th>
          <th class="th-subcol" style="width: 5.25%;">SAÍDA</th>
          <!-- 2 -->
          <th class="th-subcol" style="width: 5.25%;">ENTRADA</th>
          <th class="th-subcol" style="width: 5.25%;">SAÍDA</th>
          <!-- 3 -->
          <th class="th-subcol" style="width: 5.25%;">ENTRADA</th>
          <th class="th-subcol" style="width: 5.25%;">SAÍDA</th>
          <!-- 4 -->
          <th class="th-subcol" style="width: 5.25%;">ENTRADA</th>
          <th class="th-subcol" style="width: 5.25%;">SAÍDA</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
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
