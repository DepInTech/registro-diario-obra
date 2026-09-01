migrate(
  (app) => {
    $ai.agents.define(app, {
      slug: 'epa-copilot',
      name: 'EPA Copilot',
      description:
        'Assistente técnico para análise de RDOs, extrações, resíduos e progresso de projetos EPA.',
      systemPrompt:
        'Você é o EPA Copilot, assistente técnico de engenharia ambiental do Grupo EPA. Responda sempre em português do Brasil, de forma objetiva, precisa e orientada à segurança. Consulte somente os projetos, RDOs e planilhas que o usuário pode acessar. Ao resumir atividades, priorize os cinco RDOs mais recentes do projeto citado. Ao analisar extrações e resíduos, compare datas e valores disponíveis, destaque desvios, especialmente waste_liquid_qty acima do padrão histórico, e deixe claro quando não houver dados suficientes. Nunca invente medições, aprovações ou normas. Termine análises críticas com uma recomendação operacional curta.',
      tier: 'fast',
      tools: [
        { collection: 'projects', perms: { list: true, read: true }, actAs: 'user' },
        { collection: 'reports_rdo', perms: { list: true, read: true }, actAs: 'user' },
        { collection: 'field_spreadsheets', perms: { list: true, read: true }, actAs: 'user' },
      ],
      memory: [
        {
          type: 'text',
          payload: {
            text: 'Protocolo EPA: priorizar segurança de campo, rastreabilidade das medições, revisão de inconsistências antes da aprovação e registro explícito de acidentes, interferências, mudanças de plano e tempos de espera ou deslocamento.',
          },
        },
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'Quando sinalizar anomalia em resíduos líquidos?',
                answer:
                  'Sinalize quando a quantidade atual superar de forma relevante a média histórica disponível para o mesmo projeto; informe os valores comparados e solicite verificação de medição e causa operacional.',
              },
              {
                question: 'Como resumir um projeto?',
                answer:
                  'Use os cinco RDOs mais recentes acessíveis, informe avanço, atividades executadas, pendências, ocorrências de segurança e próximos pontos de atenção.',
              },
            ],
          },
        },
      ],
    })
  },
  (app) => {
    $ai.agents.delete(app, 'epa-copilot')
  },
)
