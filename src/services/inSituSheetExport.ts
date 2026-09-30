import { EPA_LOGO_BASE64 } from '@/assets/epaLogoBase64'
import { InSituSheet, InSituMeasurementRow, InSituNutrientRowData } from '@/types/inSituAndNa'

export const NUTRIENT_ROW_TYPES: Array<'ENTRADA' | 'SAÍDA' | 'T. NUTRIENTES'> = [
  'ENTRADA',
  'SAÍDA',
  'T. NUTRIENTES',
]

export const IN_SITU_REPETITION_COUNT = 5 // Conforme o arquivo anexado oficial IN SITU REV2 (5 trios = 15 linhas)

/**
 * Cria ou sincroniza as 15 linhas da planilha in-situ conforme o arquivo anexado IN SITU REV2:
 * ENTRADA / SAÍDA / T. NUTRIENTES repetidos 5 vezes (índices 0 a 4 = 15 linhas no total).
 * Mantém compatibilidade com dados existentes em nutrient_rows ou em records legados.
 */
export function buildDefaultNutrientRows(
  existing?: InSituNutrientRowData[],
  legacyRecords?: InSituMeasurementRow[],
): InSituNutrientRowData[] {
  const rows: InSituNutrientRowData[] = []
  let index = 0

  for (let s = 0; s < IN_SITU_REPETITION_COUNT; s++) {
    for (const type of NUTRIENT_ROW_TYPES) {
      const rowId = `insitu_row_${s}_${type.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
      // Tenta encontrar por id exato, ou por par (system_index, type), ou por posição no array existente
      const found =
        existing?.find((r) => r.id === rowId) ||
        existing?.find((r) => r.system_index === s && r.type === type) ||
        (existing && existing[index] && existing[index].type === type ? existing[index] : undefined)

      // Fallback a partir de records legados caso existing não contenha esta linha
      let fallbackPh = ''
      let fallbackCond = ''
      let fallbackCondUnit = ''
      let fallbackOd = ''
      let fallbackTemp = ''
      let fallbackOrp = ''
      let fallbackTurb: 'Sim' | 'Não' | '' = ''
      let fallbackWeather = ''
      let fallbackResp = ''
      let fallbackDate = ''
      let fallbackTime = ''

      if (!found && legacyRecords && legacyRecords.length > 0) {
        // Se houver um registro legado na mesma posição ordinal (index)
        if (legacyRecords[index]) {
          const rec = legacyRecords[index]
          fallbackDate = rec.date || ''
          fallbackTime = rec.time || ''
          fallbackPh = rec.ph || ''
          fallbackCond = rec.conductivity || ''
          fallbackCondUnit = rec.conductivity_unit || ''
          fallbackOd = rec.od_mg_l || ''
          fallbackTemp = rec.temperature_c || ''
          fallbackOrp = rec.orp || ''
          fallbackTurb = rec.turbidity || ''
          fallbackWeather = rec.weather || ''
          fallbackResp = rec.responsible || ''
        } else {
          // Fallback adicional por nutrients legados
          const firstRec = legacyRecords[0]
          const pair = firstRec.nutrients?.[s]
          if (pair) {
            if (type === 'ENTRADA' && pair.entry) fallbackPh = pair.entry
            if (type === 'SAÍDA' && pair.exit) fallbackPh = pair.exit
          } else if (s === 0) {
            if (type === 'ENTRADA' && firstRec.nutrients_in) fallbackPh = firstRec.nutrients_in
            if (type === 'SAÍDA' && firstRec.nutrients_out) fallbackPh = firstRec.nutrients_out
          }
        }
      }

      rows.push({
        id: rowId,
        type,
        system_index: s,
        date: found?.date ?? fallbackDate,
        time: found?.time ?? fallbackTime,
        ph: found?.ph ?? fallbackPh,
        conductivity: found?.conductivity ?? fallbackCond,
        conductivity_unit: found?.conductivity_unit ?? fallbackCondUnit,
        od_mg_l: found?.od_mg_l ?? fallbackOd,
        temperature_c: found?.temperature_c ?? fallbackTemp,
        orp: found?.orp ?? fallbackOrp,
        turbidity: found?.turbidity ?? fallbackTurb,
        weather: found?.weather ?? fallbackWeather,
        responsible: found?.responsible ?? fallbackResp,
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
/**
 * Gera o documento de impressão/PDF da Planilha de Medições In-Situ (REV 02)
 * Reprodução EXATA e FIEL do arquivo de referência "IN SITU REV2":
 * - Cabeçalho:
 *     - Logo EPA à esquerda ("GRUPO EPA - A Engenharia Protegendo o Ambiente")
 *     - Título central: "MEDIÇÕES IN-SITU"
 *     - Bloco à direita: retângulo verde-claro com "Planilha in-situ" / "REV 02. 15/07/26"
 * - Faixa de metadados:
 *     - Caixa única contornada dividida em 3 colunas:
 *         PROJETO: [valor] | SISTEMA: [valor] | NÚMERO ATIVO: [valor]
 * - Tabela Única de Medições (11 colunas):
 *     - Cabeçalhos azul-claro (#bce4f9) com texto em azul escuro (#1a5682):
 *         PONTO DE MEDIÇÃO | DATA | HORA | pH | Cond. | OD (mg/L) | Temp. (ºC) | ORP | TURVA (sim/não) | CLIMA | RESPONSÁVEL PELAS MEDIÇÕES
 *     - Linhas: 5 repetições de ENTRADA / SAÍDA / T. NUTRIENTES (15 linhas no total)
 *         com a primeira coluna destacando o rótulo em azul (#005a9c)
 * - Faixa de Avisos inferior:
 *     - Retângulo com borda marrom/alaranjada e fundo salmão/laranja claro (#fde8db)
 *     - Linha 1: ATENÇÃO AS UNIDADES DE MEDIDAS: OD SEMPRE DEVE SER MEDIDO EM MG/L NUNCA EM %
 *     - Linha 2: CONDUTIVIDADE A UNIDADE ALTERA-SE AUTOMATICAMENTE, ANOTE SEMPRE A UNIDADE QUE ESTÁ NO VISOR!
 */
export function printInSituSheet(sheet: InSituSheet): void {
  const win = window.open('', '_blank', 'width=1200,height=800')
  if (!win) {
    alert('Permita pop-ups no navegador para visualizar a impressão / exportar o PDF.')
    return
  }

  const rows = buildDefaultNutrientRows(sheet.nutrient_rows, sheet.records)

  const rowsHtml = rows
    .map((row) => {
      const condVal = row.conductivity || ''
      const condUnit = row.conductivity_unit ? ` ${row.conductivity_unit}` : ''
      const condDisplay = condVal ? `${condVal}${condUnit}` : '&nbsp;'

      return `
        <tr>
          <td class="cell-label">${row.type}</td>
          <td class="cell-data">${row.date || '&nbsp;'}</td>
          <td class="cell-data">${row.time || '&nbsp;'}</td>
          <td class="cell-data">${row.ph || '&nbsp;'}</td>
          <td class="cell-data">${condDisplay}</td>
          <td class="cell-data">${row.od_mg_l || '&nbsp;'}</td>
          <td class="cell-data">${row.temperature_c || '&nbsp;'}</td>
          <td class="cell-data">${row.orp || '&nbsp;'}</td>
          <td class="cell-data">${row.turbidity || '&nbsp;'}</td>
          <td class="cell-data">${row.weather || '&nbsp;'}</td>
          <td class="cell-data">${row.responsible || '&nbsp;'}</td>
        </tr>
      `
    })
    .join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Planilha in-situ REV 02 - ${sheet.project_name || '21-0229'}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      margin: 0;
      padding: 0;
      color: #000;
      background: #fff;
      font-size: 8.5pt;
      line-height: 1.15;
    }
    .sheet-wrapper {
      width: 100%;
      max-width: 275mm;
      margin: 0 auto;
    }

    /* Cabeçalho */
    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      position: relative;
    }
    .header-left {
      width: 180px;
    }
    .header-left img {
      max-height: 48px;
      max-width: 160px;
      object-fit: contain;
    }
    .header-center {
      flex: 1;
      text-align: center;
    }
    .header-center h1 {
      margin: 0;
      font-size: 20pt;
      font-weight: 800;
      color: #1e293b;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      font-family: Arial, sans-serif;
    }
    .header-right {
      width: 180px;
      text-align: right;
    }
    .rev-pill {
      display: inline-block;
      background-color: #eaf6d8;
      color: #557924;
      padding: 5px 12px;
      border-radius: 4px;
      text-align: center;
      font-size: 8pt;
      font-weight: bold;
      line-height: 1.25;
    }

    /* Faixa: PROJETO | SISTEMA | NÚMERO ATIVO */
    .meta-box {
      display: flex;
      border: 1.5px solid #3b82f6;
      border-color: #5b738e;
      margin-bottom: 12px;
      background: #fff;
    }
    .meta-col {
      padding: 6px 12px;
      font-size: 9pt;
      font-weight: bold;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .meta-col.col-projeto {
      width: 25%;
      border-right: 1.5px solid #5b738e;
    }
    .meta-col.col-sistema {
      width: 45%;
      border-right: 1.5px solid #5b738e;
    }
    .meta-col.col-ativo {
      width: 30%;
    }
    .meta-val {
      font-weight: 600;
      color: #000;
    }

    /* Tabela da Planilha */
    table.in-situ-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #5b738e;
      table-layout: fixed;
      margin-bottom: 12px;
    }
    table.in-situ-table th {
      background-color: #bde4f7;
      color: #0b4e7b;
      border: 1px solid #5b738e;
      padding: 5px 3px;
      font-size: 7.8pt;
      font-weight: 800;
      text-align: center;
      vertical-align: middle;
      line-height: 1.15;
    }
    table.in-situ-table td {
      border: 1px solid #5b738e;
      height: 22px;
      padding: 2px 4px;
      font-size: 7.5pt;
      vertical-align: middle;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    td.cell-label {
      text-align: center;
      font-weight: 800;
      color: #004b87;
      background-color: #fff;
      font-size: 7.8pt;
      letter-spacing: 0.2px;
    }
    td.cell-data {
      text-align: center;
      background-color: #fff;
      color: #000;
    }

    /* Avisos Inferiores */
    .warning-panel {
      border: 1.5px solid #e09875;
      background-color: #faede5;
      padding: 6px 12px;
      font-size: 8pt;
      line-height: 1.35;
      color: #000;
      font-weight: 600;
    }
    .warning-panel .alert-title {
      font-weight: 800;
    }

    /* Barra flutuante de controle na tela (oculta na impressão) */
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
      body { padding: 0 !important; background: #fff !important; }
      .sheet-wrapper { max-width: 100% !important; }
    }
    @media screen {
      body {
        padding-top: 60px;
        padding-bottom: 30px;
        background: #e2e8f0;
        display: flex;
        justify-content: center;
      }
      .sheet-wrapper {
        background: #fff;
        padding: 12mm;
        box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        border-radius: 2px;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div><strong>Grupo EPA — Planilha In-Situ</strong> (REV 02. 15/07/26)</div>
    <div>
      <button onclick="window.print()">Imprimir / Salvar PDF</button>
    </div>
  </div>

  <div class="sheet-wrapper">
    <!-- Cabeçalho Oficial -->
    <div class="header-row">
      <div class="header-left">
        <img src="${EPA_LOGO_BASE64}" alt="Grupo EPA - A Engenharia Protegendo o Ambiente" />
      </div>
      <div class="header-center">
        <h1>MEDIÇÕES IN-SITU</h1>
      </div>
      <div class="header-right">
        <div class="rev-pill">
          Planilha in-situ<br>
          REV 02. 15/07/26
        </div>
      </div>
    </div>

    <!-- Faixa: PROJETO | SISTEMA | NÚMERO ATIVO -->
    <div class="meta-box">
      <div class="meta-col col-projeto">
        <span>PROJETO:</span>
        <span class="meta-val">${sheet.project_name || '21-0229'}</span>
      </div>
      <div class="meta-col col-sistema">
        <span>SISTEMA:</span>
        <span class="meta-val">${sheet.system_name || ''}</span>
      </div>
      <div class="meta-col col-ativo">
        <span>NÚMERO ATIVO:</span>
        <span class="meta-val">${sheet.active_number || ''}</span>
      </div>
    </div>

    <!-- Tabela Oficial Única: 11 colunas e 15 linhas (5 repetições de ENTRADA/SAÍDA/T. NUTRIENTES) -->
    <table class="in-situ-table">
      <colgroup>
        <col style="width: 12.5%;" />
        <col style="width: 7.5%;" />
        <col style="width: 6.5%;" />
        <col style="width: 6.5%;" />
        <col style="width: 8.5%;" />
        <col style="width: 8.5%;" />
        <col style="width: 8.0%;" />
        <col style="width: 6.5%;" />
        <col style="width: 8.5%;" />
        <col style="width: 8.5%;" />
        <col style="width: 18.5%;" />
      </colgroup>
      <thead>
        <tr>
          <th>PONTO DE<br>MEDIÇÃO</th>
          <th>DATA</th>
          <th>HORA</th>
          <th>pH</th>
          <th>Cond.</th>
          <th>OD<br>(mg/L)</th>
          <th>Temp.<br>(ºC)</th>
          <th>ORP</th>
          <th>TURVA<br>(sim/não)</th>
          <th>CLIMA</th>
          <th>RESPONSÁVEL PELAS<br>MEDIÇÕES</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- Avisos Obrigatórios -->
    <div class="warning-panel">
      <div>ATENÇÃO AS UNIDADES DE MEDIDAS: OD SEMPRE DEVE SER MEDIDO EM MG/L <strong>NUNCA EM %</strong></div>
      <div>CONDUTIVIDADE A UNIDADE ALTERA-SE AUTOMATICAMENTE, ANOTE SEMPRE A UNIDADE QUE ESTÁ NO VISOR!</div>
    </div>
  </div>
</body>
</html>`

  win.document.open()
  win.document.write(html)
  win.document.close()
}
