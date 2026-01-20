// Export utility functions

export function exportToCSV(data, columns, filename) {
  if (!data || data.length === 0) {
    alert('No data to export')
    return
  }

  // Create CSV header
  const headers = columns.map(col => col.label || col.key).join(',')
  
  // Create CSV rows
  const rows = data.map(row => {
    return columns.map(col => {
      const value = col.render ? col.render(row[col.key], row) : (row[col.key] || '')
      // Escape commas and quotes
      const stringValue = String(value).replace(/"/g, '""')
      return `"${stringValue}"`
    }).join(',')
  })

  // Combine header and rows
  const csv = [headers, ...rows].join('\n')

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

export function generateFilename(reportName, fromDate = '', toDate = '') {
  const dateStr = fromDate && toDate 
    ? `${fromDate}_to_${toDate}`
    : new Date().toISOString().split('T')[0]
  
  return `${reportName}_${dateStr}.csv`
}

