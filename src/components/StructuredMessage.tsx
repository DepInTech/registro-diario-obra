import React from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  FileSpreadsheet,
  FileText,
  Info,
  Layers,
  Lightbulb,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  User,
  Wrench,
  Camera,
  Activity,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface StructuredMessageProps {
  content: string
}

// Helper to clean markdown bold markers and trim
function cleanText(text: string) {
  return text.replace(/\*\*/g, '').trim()
}

// Parse markdown table rows
function parseMarkdownTable(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.endsWith('|'))

  if (lines.length < 2) return null

  const parseRow = (line: string) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())

  const headers = parseRow(lines[0])
  // Skip separator row (| :--- | :--- |)
  const contentLines = lines.slice(1).filter((l) => !l.replace(/[\s|:-]/g, '').length === false)
  const rows = contentLines.map(parseRow)

  return { headers, rows }
}

export function StructuredMessage({ content }: StructuredMessageProps) {
  // If content is simple (e.g. user question or short error), render clean formatted paragraphs
  const hasSections =
    content.includes('###') ||
    content.includes('##') ||
    content.includes('📋') ||
    content.includes('📊') ||
    content.includes('📌') ||
    content.includes('📝') ||
    content.includes('🦺') ||
    content.includes('⚠️') ||
    content.includes('💡') ||
    content.includes('🎯')

  if (!hasSections) {
    return (
      <div className="space-y-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
        {content.split('\n\n').map((para, i) => (
          <p key={i} className="whitespace-pre-line">
            {renderInlineMarkdown(para)}
          </p>
        ))}
      </div>
    )
  }

  // Split content into major logical blocks based on headers
  const blocks = splitIntoBlocks(content)

  return (
    <div className="space-y-4 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
      {blocks.map((block, idx) => (
        <BlockRenderer key={idx} block={block} />
      ))}
    </div>
  )
}

interface Block {
  type:
    | 'project_header'
    | 'executive_summary'
    | 'indicators'
    | 'last_rdo'
    | 'activities'
    | 'recent_rdos'
    | 'safety'
    | 'interferences'
    | 'pending'
    | 'wells'
    | 'photos'
    | 'evolution'
    | 'alerts'
    | 'next_steps'
    | 'recommendations'
    | 'general_situation'
    | 'table'
    | 'generic'
  title?: string
  content: string
}

function splitIntoBlocks(raw: string): Block[] {
  const blocks: Block[] = []
  const lines = raw.split('\n')
  let currentHeader = ''
  let currentLines: string[] = []

  const flush = () => {
    if (currentLines.length === 0 && !currentHeader) return
    const text = currentLines.join('\n').trim()
    if (!text && !currentHeader) return

    const blockType = classifyBlock(currentHeader, text)
    blocks.push({
      type: blockType,
      title: currentHeader,
      content: text,
    })
    currentLines = []
  }

  for (const line of lines) {
    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
      flush()
      currentHeader = line.replace(/^#{1,3}\s+/, '').trim()
    } else if (line.trim() === '---') {
      // separator, keep splitting if needed
      flush()
      currentHeader = ''
    } else {
      currentLines.push(line)
    }
  }
  flush()

  return blocks
}

function classifyBlock(header: string, content: string): Block['type'] {
  const h = header.toLowerCase()
  if (
    h.includes('visão geral') ||
    h.includes('acompanhamento ambiental') ||
    (h.includes('projeto') && h.includes('📋'))
  ) {
    return 'project_header'
  }
  if (h.includes('resumo executivo') || h.includes('📊')) return 'executive_summary'
  if (h.includes('indicadores') || h.includes('📌 indicadores')) return 'indicators'
  if (h.includes('último rdo') || h.includes('📝')) return 'last_rdo'
  if (h.includes('atividades realizadas') || h.includes('🔧')) return 'activities'
  if (h.includes('últimos rdos') || h.includes('📑')) return 'recent_rdos'
  if (h.includes('segurança') || h.includes('🦺')) return 'safety'
  if (h.includes('interferências') || h.includes('alterações') || h.includes('⚠️ interferências'))
    return 'interferences'
  if (h.includes('pendências') || h.includes('📌 pendências')) return 'pending'
  if (h.includes('poços') || h.includes('🕳️')) return 'wells'
  if (h.includes('registro fotográfico') || h.includes('fotografias') || h.includes('📷'))
    return 'photos'
  if (h.includes('evolução') || h.includes('📈')) return 'evolution'
  if (h.includes('pontos de atenção') || h.includes('alertas') || h.includes('🚨')) return 'alerts'
  if (h.includes('próximos passos') || h.includes('🎯')) return 'next_steps'
  if (h.includes('recomendações') || h.includes('💡')) return 'recommendations'
  if (h.includes('situação geral') || h.includes('🟢 situação geral')) return 'general_situation'

  if (content.trim().startsWith('|') && content.includes('|')) return 'table'
  return 'generic'
}

function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case 'project_header':
      return <ProjectHeaderBlock title={block.title} content={block.content} />
    case 'executive_summary':
      return <ExecutiveSummaryBlock title={block.title} content={block.content} />
    case 'indicators':
      return <IndicatorsBlock title={block.title} content={block.content} />
    case 'last_rdo':
      return <LastRdoBlock title={block.title} content={block.content} />
    case 'activities':
      return <ActivitiesBlock title={block.title} content={block.content} />
    case 'recent_rdos':
      return <RecentRdosBlock title={block.title} content={block.content} />
    case 'safety':
      return <SafetyBlock title={block.title} content={block.content} />
    case 'interferences':
      return <InterferencesBlock title={block.title} content={block.content} />
    case 'pending':
      return <PendingBlock title={block.title} content={block.content} />
    case 'wells':
      return <WellsBlock title={block.title} content={block.content} />
    case 'photos':
      return <PhotosBlock title={block.title} content={block.content} />
    case 'evolution':
      return <EvolutionBlock title={block.title} content={block.content} />
    case 'alerts':
      return <AlertsBlock title={block.title} content={block.content} />
    case 'next_steps':
      return <NextStepsBlock title={block.title} content={block.content} />
    case 'recommendations':
      return <RecommendationsBlock title={block.title} content={block.content} />
    case 'general_situation':
      return <GeneralSituationBlock title={block.title} content={block.content} />
    case 'table':
      return <TableBlock content={block.content} title={block.title} />
    default:
      return <GenericBlock title={block.title} content={block.content} />
  }
}

// 1. Cabeçalho do Projeto
function ProjectHeaderBlock({ title, content }: { title?: string; content: string }) {
  // Extract key-values like **Projeto:** X
  const items: Array<{ label: string; value: string }> = []
  const lines = content.split('\n')

  lines.forEach((line) => {
    // Matches like **Projeto:** X or **Código:** EPA-ACL-03 / **Status:** Ativo
    const parts = line.split('/')
    parts.forEach((p) => {
      const match = p.match(/\*\*([^*:]+):\*\*\s*(.*)/)
      if (match) {
        items.push({ label: match[1].trim(), value: cleanText(match[2]) })
      }
    })
  })

  return (
    <Card className="overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-4 shadow-sm dark:border-emerald-500/20">
      <div className="flex items-center gap-2 border-b border-emerald-500/20 pb-2.5">
        <span className="text-lg">📋</span>
        <h4 className="font-bold text-slate-900 dark:text-emerald-300">
          {title || 'Visão Geral do Projeto'}
        </h4>
      </div>

      {items.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg bg-white/70 p-2 dark:bg-slate-900/60">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {it.label}
              </span>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                {renderStatusEmoji(it.value)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {content}
        </div>
      )}
    </Card>
  )
}

// 2. Resumo Executivo
function ExecutiveSummaryBlock({ title, content }: { title?: string; content: string }) {
  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-50/50 p-3.5 dark:border-blue-500/20 dark:bg-blue-950/20">
      <div className="mb-2 flex items-center gap-2 text-blue-900 dark:text-blue-300">
        <span className="text-base">📊</span>
        <h4 className="font-bold">{title || 'Resumo Executivo'}</h4>
      </div>
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {renderInlineMarkdown(content)}
      </p>
    </div>
  )
}

// 3. Indicadores Principais
function IndicatorsBlock({ title, content }: { title?: string; content: string }) {
  const table = parseMarkdownTable(content)

  if (!table) {
    return (
      <Card className="p-3.5">
        <div className="mb-2 flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
          <span>📌</span> {title || 'Indicadores'}
        </div>
        <div className="text-sm">{renderInlineMarkdown(content)}</div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden border-slate-200 p-3.5 shadow-sm dark:border-slate-800">
      <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
        <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h4 className="font-bold text-slate-900 dark:text-slate-100">
          {title || 'Indicadores Principais'}
        </h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
              {table.headers.map((h, i) => (
                <th key={i} className="p-2 font-semibold text-slate-600 dark:text-slate-300">
                  {cleanText(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {table.rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="p-2 text-slate-700 dark:text-slate-300">
                    {renderStatusEmoji(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// 4. Último RDO
function LastRdoBlock({ title, content }: { title?: string; content: string }) {
  const lines = content.split('\n').filter((l) => l.trim().length > 0)

  return (
    <Card className="border-slate-200 p-3.5 shadow-sm dark:border-slate-800">
      <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
        <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h4 className="font-bold text-slate-900 dark:text-slate-100">{title || 'Último RDO'}</h4>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {lines.map((line, idx) => {
          // Check for bullet key-value
          const match = line.match(/^[-*]?\s*\*\*([^*:]+):\*\*\s*(.*)/)
          if (match) {
            return (
              <div key={idx} className="rounded-md bg-slate-50 p-2 text-xs dark:bg-slate-900/50">
                <span className="font-semibold text-slate-600 dark:text-slate-400">
                  {match[1].trim()}:
                </span>{' '}
                <span className="text-slate-800 dark:text-slate-200">
                  {renderStatusEmoji(match[2].trim())}
                </span>
              </div>
            )
          }
          return (
            <div key={idx} className="col-span-2 text-xs text-slate-700 dark:text-slate-300">
              {renderInlineMarkdown(line)}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// 5. Atividades Realizadas
function ActivitiesBlock({ title, content }: { title?: string; content: string }) {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  return (
    <Card className="border-slate-200 p-3.5 shadow-sm dark:border-slate-800">
      <div className="mb-2.5 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
        <Wrench className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h4 className="font-bold text-slate-900 dark:text-slate-100">
          {title || 'Atividades Realizadas'}
        </h4>
      </div>
      <div className="space-y-1.5">
        {lines.map((line, idx) => {
          const clean = line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '')
          return (
            <div
              key={idx}
              className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 p-2 text-xs dark:border-slate-800/60 dark:bg-slate-900/40"
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {idx + 1}
              </span>
              <span className="leading-relaxed text-slate-700 dark:text-slate-300">
                {renderInlineMarkdown(clean)}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// 6. Últimos RDOs (Tabela)
function RecentRdosBlock({ title, content }: { title?: string; content: string }) {
  const table = parseMarkdownTable(content)

  if (!table) {
    return (
      <Card className="p-3.5">
        <div className="mb-2 font-bold">{title || 'Últimos RDOs'}</div>
        <div className="text-xs">{renderInlineMarkdown(content)}</div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden border-slate-200 p-3.5 shadow-sm dark:border-slate-800">
      <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
        <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h4 className="font-bold text-slate-900 dark:text-slate-100">
          {title || 'Últimos RDOs Registrados'}
        </h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
              {table.headers.map((h, i) => (
                <th
                  key={i}
                  className="whitespace-nowrap p-2 font-semibold text-slate-600 dark:text-slate-300"
                >
                  {cleanText(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {table.rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className="whitespace-nowrap p-2 text-slate-700 dark:text-slate-300"
                  >
                    {renderStatusEmoji(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// 7. Segurança
function SafetyBlock({ title, content }: { title?: string; content: string }) {
  const hasAccident =
    content.toLowerCase().includes('acidente registrado') ||
    content.toLowerCase().includes('🔴') ||
    content.toLowerCase().includes('atenção')

  return (
    <div
      className={`rounded-xl border p-3.5 ${
        hasAccident
          ? 'border-red-300 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20'
          : 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        {hasAccident ? (
          <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
        ) : (
          <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        )}
        <h4 className="font-bold text-slate-900 dark:text-slate-100">{title || 'Segurança'}</h4>
      </div>
      <div className="space-y-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
        {content.split('\n').map((line, idx) => (
          <p key={idx}>{renderInlineMarkdown(line)}</p>
        ))}
      </div>
    </div>
  )
}

// 8. Interferências e Alterações
function InterferencesBlock({ title, content }: { title?: string; content: string }) {
  const isClear =
    content.toLowerCase().includes('nenhuma interferência') ||
    content.toLowerCase().includes('não houve')

  return (
    <div
      className={`rounded-xl border p-3.5 ${
        isClear
          ? 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/30'
          : 'border-amber-300 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle
          className={`h-4 w-4 ${isClear ? 'text-slate-500' : 'text-amber-600 dark:text-amber-400'}`}
        />
        <h4 className="font-bold text-slate-900 dark:text-slate-100">
          {title || 'Interferências e Alterações'}
        </h4>
      </div>
      <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
        {renderInlineMarkdown(content)}
      </div>
    </div>
  )
}

// 9. Pendências
function PendingBlock({ title, content }: { title?: string; content: string }) {
  const table = parseMarkdownTable(content)
  const isNone =
    content.toLowerCase().includes('não existem pendências') ||
    content.toLowerCase().includes('sem pendências')

  return (
    <Card
      className={`p-3.5 ${
        isNone
          ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-950 dark:bg-emerald-950/10'
          : 'border-amber-200 bg-amber-50/30 dark:border-amber-950 dark:bg-amber-950/10'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-base">📌</span>
        <h4 className="font-bold text-slate-900 dark:text-slate-100">{title || 'Pendências'}</h4>
      </div>
      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/60 dark:border-slate-800 dark:bg-slate-800/40">
                {table.headers.map((h, i) => (
                  <th key={i} className="p-2 font-semibold">
                    {cleanText(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-slate-100 dark:border-slate-800">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-2">
                      {renderStatusEmoji(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          {renderInlineMarkdown(content)}
        </div>
      )}
    </Card>
  )
}

// 10. Poços
function WellsBlock({ title, content }: { title?: string; content: string }) {
  const table = parseMarkdownTable(content)

  return (
    <Card className="overflow-hidden border-slate-200 p-3.5 shadow-sm dark:border-slate-800">
      <div className="mb-2.5 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
        <span className="text-base">🕳️</span>
        <h4 className="font-bold text-slate-900 dark:text-slate-100">
          {title || 'Poços de Monitoramento'}
        </h4>
      </div>
      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
                {table.headers.map((h, i) => (
                  <th key={i} className="p-2 font-semibold text-slate-600 dark:text-slate-300">
                    {cleanText(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {table.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-2 text-slate-700 dark:text-slate-300">
                      {renderStatusEmoji(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-xs text-slate-700 dark:text-slate-300">
          {renderInlineMarkdown(content)}
        </div>
      )}
    </Card>
  )
}

// 11. Fotos
function PhotosBlock({ title, content }: { title?: string; content: string }) {
  return (
    <Card className="border-slate-200 p-3.5 shadow-sm dark:border-slate-800">
      <div className="mb-2 flex items-center gap-2">
        <Camera className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h4 className="font-bold text-slate-900 dark:text-slate-100">
          {title || 'Registro Fotográfico'}
        </h4>
      </div>
      <div className="text-xs text-slate-700 dark:text-slate-300">
        {renderInlineMarkdown(content)}
      </div>
    </Card>
  )
}

// 12. Evolução
function EvolutionBlock({ title, content }: { title?: string; content: string }) {
  return (
    <Card className="border-slate-200 p-3.5 shadow-sm dark:border-slate-800">
      <div className="mb-2 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <h4 className="font-bold text-slate-900 dark:text-slate-100">
          {title || 'Evolução das Atividades'}
        </h4>
      </div>
      <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
        {renderInlineMarkdown(content)}
      </div>
    </Card>
  )
}

// 13. Pontos de Atenção / Alertas
function AlertsBlock({ title, content }: { title?: string; content: string }) {
  return (
    <div className="rounded-xl border border-amber-300/80 bg-amber-50/50 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="mb-2 flex items-center gap-2 text-amber-900 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <h4 className="font-bold">{title || 'Pontos de Atenção'}</h4>
      </div>
      <div className="space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
        {content.split('\n').map((line, idx) => (
          <p key={idx}>{renderInlineMarkdown(line)}</p>
        ))}
      </div>
    </div>
  )
}

// 14. Próximos Passos
function NextStepsBlock({ title, content }: { title?: string; content: string }) {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  return (
    <Card className="border-slate-200 p-3.5 shadow-sm dark:border-slate-800">
      <div className="mb-2.5 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
        <span className="text-base">🎯</span>
        <h4 className="font-bold text-slate-900 dark:text-slate-100">
          {title || 'Próximos Passos'}
        </h4>
      </div>
      <div className="space-y-2">
        {lines.map((line, idx) => {
          const isCopilotSuggestion = line.toLowerCase().includes('sugestão do copilot')
          const clean = line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '')
          return (
            <div
              key={idx}
              className={`flex items-start gap-2.5 rounded-lg p-2 text-xs ${
                isCopilotSuggestion
                  ? 'border border-teal-200 bg-teal-50/60 dark:border-teal-900/40 dark:bg-teal-950/20'
                  : 'border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40'
              }`}
            >
              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="flex-1 leading-relaxed text-slate-700 dark:text-slate-300">
                {renderInlineMarkdown(clean)}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// 15. Recomendações
function RecommendationsBlock({ title, content }: { title?: string; content: string }) {
  return (
    <div className="rounded-xl border border-teal-500/30 bg-teal-50/40 p-3.5 dark:border-teal-500/20 dark:bg-teal-950/20">
      <div className="mb-2 flex items-center gap-2 text-teal-900 dark:text-teal-300">
        <Lightbulb className="h-4 w-4 text-teal-600 dark:text-teal-400" />
        <h4 className="font-bold">{title || 'Recomendações Técnicas'}</h4>
      </div>
      <div className="space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
        {content.split('\n').map((line, idx) => (
          <p key={idx}>{renderInlineMarkdown(line)}</p>
        ))}
      </div>
    </div>
  )
}

// 16. Situação Geral (Destaque final)
function GeneralSituationBlock({ title, content }: { title?: string; content: string }) {
  return (
    <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent p-3.5 text-center shadow-sm dark:border-emerald-500/30">
      <div className="mb-1 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
        <span>🟢</span>
        <span>{title || 'Situação Geral'}</span>
      </div>
      <div className="text-xs font-bold uppercase tracking-wide text-emerald-950 dark:text-emerald-100">
        {cleanText(content)}
      </div>
    </div>
  )
}

// Tabela genérica
function TableBlock({ content, title }: { content: string; title?: string }) {
  const table = parseMarkdownTable(content)
  if (!table) {
    return <div className="text-xs">{content}</div>
  }
  return (
    <Card className="overflow-hidden border-slate-200 p-3 shadow-sm dark:border-slate-800">
      {title && (
        <div className="mb-2 text-xs font-bold text-slate-800 dark:text-slate-200">{title}</div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
              {table.headers.map((h, i) => (
                <th key={i} className="p-2 font-semibold">
                  {cleanText(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {table.rows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="p-2">
                    {renderStatusEmoji(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// Bloco Genérico
function GenericBlock({ title, content }: { title?: string; content: string }) {
  return (
    <div className="space-y-1.5">
      {title && <h4 className="font-bold text-slate-900 dark:text-slate-100">{title}</h4>}
      <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
        {content.split('\n').map((line, idx) => (
          <p key={idx}>{renderInlineMarkdown(line)}</p>
        ))}
      </div>
    </div>
  )
}

// Inline markdown renderer for bold, quotes, and badges
function renderInlineMarkdown(text: string): React.ReactNode {
  if (text.startsWith('>')) {
    const cleanQuote = text.replace(/^>\s*/, '')
    return (
      <div className="my-1.5 rounded-r-lg border-l-4 border-emerald-500 bg-slate-50 py-1.5 pl-3 pr-2 text-xs italic text-slate-600 dark:bg-slate-900/50 dark:text-slate-400">
        {renderInlineMarkdown(cleanQuote)}
      </div>
    )
  }

  // Parse **bold**
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2)
      return (
        <strong key={index} className="font-semibold text-slate-900 dark:text-slate-100">
          {inner}
        </strong>
      )
    }
    return part
  })
}

// Renders emojis with color accents if recognized
function renderStatusEmoji(val: string): React.ReactNode {
  const trimmed = cleanText(val)
  if (trimmed.includes('🟢')) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
        <span>🟢</span> {trimmed.replace('🟢', '').trim()}
      </span>
    )
  }
  if (trimmed.includes('🟡')) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
        <span>🟡</span> {trimmed.replace('🟡', '').trim()}
      </span>
    )
  }
  if (trimmed.includes('🔴')) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-red-700 dark:text-red-400">
        <span>🔴</span> {trimmed.replace('🔴', '').trim()}
      </span>
    )
  }
  return trimmed
}
