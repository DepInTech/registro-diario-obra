import type { RecordModel } from 'pocketbase'
import pb from '@/lib/pocketbase/client'
import type {
  Area,
  AuditLog,
  Client,
  Company,
  Contract,
  EpaUser,
  FieldSheet,
  Project,
  RdoDraft,
  ReportPhoto,
  ReportRdo,
  ReportWell,
  Well,
} from '@/types/epa'

const all = async <T extends RecordModel>(
  collection: string,
  options: Record<string, unknown> = {},
) => pb.collection(collection).getFullList<T>({ sort: '-created', ...options })
export const dataService = {
  clients: () => all<Client>('clients', { sort: 'name' }),
  companies: () => all<Company>('companies', { sort: 'name' }),
  areas: () => all<Area>('areas', { sort: 'name' }),
  contracts: () => all<Contract>('contracts', { sort: '-created', expand: 'client,company' }),
  projects: () =>
    all<Project>('projects', { sort: '-created', expand: 'client,contract,company,area' }),
  wells: (project?: string) =>
    all<Well>('wells', {
      sort: 'identification',
      ...(project ? { filter: `project = "${project}"` } : {}),
    }),
  users: () => all<EpaUser>('users', { sort: 'name' }),
  reports: () =>
    all<ReportRdo>('reports_rdo', {
      sort: '-report_date',
      expand: 'project,project.client,project.contract,project.company,performed_by,supervised_by',
    }),
  reportWells: (report: string) =>
    all<ReportWell>('report_wells', { sort: 'created', filter: `report = "${report}"` }),
  reportPhotos: (report: string) =>
    all<ReportPhoto>('report_photos', { sort: 'order', filter: `report = "${report}"` }),
  sheets: () =>
    all<FieldSheet>('field_spreadsheets', { sort: '-date', expand: 'project,operator' }),
  audits: () => all<AuditLog>('audit_logs', { sort: '-created', expand: 'actor' }),
  create: <T = RecordModel>(collection: string, payload: Record<string, unknown> | FormData) =>
    pb.collection(collection).create<T>(payload),
  update: <T = RecordModel>(
    collection: string,
    id: string,
    payload: Record<string, unknown> | FormData,
  ) => pb.collection(collection).update<T>(id, payload),
  remove: (collection: string, id: string) => pb.collection(collection).delete(id),
}

export async function createReport(
  draft: RdoDraft,
  wells: Array<{ well_id: string; depth?: number; completion_date?: string; diameter?: string }>,
  photos: Array<{ file: File; caption: string }>,
) {
  const payload = new FormData()
  Object.entries(draft).forEach(([key, value]) => {
    if (value !== undefined && value !== '')
      payload.append(key, value instanceof File ? value : String(value))
  })
  const report = await pb.collection('reports_rdo').create<ReportRdo>(payload)
  await Promise.all(
    wells
      .filter((row) => row.well_id)
      .map((row) => pb.collection('report_wells').create({ report: report.id, ...row })),
  )
  for (let index = 0; index < photos.length; index += 1) {
    const photo = new FormData()
    photo.append('report', report.id)
    photo.append('image', photos[index].file)
    photo.append('caption', photos[index].caption || `Foto ${String(index + 1).padStart(2, '0')}`)
    photo.append('order', String(index))
    await pb.collection('report_photos').create(photo)
  }
  return report
}

export const fileUrl = (record: RecordModel, filename?: string) =>
  filename ? pb.files.getURL(record, filename) : ''
export const auditExport = (
  action: 'export_pdf' | 'export_excel',
  entity: string,
  entityRecord: string,
  filename: string,
) =>
  pb.send('/backend/v1/epa/audit-export', {
    method: 'POST',
    body: { action, entity, entity_record: entityRecord, filename },
  })
