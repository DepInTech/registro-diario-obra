import { CalendarDays, Download, Filter, Search, ShieldCheck } from 'lucide-react'
import { auditEvents } from '@/data/epa'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const rows = [
  ...auditEvents,
  {
    id: 'a6',
    user: 'Carlos Oliveira',
    initials: 'CO',
    action: 'exportou a Planilha de Campo em Excel',
    entity: 'Acompanhamento Ambiental Açailândia',
    time: '26 mai, 14:20',
    color: 'blue',
  },
  {
    id: 'a7',
    user: 'Annik Almeida',
    initials: 'AA',
    action: 'atualizou as atribuições do projeto',
    entity: 'Recuperação Ambiental Lote A',
    time: '26 mai, 10:02',
    color: 'violet',
  },
]
export function AuditPage() {
  return (
    <div className="space-y-6">
      <section className="epa-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-5 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Buscar ação, usuário ou entidade..." />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="text-xs">
              <CalendarDays className="mr-2 h-4 w-4" />
              Últimos 30 dias
            </Button>
            <Button variant="outline" className="text-xs">
              <Filter className="mr-2 h-4 w-4" />
              Todas as ações
            </Button>
            <Button variant="outline" className="text-xs">
              <Download className="mr-2 h-4 w-4" />
              Exportar trilha
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Responsável</th>
                <th className="px-5 py-3">Ação registrada</th>
                <th className="px-5 py-3">Entidade</th>
                <th className="px-5 py-3">Data e hora</th>
                <th className="px-5 py-3">Integridade</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-[9px] font-bold">
                        {row.initials}
                      </span>
                      <span className="text-sm font-medium">{row.user}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">{row.action}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px]">
                      {row.entity}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500">{row.time}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
                      <ShieldCheck className="h-4 w-4" />
                      Verificado
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-center text-xs text-slate-400">
        A trilha de auditoria é imutável e registra criações, alterações, exclusões, aprovações,
        devoluções e exportações.
      </p>
    </div>
  )
}
