import type { FormSchema } from '@/lib/types/database'

interface ApplicationData {
  title: string
  application_number: string
  applicant?: { name: string }
  document_type?: { name: string }
  submitted_at?: string | null
  created_at: string
  status: string
  form_data: Record<string, unknown>
  approval_records?: Array<{
    step_name: string
    approver?: { name: string }
    action: string
    comment?: string | null
    acted_at?: string | null
  }>
}

export async function exportApplicationPdf(
  application: ApplicationData,
  schema: FormSchema
) {
  const { jsPDF } = await import('jspdf')
  const autoTableModule = await import('jspdf-autotable')
  const autoTable = autoTableModule.default

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Load Japanese font (use built-in Helvetica as fallback, CJK won't render perfectly)
  doc.setFont('Helvetica')

  let y = 20

  // Title
  doc.setFontSize(16)
  doc.text(application.title || 'Application', 14, y)
  y += 10

  // Meta info
  doc.setFontSize(9)
  const meta = [
    `No: ${application.application_number}`,
    `Type: ${application.document_type?.name || '-'}`,
    `Applicant: ${application.applicant?.name || '-'}`,
    `Date: ${application.submitted_at || application.created_at}`,
    `Status: ${application.status}`,
  ]
  meta.forEach(line => {
    doc.text(line, 14, y)
    y += 5
  })

  y += 5

  // Form data
  doc.setFontSize(11)
  doc.text('Form Data', 14, y)
  y += 7

  doc.setFontSize(9)

  for (const field of schema.fields) {
    const value = application.form_data[field.id]

    if (field.type === 'table') {
      doc.text(`${field.label}:`, 14, y)
      y += 5

      const rows = (value as Record<string, unknown>[]) || []
      const cols = field.columns || []

      if (cols.length > 0 && rows.length > 0) {
        const tableHead = cols.map(c => c.label)
        const tableBody = rows.map(row =>
          cols.map(c => {
            const v = row[c.id]
            if (c.type === 'currency' || c.type === 'formula') {
              return typeof v === 'number' ? v.toLocaleString() : String(v || '')
            }
            return String(v || '')
          })
        )

        autoTable(doc, {
          startY: y,
          head: [tableHead],
          body: tableBody,
          margin: { left: 14 },
          styles: { fontSize: 8 },
          headStyles: { fillColor: [30, 58, 95] },
        })
        // @ts-expect-error lastAutoTable set by jspdf-autotable
        y = doc.lastAutoTable.finalY + 5
      }
    } else {
      let displayVal = ''
      if (value === undefined || value === null || value === '') {
        displayVal = '-'
      } else if (field.type === 'currency') {
        displayVal = typeof value === 'number' ? value.toLocaleString() : String(value)
      } else {
        displayVal = String(value)
      }

      // Truncate long values
      if (displayVal.length > 80) displayVal = displayVal.substring(0, 80) + '...'

      doc.text(`${field.label}: ${displayVal}`, 14, y)
      y += 5

      if (y > 270) {
        doc.addPage()
        y = 20
      }
    }
  }

  // Approval history
  if (application.approval_records && application.approval_records.length > 0) {
    if (y > 240) { doc.addPage(); y = 20 }
    y += 5
    doc.setFontSize(11)
    doc.text('Approval History', 14, y)
    y += 7

    const approvalHead = ['Step', 'Approver', 'Action', 'Comment', 'Date']
    const approvalBody = application.approval_records.map(r => [
      r.step_name,
      r.approver?.name || '-',
      r.action,
      r.comment || '-',
      r.acted_at || '-',
    ])

    autoTable(doc, {
      startY: y,
      head: [approvalHead],
      body: approvalBody,
      margin: { left: 14 },
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 95] },
    })
  }

  doc.save(`${application.application_number || 'application'}.pdf`)
}
