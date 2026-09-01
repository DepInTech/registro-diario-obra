migrate(
  (app) => {
    const admin = app.findAuthRecordByEmail('users', 'annik_almeida@grupoepa.com.br')
    let operator = admin
    let technician = admin
    try {
      operator = app.findAuthRecordByEmail('users', 'operador@grupoepa.com.br')
    } catch (_) {}
    try {
      technician = app.findAuthRecordByEmail('users', 'tecnico@grupoepa.com.br')
    } catch (_) {}

    let client
    try {
      client = app.findFirstRecordByData('clients', 'document', '33.000.167/0001-01')
    } catch (_) {
      client = new Record(app.findCollectionByNameOrId('clients'))
      client.set('name', 'Petrobras - Refinaria Sul')
      client.set('document', '33.000.167/0001-01')
      client.set('contact', 'Operações Ambientais')
      app.save(client)
    }

    let company
    try {
      company = app.findFirstRecordByData('companies', 'name', 'EPA Gestão Ambiental')
    } catch (_) {
      company = new Record(app.findCollectionByNameOrId('companies'))
      company.set('name', 'EPA Gestão Ambiental')
      company.set('document', '12.840.220/0001-45')
      app.save(company)
    }

    let area
    try {
      area = app.findFirstRecordByData('areas', 'name', 'Remediação Ambiental')
    } catch (_) {
      area = new Record(app.findCollectionByNameOrId('areas'))
      area.set('name', 'Remediação Ambiental')
      area.set('description', 'Área operacional de recuperação e monitoramento ambiental')
      app.save(area)
    }

    let contract
    try {
      contract = app.findFirstRecordByData('contracts', 'code', 'CT-EPA-2025-017')
    } catch (_) {
      contract = new Record(app.findCollectionByNameOrId('contracts'))
      contract.set('code', 'CT-EPA-2025-017')
      contract.set('client', client.id)
      contract.set('company', company.id)
      contract.set('start_date', '2025-01-06 00:00:00.000Z')
      contract.set('end_date', '2026-12-18 00:00:00.000Z')
      contract.set('status', 'active')
      app.save(contract)
    }

    let project
    try {
      project = app.findFirstRecordByData('projects', 'epa_code', 'EPA-RSL-A01')
    } catch (_) {
      project = new Record(app.findCollectionByNameOrId('projects'))
      project.set('name', 'Recuperação Ambiental Lote A')
      project.set('client', client.id)
      project.set('contract', contract.id)
      project.set('company', company.id)
      project.set('area', area.id)
      project.set('location', 'Refinaria Sul — Área Industrial')
      project.set('epa_code', 'EPA-RSL-A01')
      project.set('progress', 42)
      project.set('status', 'active')
      project.set('assigned_users', [admin.id, operator.id, technician.id])
      app.save(project)
    }

    try {
      app.findFirstRecordByData('wells', 'identification', 'PZ-01')
    } catch (_) {
      const well = new Record(app.findCollectionByNameOrId('wells'))
      well.set('project', project.id)
      well.set('identification', 'PZ-01')
      well.set('default_diameter', '4 polegadas')
      well.set('active', true)
      app.save(well)
    }
  },
  (app) => {
    try {
      app.delete(app.findFirstRecordByData('wells', 'identification', 'PZ-01'))
    } catch (_) {}
    try {
      app.delete(app.findFirstRecordByData('projects', 'epa_code', 'EPA-RSL-A01'))
    } catch (_) {}
    try {
      app.delete(app.findFirstRecordByData('contracts', 'code', 'CT-EPA-2025-017'))
    } catch (_) {}
  },
)
