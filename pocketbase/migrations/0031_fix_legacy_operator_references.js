/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Localiza um técnico ativo real para substituir o ID quebrado 'cfpekk93zx4j1pr'
  let targetTechId = ''
  try {
    const tech = app.findFirstRecordByFilter('users', 'role = "technician" && active = true')
    if (tech) {
      targetTechId = tech.id
    }
  } catch {
    // fallback
  }

  if (!targetTechId) {
    try {
      const anyUser = app.findFirstRecordByFilter('users', 'active = true')
      if (anyUser) {
        targetTechId = anyUser.id
      }
    } catch {
      // fallback
    }
  }

  if (!targetTechId) {
    targetTechId = '4o5u72v8w6k277l'
  }

  // 1. Atualizar projeto 8twb4w28x6nmj4v e qualquer outro projeto que referencie cfpekk93zx4j1pr
  try {
    const projects = app.findAllRecords('projects')
    for (const proj of projects) {
      let changed = false

      // Verifica assigned_users
      const assigned = proj.get('assigned_users') || []
      const assignedArr = Array.isArray(assigned) ? assigned : [assigned]
      if (assignedArr.includes('cfpekk93zx4j1pr')) {
        const newAssigned = assignedArr.map((id) => (id === 'cfpekk93zx4j1pr' ? targetTechId : id))
        // Remove duplicatas
        const uniqueAssigned = Array.from(new Set(newAssigned))
        proj.set('assigned_users', uniqueAssigned)
        changed = true
      }

      // Verifica base_sheet_field
      const rawBaseField = proj.get('base_sheet_field')
      if (rawBaseField) {
        let fieldObj = null
        if (typeof rawBaseField === 'string' && rawBaseField.trim() !== '') {
          try {
            fieldObj = JSON.parse(rawBaseField)
          } catch {
            fieldObj = null
          }
        } else if (typeof rawBaseField === 'object') {
          fieldObj = rawBaseField
        }

        if (fieldObj && typeof fieldObj === 'object') {
          let fieldChanged = false
          if (fieldObj.operator === 'cfpekk93zx4j1pr') {
            fieldObj.operator = targetTechId
            fieldChanged = true
          }
          if (fieldObj.technician === 'cfpekk93zx4j1pr') {
            fieldObj.technician = targetTechId
            fieldChanged = true
          }
          if (fieldObj.filled_fields && fieldObj.filled_fields.operator === 'cfpekk93zx4j1pr') {
            fieldObj.filled_fields.operator = targetTechId
            fieldChanged = true
          }
          if (fieldChanged) {
            proj.set('base_sheet_field', fieldObj)
            changed = true
          }
        }
      }

      // Verifica base_sheet_rdo
      const rawBaseRdo = proj.get('base_sheet_rdo')
      if (rawBaseRdo) {
        let rdoObj = null
        if (typeof rawBaseRdo === 'string' && rawBaseRdo.trim() !== '') {
          try {
            rdoObj = JSON.parse(rawBaseRdo)
          } catch {
            rdoObj = null
          }
        } else if (typeof rawBaseRdo === 'object') {
          rdoObj = rawBaseRdo
        }

        if (rdoObj && typeof rdoObj === 'object') {
          let rdoChanged = false
          if (rdoObj.performed_by === 'cfpekk93zx4j1pr') {
            rdoObj.performed_by = targetTechId
            rdoChanged = true
          }
          if (rdoObj.supervised_by === 'cfpekk93zx4j1pr') {
            rdoObj.supervised_by = targetTechId
            rdoChanged = true
          }
          if (rdoObj.filled_fields && rdoObj.filled_fields.performedBy === 'cfpekk93zx4j1pr') {
            rdoObj.filled_fields.performedBy = targetTechId
            rdoChanged = true
          }
          if (rdoChanged) {
            proj.set('base_sheet_rdo', rdoObj)
            changed = true
          }
        }
      }

      if (changed) {
        app.save(proj)
      }
    }
  } catch (err) {
    console.log('Erro na migracao 0031 de projetos:', err)
  }

  // 2. Limpar qualquer registro em field_spreadsheets com operator inválido
  try {
    const sheets = app.findAllRecords('field_spreadsheets')
    for (const sheet of sheets) {
      const op = sheet.get('operator')
      if (op === 'cfpekk93zx4j1pr') {
        sheet.set('operator', targetTechId)
        app.save(sheet)
      }
    }
  } catch (err) {
    console.log('Erro na migracao 0031 de planilhas:', err)
  }

  // 3. Limpar qualquer registro em reports_rdo com performed_by ou supervised_by inválido
  try {
    const rdos = app.findAllRecords('reports_rdo')
    for (const rdo of rdos) {
      let rdoChanged = false
      if (rdo.get('performed_by') === 'cfpekk93zx4j1pr') {
        rdo.set('performed_by', targetTechId)
        rdoChanged = true
      }
      if (rdo.get('supervised_by') === 'cfpekk93zx4j1pr') {
        rdo.set('supervised_by', targetTechId)
        rdoChanged = true
      }
      if (rdoChanged) {
        app.save(rdo)
      }
    }
  } catch (err) {
    console.log('Erro na migracao 0031 de rdos:', err)
  }
})
