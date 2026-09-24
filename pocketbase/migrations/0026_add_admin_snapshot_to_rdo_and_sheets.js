// Migração 0026: Adiciona admin_snapshot (JSONField) em reports_rdo e field_spreadsheets
// e popula os registros existentes (como vpi5qwu1menje5l) para que o Técnico não possa
// editar campos preenchidos pelo Administrador mesmo em modo offline/sem expand
migrate(
  (app) => {
    // 1. reports_rdo: adicionar admin_snapshot
    const reportsCol = app.findCollectionByNameOrId('reports_rdo')
    if (!reportsCol.fields.getByName('admin_snapshot')) {
      reportsCol.fields.add(
        new JSONField({
          name: 'admin_snapshot',
          required: false,
        }),
      )
      app.save(reportsCol)
    }

    // 2. field_spreadsheets: adicionar admin_snapshot
    const sheetsCol = app.findCollectionByNameOrId('field_spreadsheets')
    if (!sheetsCol.fields.getByName('admin_snapshot')) {
      sheetsCol.fields.add(
        new JSONField({
          name: 'admin_snapshot',
          required: false,
        }),
      )
      app.save(sheetsCol)
    }

    // 3. Atualizar o RDO vpi5qwu1menje5l existente se existir
    try {
      const existingRdo = app.findFirstRecordByData('reports_rdo', 'id', 'vpi5qwu1menje5l')
      if (existingRdo) {
        let supervisorName = ''
        const supId = existingRdo.getString('supervised_by')
        if (supId) {
          try {
            const supUser = app.findFirstRecordByData('users', 'id', supId)
            if (supUser) {
              supervisorName = supUser.getString('name')
            }
          } catch (_) {}
        }

        // Buscar poços de report_wells para este RDO caso existam
        let wells = []
        try {
          const rwList = app.findRecordsByFilter(
            'report_wells',
            'report = {:rep}',
            'created',
            50,
            0,
            {
              rep: 'vpi5qwu1menje5l',
            },
          )
          if (rwList && rwList.length > 0) {
            wells = rwList.map((rw) => ({
              well_id: rw.getString('well_id'),
              depth: rw.get('depth'),
              completion_date: rw.getString('completion_date'),
              diameter: rw.getString('diameter'),
            }))
          }
        } catch (_) {}

        const snapshot = {
          supervised_by_name: supervisorName || 'Annik Almeida',
          supervised_by: supId || '',
          empresa_executora:
            existingRdo.getString('empresa_executora') || 'EPA Engenharia de Proteção Ambiental',
          wells: wells,
          captured_at: new Date().toISOString(),
        }

        existingRdo.set('admin_snapshot', snapshot)
        app.save(existingRdo)
      }
    } catch (_) {
      // Se não encontrar o RDO vpi5qwu1menje5l, ignora
    }
  },
  (app) => {
    try {
      const reportsCol = app.findCollectionByNameOrId('reports_rdo')
      const field = reportsCol.fields.getByName('admin_snapshot')
      if (field) reportsCol.fields.removeById(field.id)
      app.save(reportsCol)
    } catch (_) {}

    try {
      const sheetsCol = app.findCollectionByNameOrId('field_spreadsheets')
      const field = sheetsCol.fields.getByName('admin_snapshot')
      if (field) sheetsCol.fields.removeById(field.id)
      app.save(sheetsCol)
    } catch (_) {}
  },
)
