// 0045 — Configuração de Áreas da Planilha de Campo (parte administrativa)
//
// Nova coleção `area_configs`: o Admin cadastra cada área (nome/localidade,
// contrato padrão, descrição) e pré-preenche os valores padronizados dos campos
// da Planilha de Campo para aquela área (JSON por seção/campo — mesmo mapeamento
// de `src/lib/fieldSheetConfigMetadata.ts`). Compatível com a regra do produto:
// o bloqueio ao Técnico é condicional ao CONTEÚDO (campo preenchido pelo Admin
// fica travado; campo vazio o Técnico preenche livremente) — o JSON guarda
// apenas os valores, e a trava já existente (isFieldLockedByAdmin) continuará
// derivando dela na integração com o preenchimento (próxima rodada).
//
// Escolha de modelo: coleção NOVA (e não extensão de `areas`) porque `areas`
// hoje é só uma lista de nomes usada na seleção múltipla; separar mantém essa
// lista intacta (zero risco de sync) e dá versionamento/snapshot próprios.
//
// Desativação lógica (sem exclusão física): flag `active`.
// Regras de acesso: leitura para autenticados (o Técnico precisará ler na
// próxima rodada); escrita (create/update/delete) somente Admin — reforçada
// também no hook `area_configs_guard.js` (defesa em profundidade + auditoria).
migrate(
  (app) => {
    const areaConfigsCollection = new Collection({
      name: 'area_configs',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'admin'",
      updateRule: "@request.auth.role = 'admin'",
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        { name: 'area_name', type: 'text', required: true },
        { name: 'contract_number', type: 'text' },
        { name: 'description', type: 'text' },
        { name: 'preset_fields', type: 'json' },
        { name: 'active', type: 'bool' },
        { name: 'config_version', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_area_configs_name ON area_configs (area_name)'],
    })
    app.save(areaConfigsCollection)
  },
  (app) => {
    // Rollback: remove a coleção criada
    try {
      const col = app.findCollectionByNameOrId('area_configs')
      if (col) app.delete(col)
    } catch (_) {}
  },
)
