import {
  Check,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  Users2,
  Wrench,
} from 'lucide-react'
import { users } from '@/data/epa'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const roleConfig = {
  admin: { label: 'Administrador', icon: ShieldCheck, style: 'bg-violet-50 text-violet-700' },
  operator: { label: 'Operador', icon: UserCog, style: 'bg-blue-50 text-blue-700' },
  technician: { label: 'Técnico', icon: Wrench, style: 'bg-emerald-50 text-emerald-700' },
}
export function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="epa-card flex items-center gap-4 p-5">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100">
            <Users2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-semibold">8</p>
            <p className="text-xs text-slate-500">Usuários cadastrados</p>
          </div>
        </div>
        <div className="epa-card flex items-center gap-4 p-5">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <Check className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-semibold">7</p>
            <p className="text-xs text-slate-500">Acessos ativos</p>
          </div>
        </div>
        <div className="epa-card flex items-center gap-4 p-5">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <UserCog className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-semibold">6</p>
            <p className="text-xs text-slate-500">Atribuições de projeto</p>
          </div>
        </div>
      </div>
      <section className="epa-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Buscar nome ou e-mail..." />
          </div>
          <Button className="w-fit bg-emerald-700 hover:bg-emerald-800">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar usuário
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Usuário</th>
                <th className="px-5 py-3 font-semibold">Perfil</th>
                <th className="px-5 py-3 font-semibold">Projetos</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => {
                const role = roleConfig[user.role]
                const Icon = role.icon
                return (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-[10px] font-bold">
                          {user.name
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-slate-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${role.style}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {role.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm">{user.projects} atribuídos</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Ativo
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-800">
        <b>Controle por projeto:</b> operadores e técnicos visualizam somente os projetos em que
        estão atribuídos. Administradores possuem acesso global e são responsáveis pelas aprovações
        e exportações.
      </div>
    </div>
  )
}
