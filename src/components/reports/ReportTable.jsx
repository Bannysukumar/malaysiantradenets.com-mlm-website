import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Eye } from 'lucide-react'

export default function ReportTable({ 
  columns, 
  data, 
  onSort, 
  onViewDetails,
  pagination = true,
  itemsPerPage = 20
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')

  const handleSort = (column) => {
    if (!onSort) return
    
    const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc'
    setSortColumn(column)
    setSortDirection(newDirection)
    onSort(column, newDirection)
  }

  const sortedData = useMemo(() => {
    if (!sortColumn || !onSort) return data
    
    return [...data].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]
      
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr)
      } else {
        return bStr.localeCompare(aStr)
      }
    })
  }, [data, sortColumn, sortDirection, onSort])

  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData
    
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return sortedData.slice(start, end)
  }, [sortedData, currentPage, itemsPerPage, pagination])

  const totalPages = Math.ceil(sortedData.length / itemsPerPage)

  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-700">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-left py-4 px-4 font-semibold ${
                  col.sortable ? 'cursor-pointer hover:bg-dark-lighter' : ''
                }`}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <div className="flex items-center gap-2">
                  <span>{col.label}</span>
                  {col.sortable && sortColumn === col.key && (
                    sortDirection === 'asc' ? (
                      <ChevronUp size={16} className="text-primary" />
                    ) : (
                      <ChevronDown size={16} className="text-primary" />
                    )
                  )}
                </div>
              </th>
            ))}
            {onViewDetails && (
              <th className="text-left py-4 px-4 font-semibold">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {paginatedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (onViewDetails ? 1 : 0)} className="text-center py-12 text-gray-400">
                No data found
              </td>
            </tr>
          ) : (
            paginatedData.map((row, index) => (
              <tr key={row.id || index} className="border-b border-gray-800 hover:bg-dark-lighter">
                {columns.map((col) => (
                  <td key={col.key} className="py-4 px-4">
                    {col.render ? col.render(row[col.key], row) : row[col.key] || '-'}
                  </td>
                ))}
                {onViewDetails && (
                  <td className="py-4 px-4">
                    <button
                      onClick={() => onViewDetails(row)}
                      className="btn-secondary flex items-center gap-2 text-sm"
                    >
                      <Eye size={14} />
                      View
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} entries
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="btn-secondary disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="btn-secondary disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

