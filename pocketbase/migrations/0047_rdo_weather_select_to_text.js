/// <reference path="../pb_data/types.d.ts" />
// 0047: converte reports_rdo.weather de select (Sol/Chuva/Nublado/Instável) para text.
// Causa raiz do "RDO não salva": a UI envia 'Ensolarado'/'Chuvoso'/'Outros' ou texto
// livre, e o campo select rejeitava todo CREATE/UPDATE com 400
// "Failed to create record". Tabela está vazia em produção (nunca salvou com o
// select atual), portanto a troca de tipo é segura.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('reports_rdo')
    col.fields.removeByName('weather')
    col.fields.add(new TextField({ name: 'weather', required: true, max: 120 }))
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('reports_rdo')
    col.fields.removeByName('weather')
    col.fields.add(
      new SelectField({
        name: 'weather',
        required: true,
        maxSelect: 1,
        values: ['Sol', 'Chuva', 'Nublado', 'Instável'],
      }),
    )
    app.save(col)
  },
)
