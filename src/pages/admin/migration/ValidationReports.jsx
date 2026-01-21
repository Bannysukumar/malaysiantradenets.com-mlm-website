import { useState, useEffect } from 'react'
import { useCollection } from '../../../hooks/useFirestore'
import { formatDate } from '../../../utils/helpers'
import { FileText, Download, AlertCircle, CheckCircle2 } from 'lucide-react'
import Papa from 'papaparse'

export default function ValidationReports() {
  const { data: batches, loading } = useCollection('migrationBatches', [])
  const [selectedBatch, setSelectedBatch] = useState(null)

  const sortedBatches = batches.sort((a, b) => {
    const aTime = a.createdAt?.toDate?.() || new Date(0)
    const bTime = b.createdAt?.toDate?.() || new Date(0)
    return bTime - aTime
  })

  const downloadErrorReport = (batch) => {
    if (!batch.errorRows || batch.errorRows.length === 0) {
      return
    }

    const csv = Papa.unparse(batch.errorRows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `migration_errors_${batch.batchId || batch.id}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const downloadBatchReport = (batch) => {
    const report = {
      batchId: batch.batchId || batch.id,
      type: batch.type,
      mode: batch.mode,
      createdAt: batch.createdAt?.toDate?.()?.toISOString() || 'N/A',
      createdBy: batch.createdBy,
      inserted: batch.inserted || 0,
      updated: batch.updated || 0,
      skipped: batch.skipped || 0,
      errors: batch.errorRows?.length || 0,
      docIds: batch.docIds?.join(', ') || '',
    }

    const csv = Papa.unparse([report])
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `migration_batch_${batch.batchId || batch.id}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="text-gray-400">Loading validation reports...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Migration Batches & Reports</h2>
        <p className="text-gray-400">View and download validation reports for all migration batches</p>
      </div>

      {sortedBatches.length === 0 ? (
        <div className="bg-dark-lighter p-8 rounded-lg text-center">
          <FileText className="mx-auto text-gray-500 mb-4" size={48} />
          <p className="text-gray-400">No migration batches found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedBatches.map((batch) => (
            <div key={batch.id} className="bg-dark-lighter p-6 rounded-lg border border-gray-800">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {batch.type || 'Unknown'} - {batch.mode || 'N/A'}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Batch ID: {batch.batchId || batch.id}
                  </p>
                  <p className="text-sm text-gray-400">
                    Created: {formatDate(batch.createdAt?.toDate?.() || new Date())}
                  </p>
                </div>
                <div className="flex gap-2">
                  {batch.errorRows && batch.errorRows.length > 0 && (
                    <button
                      onClick={() => downloadErrorReport(batch)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      <Download size={16} />
                      Download Errors
                    </button>
                  )}
                  <button
                    onClick={() => downloadBatchReport(batch)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
                  >
                    <Download size={16} />
                    Download Report
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-400">Inserted</p>
                  <p className="text-lg font-semibold text-green-500">{batch.inserted || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Updated</p>
                  <p className="text-lg font-semibold text-yellow-500">{batch.updated || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Skipped</p>
                  <p className="text-lg font-semibold text-gray-500">{batch.skipped || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Errors</p>
                  <p className={`text-lg font-semibold ${(batch.errorRows?.length || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {batch.errorRows?.length || 0}
                  </p>
                </div>
              </div>

              {batch.errorRows && batch.errorRows.length > 0 && (
                <div className="bg-red-900/20 border border-red-500 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="text-red-500" size={20} />
                    <h4 className="text-red-500 font-semibold">Errors Found</h4>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {batch.errorRows.slice(0, 5).map((error, idx) => (
                      <div key={idx} className="text-sm text-red-400">
                        Row {error.row || 'N/A'}: {error.message || JSON.stringify(error)}
                      </div>
                    ))}
                    {batch.errorRows.length > 5 && (
                      <div className="text-sm text-gray-400">
                        ... and {batch.errorRows.length - 5} more errors
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(!batch.errorRows || batch.errorRows.length === 0) && (
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle2 size={20} />
                  <span>No errors found</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

