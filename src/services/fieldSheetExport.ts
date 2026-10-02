import type { OfflineFieldSheetItem } from '@/services/offlineStorage'

/** Extrai lista ordenada de índices numéricos de compressores presentes em compressor_data (mínimo 1 e 2) */
function getCompressorIndices(compData: Record<string, any> | null | undefined): number[] {
  const set = new Set<number>([1, 2])
  if (compData && typeof compData === 'object') {
    for (const key of Object.keys(compData)) {
      const match = key.match(/\d+$/)
      if (match) {
        const num = parseInt(match[0], 10)
        if (!isNaN(num) && num >= 1 && num <= 100) {
          set.add(num)
        }
      }
    }
  }
  return Array.from(set).sort((a, b) => a - b)
}

/** Extrai lista ordenada de índices numéricos de saídas presentes em infiltration_data (mínimo 1, 2 e 3) */
function getInfiltrationExitNumbers(infData: Record<string, any> | null | undefined): number[] {
  const set = new Set<number>([1, 2, 3])
  if (infData && typeof infData === 'object') {
    for (const key of Object.keys(infData)) {
      const match = key.match(/^out(\d+)(Morning|Afternoon)?$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num >= 1 && num <= 100) {
          set.add(num)
        }
      }
    }
  }
  return Array.from(set).sort((a, b) => a - b)
}

/**
 * Gera documento para impressão / salvar PDF da Planilha de Campo EPA.
 *
 * Grade e bordas reforçadas em preto (#000) e cinza escuro (#333) para
 * máxima legibilidade e contraste sob impressão física em campo.
 */
export function printFieldSheet(sheet: OfflineFieldSheetItem) {
  const win = window.open('', '_blank')
  if (!win) {
    window.print()
    return
  }

  const extData = sheet.extraction_data || []
  let fallbackMorning = ''
  let fallbackAfternoon = ''
  if (Array.isArray(extData)) {
    for (const r of extData) {
      if (!fallbackMorning && r.morning_time) fallbackMorning = r.morning_time
      if (!fallbackAfternoon && r.afternoon_time) fallbackAfternoon = r.afternoon_time
    }
  }

  const morningTime = sheet.morning_time || fallbackMorning || ''
  const afternoonTime = sheet.afternoon_time || fallbackAfternoon || ''
  const infMorningTime = sheet.infiltration_morning_time || ''
  const infAfternoonTime = sheet.infiltration_afternoon_time || ''

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
        <td style="border:1px solid #333;padding:5px 8px;text-align:center;font-weight:bold;">${r.well || '—'}</td>
        <td style="border:1px solid #333;padding:5px 8px;text-align:right;">${r.morning || ''}</td>
        <td style="border:1px solid #333;padding:5px 8px;text-align:right;">${r.afternoon || ''}</td>
        <td style="border:1px solid #333;padding:5px 8px;text-align:center;">${r.pump || ''}</td>
        <td style="border:1px solid #333;padding:5px 8px;text-align:center;">${finalAutopump}</td>
      </tr>`
    })
  } else {
    extractionRows = `<tr><td colspan="5" style="border:1px solid #333;padding:8px;text-align:center;color:#333;">Nenhum poço registrado</td></tr>`
  }

  const infData = sheet.infiltration_data || {}
  const compData = sheet.compressor_data || {}
  const oilData = sheet.oil_removal_data || {}

  const compressorIndices = getCompressorIndices(compData)
  const infiltrationExitNumbers = getInfiltrationExitNumbers(infData)

  let dynamicInfExitRows = ''
  for (const n of infiltrationExitNumbers) {
    const padStr = String(n).padStart(2, '0')
    const mVal = infData[`out${n}Morning`] || ''
    const aVal = infData[`out${n}Afternoon`] || ''
    dynamicInfExitRows += `<tr>
      <td class="label-col">Saída ${padStr}</td>
      <td colspan="2" style="text-align:right;">${mVal}</td>
      <td colspan="2" style="text-align:right;">${aVal}</td>
    </tr>`
  }

  let compHeaderCells = ''
  let linhaArHeaderCells = ''
  for (const c of compressorIndices) {
    const pad = String(c).padStart(2, '0')
    compHeaderCells += `<th style="text-align:center;">COMPRESSOR ${pad}</th>`
    linhaArHeaderCells += `<th style="text-align:center; background-color:#145a32;">COMPRESSOR ${pad}</th>`
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
  for (const spec of compParamSpecs) {
    let cells = ''
    for (const c of compressorIndices) {
      const val =
        compData[`${spec.prefix}${c}`] ||
        (spec.fallbackPrefix ? compData[`${spec.fallbackPrefix}${c}`] : '') ||
        ''
      cells += `<td style="text-align:center;">${val}</td>`
    }
    compParamRows += `<tr>
      <td class="label-col">${spec.label}</td>
      ${cells}
    </tr>`
  }

  let linhaArCells = ''
  for (const c of compressorIndices) {
    const val = compData[`linhaAr${c}`] || ''
    linhaArCells += `<td style="text-align:center; font-weight:bold;">${val}</td>`
  }

  const tableColSpan = Math.max(5, 1 + compressorIndices.length)

  const printHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Planilha de Campo EPA — ${sheet.date}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body { font-family: Calibri, Arial, sans-serif; font-size: 11px; margin: 0; color: #000; background: #fff; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1.5px solid #000; }
    th { background-color: #0b5345; color: #ffffff; border: 1px solid #333; padding: 5px; font-weight: bold; text-align: center; }
    td { border: 1px solid #333; padding: 4px 6px; }
    .header-title { background-color: #0b5345; color: #ffffff; font-size: 14px; font-weight: bold; text-align: center; border: 1.5px solid #000; }
    .section-hdr { background-color: #d1e7dd; color: #0b5345; font-weight: bold; font-size: 11px; border: 1.5px solid #000; }
    .label-col { background-color: #f2f7f5; font-weight: bold; border: 1px solid #333; }
    .no-print-bar {
      background: #1e293b; color: #fff; padding: 10px 16px; display: flex;
      align-items: center; justify-content: space-between; font-size: 13px;
    }
    .no-print-bar button {
      background: #059669; color: #fff; border: none; padding: 8px 18px;
      font-size: 13px; font-weight: 600; border-radius: 6px; cursor: pointer;
    }
    .no-print-bar button:hover { background: #047857; }
    @media print {
      .no-print-bar { display: none !important; }
      body { padding: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div><strong>Grupo EPA — Visualização e Impressão de Planilha de Campo</strong></div>
    <div><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
  </div>

  <div style="padding: 10px;">
    <table>
      <tr>
        <td colspan="${tableColSpan}" class="header-title" style="padding: 10px;">
          Controle Operacional Diário de Remediação
        </td>
      </tr>
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
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 6px;">1. EXTRAÇÃO/VOLUME BOMBEADO</td>
      </tr>
      <tr>
        <th style="width: 20%;">Poço de Remediação</th>
        <th style="width: 20%;">Hidrômetro (Manhã) ${morningTime ? `(${morningTime})` : ''}</th>
        <th style="width: 20%;">Hidrômetro (Tarde) ${afternoonTime ? `(${afternoonTime})` : ''}</th>
        <th style="width: 18%;">Altura da bomba (m)</th>
        <th colspan="${tableColSpan - 4}" style="width: 22%;">Saída Autopump (500mL)*</th>
      </tr>
      ${extractionRows}

      <!-- 2. INFILTRAÇÃO/VOLUME INFILTRADO -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 6px;">2. INFILTRAÇÃO/VOLUME INFILTRADO</td>
      </tr>
      <tr>
        <th style="width: 30%;">Hidrômetro</th>
        <th colspan="2" style="width: 35%;">Manhã ${infMorningTime ? `(${infMorningTime})` : ''}</th>
        <th colspan="${tableColSpan - 3}" style="width: 35%;">Tarde ${infAfternoonTime ? `(${infAfternoonTime})` : ''}</th>
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
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 6px;">3. DOSAGEM DE NUTRIENTES</td>
      </tr>
      <tr>
        <th style="width: 30%;">Realizada (S/N)</th>
        <th colspan="2" style="width: 35%;">Quantidade MAP (Kg)</th>
        <th colspan="${tableColSpan - 3}" style="width: 35%;">Quantidade Ureia (Kg)</th>
      </tr>
      <tr>
        <td style="text-align:center; font-weight:bold;">${sheet.nutrient_done ? 'Sim' : 'Não'}</td>
        <td colspan="2" style="text-align:center; font-weight:bold;">${sheet.nutrient_map_kg || 0}</td>
        <td colspan="${tableColSpan - 3}" style="text-align:center; font-weight:bold;">${sheet.nutrient_ureia_kg || 0}</td>
      </tr>

      <!-- 4. COMPRESSORES -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 6px;">4. COMPRESSORES</td>
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
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 6px;">5. REMOÇÃO DE ÓLEO</td>
      </tr>
      <tr>
        <td colspan="${tableColSpan}" style="background-color:#f9fbf9; font-weight:bold;">Caixa Separadora (SAO 01)</td>
      </tr>
      <tr>
        <td class="label-col">Volume de óleo removido (mL):</td>
        <td colspan="2" style="text-align:center;">${oilData.sao1Volume || ''}</td>
        <td class="label-col">Data da última limpeza:</td>
        <td colspan="${Math.max(1, tableColSpan - 4)}" style="text-align:center; font-weight:bold;">${oilData.sao1DataLimpeza || oilData.sao1Date || ''}</td>
      </tr>
      <tr>
        <td colspan="${tableColSpan}" style="background-color:#f9fbf9; font-weight:bold;">Caixa Separadora (SAO 02)</td>
      </tr>
      <tr>
        <td class="label-col">Volume de óleo removido (mL):</td>
        <td colspan="2" style="text-align:center;">${oilData.sao2Volume || ''}</td>
        <td class="label-col">Data da última limpeza:</td>
        <td colspan="${Math.max(1, tableColSpan - 4)}" style="text-align:center; font-weight:bold;">${oilData.sao2DataLimpeza || oilData.sao2Date || ''}</td>
      </tr>

      <!-- 6. RESÍDUOS SÓLIDOS E LÍQUIDOS -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 6px;">6. RESÍDUOS SÓLIDOS E LÍQUIDOS</td>
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
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 6px;">7. CONTROLES AMBIENTAIS E 5S</td>
      </tr>
      <tr>
        <td class="label-col">5S (S/N):</td>
        <td style="text-align:center; font-weight:bold;">${sheet.env_5s_check ? 'Sim' : 'Não'}</td>
        <td class="label-col">CHECKLIST MENSAL (S/N):</td>
        <td colspan="${tableColSpan - 3}" style="text-align:center; font-weight:bold;">${sheet.env_checklist_monthly ? 'Sim' : 'Não'}</td>
      </tr>

      <!-- 8. OBSERVAÇÕES E MANUTENÇÕES -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 6px;">8. OBSERVAÇÕES E MANUTENÇÕES</td>
      </tr>
      <tr>
        <td colspan="${tableColSpan}" style="padding: 8px; min-height: 40px;">${sheet.observations || '—'}</td>
      </tr>
    </table>
  </div>
</body>
</html>`

  win.document.open()
  win.document.write(printHtml)
  win.document.close()
}
