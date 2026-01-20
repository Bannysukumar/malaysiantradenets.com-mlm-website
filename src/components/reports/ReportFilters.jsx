import { Search, Calendar, Download } from 'lucide-react'
import { useState } from 'react'

export default function ReportFilters({ 
  onSearch, 
  onDateRangeChange, 
  onExport,
  showDateRange = false,
  showExport = true,
  canExport = false,
  dateRange = { from: '', to: '' },
  customFilters = null
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [fromDate, setFromDate] = useState(dateRange.from)
  const [toDate, setToDate] = useState(dateRange.to)

  const handleSearch = (value) => {
    setSearchTerm(value)
    onSearch && onSearch(value)
  }

  const handleDateChange = () => {
    onDateRangeChange && onDateRangeChange({ from: fromDate, to: toDate })
  }

  return (
    <div className="card mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>

        {/* Date Range */}
        {showDateRange && (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">To Date</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="input-field flex-1"
                />
                <button
                  onClick={handleDateChange}
                  className="btn-primary"
                >
                  Find
                </button>
              </div>
            </div>
          </>
        )}

        {/* Custom Filters */}
        {customFilters}

        {/* Export Button */}
        {showExport && canExport && (
          <div className="flex items-end">
            <button
              onClick={onExport}
              className="btn-secondary flex items-center gap-2 w-full"
            >
              <Download size={18} />
              Export
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

