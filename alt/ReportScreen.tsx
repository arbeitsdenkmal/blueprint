import { useState, useEffect } from 'react'
import { supabase } from './src/lib/supabase'
import { exportReport } from './src/lib/report-export'
import type {
  Customer,
  Job,
  CustomerReport,
  Format,
  FormatStats,
  ReportDetailRow,
  ReportDetailTotals,
  ReportProjectSection,
} from './src/types'
import { itemAreaM2 } from './src/types'

const FORMATS: Format[] = ['A0', 'A1', 'A2', 'A3', 'A4', 'custom']

function emptyStats(): Record<Format, FormatStats> {
  return {
    A0:     { bw: 0, color: 0, bw_m2: 0, color_m2: 0 },
    A1:     { bw: 0, color: 0, bw_m2: 0, color_m2: 0 },
    A2:     { bw: 0, color: 0, bw_m2: 0, color_m2: 0 },
    A3:     { bw: 0, color: 0, bw_m2: 0, color_m2: 0 },
    A4:     { bw: 0, color: 0, bw_m2: 0, color_m2: 0 },
    custom: { bw: 0, color: 0, bw_m2: 0, color_m2: 0 },
  }
}

function emptyDetailTotals(): ReportDetailTotals {
  return { blatt_bw: 0, blatt_color: 0, m2_bw: 0, m2_color: 0, m2_total: 0 }
}

function addToDetailTotals(t: ReportDetailTotals, row: ReportDetailRow): void {
  const blatt = row.page_count * row.copies
  if (row.is_color) {
    t.blatt_color += blatt
    t.m2_color += row.total_m2
  } else {
    t.blatt_bw += blatt
    t.m2_bw += row.total_m2
  }
  t.m2_total += row.total_m2
}

function buildReport(
  customer: Customer,
  jobs: Job[],
  from: string,
  to: string,
): CustomerReport {
  const grandTotal = emptyStats()
  const projectMap = new Map<string, { name: string; jobs: Job[] }>()

  for (const job of jobs) {
    const key = job.project_id ?? '__none__'
    const name = job.project?.name ?? '(Kein Bauvorhaben)'
    if (!projectMap.has(key)) {
      projectMap.set(key, { name, jobs: [] })
    }
    projectMap.get(key)!.jobs.push(job)
  }

  const sortedEntries = [...projectMap.entries()].sort((a, b) =>
    a[1].name.localeCompare(b[1].name, 'de'),
  )

  const project_sections: ReportProjectSection[] = []

  for (const [key, { name, jobs: pJobs }] of sortedEntries) {
    const sortedJobs = [...pJobs].sort((a, b) => {
      const d = a.job_date.localeCompare(b.job_date)
      if (d !== 0) return d
      return (a.created_at ?? '').localeCompare(b.created_at ?? '')
    })

    const rows: ReportDetailRow[] = []
    const subtotal = emptyDetailTotals()

    for (const job of sortedJobs) {
      for (const item of job.items ?? []) {
        const blatt = item.page_count * item.copies
        const sheetM2 = itemAreaM2(item.format, item.width_mm, item.height_mm)
        const totalM2 = sheetM2 * blatt

        if (item.is_color) {
          grandTotal[item.format].color += blatt
          grandTotal[item.format].color_m2 += totalM2
        } else {
          grandTotal[item.format].bw += blatt
          grandTotal[item.format].bw_m2 += totalM2
        }

        const detailRow: ReportDetailRow = {
          job_date: job.job_date,
          filename: item.filename,
          format: item.format,
          page_count: item.page_count,
          copies: item.copies,
          m2_per_sheet: sheetM2,
          total_m2: totalM2,
          is_color: item.is_color,
        }
        rows.push(detailRow)
        addToDetailTotals(subtotal, detailRow)
      }
    }

    project_sections.push({
      project_id: key === '__none__' ? null : key,
      project_name: name,
      rows,
      subtotal,
    })
  }

  const detail_grand_total = project_sections.reduce((acc, sec) => {
    acc.blatt_bw += sec.subtotal.blatt_bw
    acc.blatt_color += sec.subtotal.blatt_color
    acc.m2_bw += sec.subtotal.m2_bw
    acc.m2_color += sec.subtotal.m2_color
    acc.m2_total += sec.subtotal.m2_total
    return acc
  }, emptyDetailTotals())

  return {
    customer,
    period_from: from,
    period_to: to,
    grand_total: grandTotal,
    project_sections,
    detail_grand_total,
  }
}

function fmtM2(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

function fmtDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatLabel(f: Format): string {
  return f === 'custom' ? 'Sonderformat' : f
}

/** Kompakte Abrechnungs-Zusammenfassung nach Format */
function SummaryBillingTable({ stats }: { stats: Record<Format, FormatStats> }) {
  const rows = FORMATS.filter(
    f => stats[f].bw > 0 || stats[f].color > 0,
  )
  if (rows.length === 0) {
    return <p className="text-sm text-muted">Keine Daten im Zeitraum</p>
  }

  let sumBw = 0
  let sumColor = 0
  let sumBwM2 = 0
  let sumColorM2 = 0
  let sumM2Gesamt = 0

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 text-xs font-medium text-muted uppercase tracking-wide">Format</th>
            <th className="text-right py-2 text-xs font-medium text-muted uppercase tracking-wide">Blatt S/W</th>
            <th className="text-right py-2 text-xs font-medium text-muted uppercase tracking-wide">Blatt Farbe</th>
            <th className="text-right py-2 text-xs font-medium text-muted uppercase tracking-wide">m² S/W</th>
            <th className="text-right py-2 text-xs font-medium text-muted uppercase tracking-wide">m² Farbe</th>
            <th className="text-right py-2 text-xs font-medium text-muted uppercase tracking-wide">Gesamt m²</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(fmt => {
            const s = stats[fmt]
            const gesamtM2 = s.bw_m2 + s.color_m2
            sumBw += s.bw
            sumColor += s.color
            sumBwM2 += s.bw_m2
            sumColorM2 += s.color_m2
            sumM2Gesamt += gesamtM2
            return (
              <tr key={fmt} className="border-b border-border last:border-0">
                <td className="py-2 font-medium">{formatLabel(fmt)}</td>
                <td className="tabular text-right py-2">{s.bw}</td>
                <td className="tabular text-right py-2">{s.color}</td>
                <td className="tabular text-right py-2">{fmtM2(s.bw_m2)}</td>
                <td className="tabular text-right py-2">{fmtM2(s.color_m2)}</td>
                <td className="tabular text-right py-2 font-medium">{fmtM2(gesamtM2)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-paper-dark font-bold">
            <td className="px-2 py-2.5 text-xs uppercase tracking-wide rounded-bl">Summe</td>
            <td className="tabular text-right px-2 py-2.5">{sumBw}</td>
            <td className="tabular text-right px-2 py-2.5">{sumColor}</td>
            <td className="tabular text-right px-2 py-2.5">{fmtM2(sumBwM2)}</td>
            <td className="tabular text-right px-2 py-2.5">{fmtM2(sumColorM2)}</td>
            <td className="tabular text-right px-2 py-2.5 rounded-br">{fmtM2(sumM2Gesamt)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function DetailRowCells({ row }: { row: ReportDetailRow }) {
  return (
    <tr className="border-b border-border">
      <td className="tabular py-1.5 pr-2 whitespace-nowrap">{fmtDisplayDate(row.job_date)}</td>
      <td className="py-1.5 pr-2 max-w-[200px] truncate" title={row.filename ?? ''}>
        {row.filename ?? '—'}
      </td>
      <td className="py-1.5 pr-2">{formatLabel(row.format)}</td>
      <td className="tabular text-right py-1.5 pr-2">{row.page_count}</td>
      <td className="tabular text-right py-1.5 pr-2">{row.copies}</td>
      <td className="tabular text-right py-1.5 pr-2">{fmtM2(row.m2_per_sheet)}</td>
      <td className="tabular text-right py-1.5 pr-2 font-medium">{fmtM2(row.total_m2)}</td>
      <td className="py-1.5 text-right whitespace-nowrap">{row.is_color ? 'Farbe' : 'S/W'}</td>
    </tr>
  )
}

function SubtotalRow({ label, t }: { label: string; t: ReportDetailTotals }) {
  const blatt = t.blatt_bw + t.blatt_color
  return (
    <tr className="bg-paper-dark font-semibold">
      <td className="py-2 pr-2">—</td>
      <td className="py-2 pr-2 text-ink">{label}</td>
      <td className="py-2 pr-2">—</td>
      <td className="tabular text-right py-2 pr-2">{blatt}</td>
      <td className="py-2 pr-2 text-right">—</td>
      <td className="py-2 pr-2 text-right">—</td>
      <td className="tabular text-right py-2 pr-2">{fmtM2(t.m2_total)}</td>
      <td className="py-2 text-right text-xs font-normal text-muted">
        {t.blatt_bw} S/W · {t.blatt_color} Farbe
      </td>
    </tr>
  )
}

export default function ReportScreen() {
  const [customers, setCustomers]     = useState<Customer[]>([])
  const [customerId, setCustomerId]   = useState('')
  const [from, setFrom]               = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [to, setTo] = useState(() => {
    const d = new Date()
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${last}`
  })
  const [report, setReport]   = useState<CustomerReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('blueprint_customers')
      .select('*')
      .order('name')
      .then(({ data }) => setCustomers(data ?? []))
  }, [])

  function setMonth(offset: number) {
    const d = new Date()
    d.setMonth(d.getMonth() + offset)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const last = new Date(y, m, 0).getDate()
    setFrom(`${y}-${String(m).padStart(2, '0')}-01`)
    setTo(`${y}-${String(m).padStart(2, '0')}-${last}`)
  }

  async function loadReport() {
    if (!customerId) return
    setLoading(true)
    setError(null)
    setReport(null)

    try {
      const { data, error: err } = await supabase
        .from('blueprint_jobs')
        .select(`
          *,
          project:blueprint_projects(*),
          items:blueprint_job_items(*)
        `)
        .eq('customer_id', customerId)
        .gte('job_date', from)
        .lte('job_date', to)
        .order('job_date')

      if (err) throw err

      const customer = customers.find(c => c.id === customerId)!
      const built    = buildReport(customer, (data as Job[]) ?? [], from, to)
      setReport(built)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }

  const hasDetailData =
    report &&
    report.project_sections.some(s => s.rows.length > 0)

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Auswertung</h1>

        <div className="bg-white border border-border rounded-xl p-5 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
                Kunde *
              </label>
              <select
                value={customerId}
                onChange={e => { setCustomerId(e.target.value); setReport(null) }}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent bg-white"
              >
                <option value="">Kunde wählen…</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
                Von
              </label>
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
                Bis
              </label>
              <input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            {[
              { label: 'Vorvormonat', offset: -2 },
              { label: 'Vormonat',    offset: -1 },
              { label: 'Dieser Monat', offset: 0 },
            ].map(({ label, offset }) => (
              <button
                key={offset}
                onClick={() => setMonth(offset)}
                className="text-xs px-3 py-1.5 border border-border rounded-lg hover:border-accent hover:text-accent transition-colors"
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => void loadReport()}
            disabled={!customerId || loading}
            className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${
              customerId && !loading
                ? 'bg-accent text-white hover:bg-accent/90'
                : 'bg-border text-muted cursor-not-allowed'
            }`}
          >
            {loading ? 'Laden…' : 'Auswertung laden'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-danger-light border border-danger rounded-lg text-sm text-danger">
            {error}
          </div>
        )}

        {report && (
          <>
            {!hasDetailData ? (
              <div className="text-center py-10 text-muted text-sm bg-white border border-border rounded-xl">
                Keine Aufträge in diesem Zeitraum
              </div>
            ) : (
              <div className="space-y-10">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                  <div>
                    <p className="text-sm text-muted">
                      {report.customer.name}
                      <span className="mx-2">·</span>
                      {fmtDisplayDate(report.period_from)} – {fmtDisplayDate(report.period_to)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => exportReport(report)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-ink text-white rounded-lg text-sm font-medium hover:bg-sidebar-hover transition-colors shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    PDF exportieren
                  </button>
                </div>

                <section className="bg-white border border-border rounded-xl p-5">
                  <h2 className="text-lg font-semibold mb-1">Zusammenfassung</h2>
                  <p className="text-xs text-muted mb-4">Abrechnung nach Format</p>
                  <SummaryBillingTable stats={report.grand_total} />
                </section>

                <section>
                  <h2 className="text-lg font-semibold mb-4">Detailauswertung</h2>
                  <div className="space-y-8">
                    {report.project_sections
                      .filter(sec => sec.rows.length > 0)
                      .map(sec => (
                        <div
                          key={sec.project_id ?? sec.project_name}
                          className="bg-white border border-border rounded-xl overflow-hidden"
                        >
                          <div className="px-4 py-3 border-b border-border bg-paper">
                            <p className="font-semibold text-sm">{sec.project_name}</p>
                          </div>
                          <div className="p-4 overflow-x-auto">
                            <table className="w-full text-sm min-w-[720px]">
                              <thead>
                                <tr className="border-b border-border text-xs text-muted uppercase tracking-wide">
                                  <th className="text-left py-2 pr-2 font-medium">Datum</th>
                                  <th className="text-left py-2 pr-2 font-medium">Dateiname</th>
                                  <th className="text-left py-2 pr-2 font-medium">Format</th>
                                  <th className="text-right py-2 pr-2 font-medium">Seiten</th>
                                  <th className="text-right py-2 pr-2 font-medium">Kopien</th>
                                  <th className="text-right py-2 pr-2 font-medium">m² / Blatt</th>
                                  <th className="text-right py-2 pr-2 font-medium">Gesamtfläche</th>
                                  <th className="text-right py-2 font-medium">Farbe / S/W</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sec.rows.map((row, idx) => (
                                  <DetailRowCells key={`${sec.project_name}-${idx}`} row={row} />
                                ))}
                                <SubtotalRow label="Zwischensumme" t={sec.subtotal} />
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}

                    <div className="bg-accent-light border-2 border-accent rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-accent/30">
                        <p className="font-semibold text-sm text-accent">Gesamtsumme (alle Bauvorhaben)</p>
                      </div>
                      <div className="p-4 overflow-x-auto">
                        <table className="w-full text-sm min-w-[720px]">
                          <thead>
                            <tr className="border-b border-border text-xs text-muted uppercase tracking-wide">
                              <th className="text-left py-2 pr-2 font-medium">Datum</th>
                              <th className="text-left py-2 pr-2 font-medium">Dateiname</th>
                              <th className="text-left py-2 pr-2 font-medium">Format</th>
                              <th className="text-right py-2 pr-2 font-medium">Seiten</th>
                              <th className="text-right py-2 pr-2 font-medium">Kopien</th>
                              <th className="text-right py-2 pr-2 font-medium">m² / Blatt</th>
                              <th className="text-right py-2 pr-2 font-medium">Gesamtfläche</th>
                              <th className="text-right py-2 font-medium">Farbe / S/W</th>
                            </tr>
                          </thead>
                          <tbody>
                            <SubtotalRow label="Gesamtsumme" t={report.detail_grand_total} />
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
