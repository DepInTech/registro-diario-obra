migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    let admin
    try {
      admin = app.findAuthRecordByEmail('_pb_users_auth_', 'admin@grupoepa.com.br')
    } catch (_) {
      admin = new Record(users)
      admin.setEmail('admin@grupoepa.com.br')
      admin.setPassword('Skip@2025')
      admin.setVerified(true)
      admin.set('name', 'Administrador EPA')
      admin.set('role', 'admin')
      admin.set('active', true)
      app.save(admin)
    }
    let adminAlt
    try {
      adminAlt = app.findAuthRecordByEmail('_pb_users_auth_', 'annik_almeida@grupoepa.com.br')
    } catch (_) {
      adminAlt = new Record(users)
      adminAlt.setEmail('annik_almeida@grupoepa.com.br')
      adminAlt.setPassword('Skip@Pass')
      adminAlt.setVerified(true)
      adminAlt.set('name', 'Annik Almeida')
      adminAlt.set('role', 'admin')
      adminAlt.set('active', true)
      app.save(adminAlt)
    }
    let operator
    try {
      operator = app.findAuthRecordByEmail('_pb_users_auth_', 'operador@grupoepa.com.br')
    } catch (_) {
      operator = new Record(users)
      operator.setEmail('operador@grupoepa.com.br')
      operator.setPassword('Skip@2025')
      operator.setVerified(true)
      operator.set('name', 'Carlos Oliveira')
      operator.set('role', 'operator')
      operator.set('active', true)
      app.save(operator)
    }
    let technician
    try {
      technician = app.findAuthRecordByEmail('_pb_users_auth_', 'tecnico@grupoepa.com.br')
    } catch (_) {
      technician = new Record(users)
      technician.setEmail('tecnico@grupoepa.com.br')
      technician.setPassword('Skip@2025')
      technician.setVerified(true)
      technician.set('name', 'Marina Santos')
      technician.set('role', 'technician')
      technician.set('active', true)
      app.save(technician)
    }

    let client
    try {
      client = app.findFirstRecordByData('clients', 'name', 'Suzano Papel e Celulose')
    } catch (_) {
      client = new Record(app.findCollectionByNameOrId('clients'))
      client.set('name', 'Suzano Papel e Celulose')
      client.set('document', '16.404.287/0001-55')
      client.set('contact', 'Gestão Ambiental')
      app.save(client)
    }
    let company
    try {
      company = app.findFirstRecordByData('companies', 'name', 'Grupo EPA Engenharia')
    } catch (_) {
      company = new Record(app.findCollectionByNameOrId('companies'))
      company.set('name', 'Grupo EPA Engenharia')
      company.set('document', '08.745.384/0001-86')
      app.save(company)
    }
    let area
    try {
      area = app.findFirstRecordByData('areas', 'name', 'Área de Remediação')
    } catch (_) {
      area = new Record(app.findCollectionByNameOrId('areas'))
      area.set('name', 'Área de Remediação')
      area.set('description', 'Sistema de extração e tratamento')
      app.save(area)
    }
    let contract
    try {
      contract = app.findFirstRecordByData('contracts', 'code', 'EPA-2025-014')
    } catch (_) {
      contract = new Record(app.findCollectionByNameOrId('contracts'))
      contract.set('code', 'EPA-2025-014')
      contract.set('client', client.id)
      contract.set('company', company.id)
      contract.set('start_date', '2025-01-15 00:00:00.000Z')
      contract.set('end_date', '2026-12-31 00:00:00.000Z')
      contract.set('status', 'active')
      app.save(contract)
    }
    let project
    try {
      project = app.findFirstRecordByData('projects', 'epa_code', 'EPA-ACL-03')
    } catch (_) {
      project = new Record(app.findCollectionByNameOrId('projects'))
      project.set('name', 'Acompanhamento Ambiental Açailândia')
      project.set('client', client.id)
      project.set('contract', contract.id)
      project.set('company', company.id)
      project.set('area', area.id)
      project.set('location', 'Açailândia - MA')
      project.set('epa_code', 'EPA-ACL-03')
      project.set('progress', 68)
      project.set('status', 'active')
      app.save(project)
    }

    const wellIds = [
      'AS-26',
      'AS-27',
      'AS-28',
      'AS-29',
      'AS-30',
      'AS-31',
      'AS-32',
      'AS-33',
      'AS-34',
      'AS-35',
      'PB-127',
      'PB-128',
      'PB-129',
      'PB-130',
      'PB-131',
      'PB-132',
      'PB-134',
      'PB-136',
      'PB-137',
      'PB-138',
      'PB-140',
      'PB-141',
      'PB-25',
      'PB-26',
      'PB-27',
      'PB-28',
      'PB-29',
      'PB-30',
      'PB-31',
      'PB-33',
      'PB-34',
      'PB-35',
      'PB-36',
      'PB-37',
      'PB-38',
      'PB-39',
      'PB-40',
      'PB-41',
      'PB-42',
      'PM-18',
      'PM-19',
      'PM-20',
      'PM-21',
      'PM-37',
      'PM-38',
      'PM-48',
      'PM-49',
      'PM-51',
      'PM-52',
      'PM-53',
    ]
    const wells = app.findCollectionByNameOrId('wells')
    wellIds.forEach((id) => {
      try {
        app.findFirstRecordByData('wells', 'identification', id)
      } catch (_) {
        const record = new Record(wells)
        record.set('project', project.id)
        record.set('identification', id)
        record.set(
          'default_diameter',
          id.indexOf('AS-') === 0 ? '1/2"' : id.indexOf('PM-') === 0 ? '2"' : '4"',
        )
        record.set('active', true)
        app.save(record)
      }
    })

    let report
    try {
      report = app.findFirstRecordByData(
        'reports_rdo',
        'activity_title',
        'Tamponamento de poços de monitoramento',
      )
    } catch (_) {
      report = new Record(app.findCollectionByNameOrId('reports_rdo'))
      report.set('number', 3)
      report.set('project', project.id)
      report.set('report_date', '2025-05-27 00:00:00.000Z')
      report.set('weather', 'Sol')
      report.set('performed_by', operator.id)
      report.set('supervised_by', technician.id)
      report.set('activity_title', 'Tamponamento de poços de monitoramento')
      report.set(
        'activity_description',
        'Execução dos serviços de tamponamento dos poços PB-37, PB-38, PB-39 e PB-40, conforme plano de trabalho aprovado.',
      )
      report.set('time_displacement', '01h20')
      report.set('time_waiting', 'Sem ocorrências')
      report.set('interferences', 'Não houve')
      report.set('plan_changes', 'Não houve')
      report.set('accidents', 'Não houve')
      report.set('status', 'submitted')
      app.save(report)
      ;[
        ['PB-37', 28, '4"'],
        ['PB-38', 28.01, '4"'],
        ['PB-39', 28, '4"'],
        ['PB-40', 28.03, '4"'],
      ].forEach((item) => {
        const row = new Record(app.findCollectionByNameOrId('report_wells'))
        row.set('report', report.id)
        row.set('well_id', item[0])
        row.set('depth', item[1])
        row.set('completion_date', '2025-05-27 00:00:00.000Z')
        row.set('diameter', item[2])
        app.save(row)
      })
    }

    try {
      app.findFirstRecordByData('field_spreadsheets', 'project', project.id)
    } catch (_) {
      const sheet = new Record(app.findCollectionByNameOrId('field_spreadsheets'))
      sheet.set('project', project.id)
      sheet.set('operator', operator.id)
      sheet.set('date', '2025-05-27 00:00:00.000Z')
      sheet.set('area', 'Área de Remediação')
      sheet.set('weather', 'Sol')
      sheet.set('pluviometer', 0)
      sheet.set('extraction_data', [
        { well: 'PB-127', morning: '12540', afternoon: '12612', pump: '18', autopump: '72' },
        { well: 'PB-128', morning: '9860', afternoon: '9918', pump: '20', autopump: '58' },
      ])
      sheet.set('infiltration_data', {
        geralMorning: '830',
        geralAfternoon: '910',
        out1Morning: '210',
        out1Afternoon: '235',
      })
      sheet.set('nutrient_done', true)
      sheet.set('nutrient_map_kg', 15)
      sheet.set('nutrient_ureia_kg', 8)
      sheet.set('compressor_data', {
        pressure1: '7,2 bar',
        pressure2: '7,0 bar',
        oil1: 'OK',
        oil2: 'OK',
      })
      sheet.set('oil_removal_data', {
        sao1Volume: '2,5',
        sao1Date: '27/05/2025',
        sao2Volume: '1,2',
        sao2Date: '27/05/2025',
      })
      sheet.set('waste_liquid_qty', 2)
      sheet.set('waste_solid_qty', 1)
      sheet.set('env_5s_check', true)
      sheet.set('env_checklist_monthly', true)
      sheet.set('observations', 'Operação dentro dos parâmetros previstos.')
      sheet.set('status', 'submitted')
      app.save(sheet)
    }
  },
  (app) => {
    ;[
      'field_spreadsheets',
      'report_wells',
      'reports_rdo',
      'wells',
      'projects',
      'contracts',
      'areas',
      'companies',
      'clients',
    ].forEach((name) => {
      try {
        app.truncateCollection(app.findCollectionByNameOrId(name))
      } catch (_) {}
    })
    ;[
      'admin@grupoepa.com.br',
      'annik_almeida@grupoepa.com.br',
      'operador@grupoepa.com.br',
      'tecnico@grupoepa.com.br',
    ].forEach((email) => {
      try {
        app.delete(app.findAuthRecordByEmail('_pb_users_auth_', email))
      } catch (_) {}
    })
  },
)
