migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Ensure operator Carlos Oliveira exists with standard password Skip@Pass (and fallback Skip@2025)
    let operator
    try {
      operator = app.findAuthRecordByEmail('_pb_users_auth_', 'operador@grupoepa.com.br')
      operator.setPassword('Skip@Pass')
      operator.setVerified(true)
      operator.set('name', 'Carlos Oliveira')
      operator.set('role', 'operator')
      operator.set('active', true)
      app.save(operator)
    } catch (_) {
      operator = new Record(users)
      operator.setEmail('operador@grupoepa.com.br')
      operator.setPassword('Skip@Pass')
      operator.setVerified(true)
      operator.set('name', 'Carlos Oliveira')
      operator.set('role', 'operator')
      operator.set('active', true)
      app.save(operator)
    }

    // 2. Ensure technician Marina Santos exists with standard password Skip@Pass
    let technician
    try {
      technician = app.findAuthRecordByEmail('_pb_users_auth_', 'tecnico@grupoepa.com.br')
      technician.setPassword('Skip@Pass')
      technician.setVerified(true)
      technician.set('name', 'Marina Santos')
      technician.set('role', 'technician')
      technician.set('active', true)
      app.save(technician)
    } catch (_) {
      technician = new Record(users)
      technician.setEmail('tecnico@grupoepa.com.br')
      technician.setPassword('Skip@Pass')
      technician.setVerified(true)
      technician.set('name', 'Marina Santos')
      technician.set('role', 'technician')
      technician.set('active', true)
      app.save(technician)
    }

    // 3. Ensure Annik and default Admin are also confirmed with Skip@Pass
    try {
      const annik = app.findAuthRecordByEmail('_pb_users_auth_', 'annik_almeida@grupoepa.com.br')
      annik.setPassword('Skip@Pass')
      annik.setVerified(true)
      annik.set('name', 'Annik Almeida')
      annik.set('role', 'admin')
      annik.set('active', true)
      app.save(annik)
    } catch (_) {}

    try {
      const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'admin@grupoepa.com.br')
      admin.setPassword('Skip@Pass')
      admin.setVerified(true)
      admin.set('name', 'Administrador EPA')
      admin.set('role', 'admin')
      admin.set('active', true)
      app.save(admin)
    } catch (_) {}

    // 4. Ensure all projects assign both operator and technician so they have access
    try {
      const projectRecords = app.findRecordsByFilter('projects', '', '', 100, 0)
      for (const p of projectRecords) {
        const assigned = p.getStringSlice('assigned_users') || []
        const updatedAssigned = Array.from(new Set([...assigned, operator.id, technician.id]))
        p.set('assigned_users', updatedAssigned)
        app.save(p)
      }
    } catch (_) {}
  },
  (app) => {
    // down migration
  },
)
