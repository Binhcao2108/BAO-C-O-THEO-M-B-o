import React, { useState, useMemo } from 'react';
import { SheetData } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { Activity, Hash, Tag, Table as TableIcon, LayoutDashboard, Database, ChevronLeft, Filter, Settings, BarChart2 } from 'lucide-react';
import TelecomDashboard from './TelecomDashboard';
import { findColumnByKeywords, COL_KEYWORDS } from '../utils/telecomMappings';

const MultiSelect = ({ col, values, selected, onChange }: { col: string, values: string[], selected: string[], onChange: (v: string[]) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 cursor-pointer flex justify-between items-center shadow-sm"
      >
        <span className="truncate">{selected.length ? `${selected.length} đang chọn` : '-- Tất cả --'}</span>
        <span className="text-[10px] text-gray-500">▼</span>
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[220px] max-h-[250px] overflow-y-auto bg-gray-100 border border-gray-200 rounded-lg shadow-xl z-50 flex flex-col p-1.5 custom-scrollbar">
          {selected.length > 0 && (
            <button 
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              className="text-left px-2 py-1.5 text-xs text-rose-400 hover:bg-gray-200 rounded mb-1 border-b border-gray-200"
            >
              Bỏ chọn tất cả
            </button>
          )}
          {values.map(v => (
            <div 
              key={v} 
              className="flex items-start gap-2 px-2 py-1.5 hover:bg-gray-200 rounded text-xs text-gray-700 cursor-pointer transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                const next = selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v];
                onChange(next);
              }}
            >
              <div className="pt-0.5 pointer-events-none">
                <input 
                  type="checkbox" 
                  checked={selected.includes(v)}
                  readOnly
                  className="rounded bg-gray-50 border-gray-200 text-blue-500 focus:ring-blue-500 focus:ring-offset-[#f3f4f6]"
                />
              </div>
              <span className="flex-1 break-words">{v || '(Trống)'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface DashboardProps {
  sheets: SheetData[];
  onReset: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#eab308', '#6366f1', '#f97316'];

export default function Dashboard({ sheets, onReset }: DashboardProps) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(() => {
    const idx = sheets.findIndex(s => s.data.length > 0);
    return idx >= 0 ? idx : 0;
  });
  
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('bar');
  const [viewMode, setViewMode] = useState<'telecom' | 'custom' | 'table'>('telecom');
  const [filters, setFilters] = useState<Record<string, string[]>>({});

  const activeSheet = sheets[activeSheetIndex];

  // Auto-detect column types
  const columnTypes = useMemo(() => {
    if (!activeSheet || activeSheet.data.length === 0) return {};
    const types: Record<string, 'number' | 'string'> = {};
    const sampleSize = Math.min(activeSheet.data.length, 50);
    
    for (const col of activeSheet.columns) {
      let numericCount = 0;
      let stringCount = 0;
      for (let i = 0; i < sampleSize; i++) {
        const val = activeSheet.data[i][col];
        if (val === null || val === undefined || val === '') continue;
        if (typeof val === 'number') {
          numericCount++;
        } else if (typeof val === 'string') {
          if (!isNaN(Number(val))) numericCount++;
          else stringCount++;
        }
      }
      types[col] = numericCount > stringCount ? 'number' : 'string';
    }
    return types;
  }, [activeSheet]);

  const numericCols = Object.entries(columnTypes).filter(([_, type]) => type === 'number').map(([col]) => col);
  const categoricalCols = Object.entries(columnTypes).filter(([_, type]) => type === 'string').map(([col]) => col);
  
  const filterableCols = useMemo(() => {
    if (!activeSheet || activeSheet.data.length === 0) return [];
    const cols: { col: string, values: string[] }[] = [];
    
    // Priority specific columns requested by the user: status, modem, warning
    const priorityCols = [
      findColumnByKeywords(activeSheet.columns, COL_KEYWORDS.status),
      findColumnByKeywords(activeSheet.columns, COL_KEYWORDS.modem),
      findColumnByKeywords(activeSheet.columns, COL_KEYWORDS.warning),
      findColumnByKeywords(activeSheet.columns, COL_KEYWORDS.region),
      findColumnByKeywords(activeSheet.columns, COL_KEYWORDS.team)
    ].filter(Boolean) as string[];

    const colsToAnalyze = Array.from(new Set([...priorityCols, ...categoricalCols]));

    colsToAnalyze.forEach(col => {
      const uniqueVals = new Set<string>();
      for (const row of activeSheet.data) {
        const val = row[col];
        if (val !== null && val !== undefined && val !== '') {
          uniqueVals.add(String(val));
        }
        if (uniqueVals.size > 100) break;
      }
      if (uniqueVals.size > 0 && uniqueVals.size <= 100) {
        cols.push({ col, values: Array.from(uniqueVals).sort() });
      }
    });
    return cols;
  }, [activeSheet, categoricalCols]);

  const filteredData = useMemo(() => {
    if (!activeSheet) return [];
    if (Object.keys(filters).length === 0) return activeSheet.data;

    return activeSheet.data.filter(row => {
      for (const [col, selectedVals] of Object.entries(filters)) {
        if (!selectedVals || selectedVals.length === 0) continue;
        const val = row[col];
        const valStr = (val === null || val === undefined) ? '' : String(val);
        if (!selectedVals.includes(valStr)) return false;
      }
      return true;
    });
  }, [activeSheet, filters]);

  const [xAxisCol, setXAxisCol] = useState(categoricalCols[0] || (activeSheet?.columns.length ? activeSheet.columns[0] : ''));
  const [yAxisCols, setYAxisCols] = useState<string[]>(numericCols.slice(0, 2));

  // Reset axes if switching sheets makes them invalid
  React.useEffect(() => {
    setFilters({});
    if (activeSheet) {
      if (!activeSheet.columns.includes(xAxisCol)) {
        setXAxisCol(categoricalCols[0] || activeSheet.columns[0]);
      }
      const validYCols = yAxisCols.filter(col => activeSheet.columns.includes(col));
      if (validYCols.length === 0 && numericCols.length > 0) {
        setYAxisCols(numericCols.slice(0, 2));
      } else if (validYCols.length !== yAxisCols.length) {
        setYAxisCols(validYCols);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheetIndex]);

  const chartData = useMemo(() => {
    if (!activeSheet || !xAxisCol || yAxisCols.length === 0) return [];
    
    const grouped: Record<string, any> = {};
    filteredData.forEach(row => {
      let xVal = row[xAxisCol];
      if (xVal === null || xVal === undefined) xVal = 'N/A';
      
      const xKey = String(xVal);
      if (!grouped[xKey]) {
        grouped[xKey] = { [xAxisCol]: xKey };
        yAxisCols.forEach(y => grouped[xKey][y] = 0);
      }
      
      yAxisCols.forEach(y => {
        let val = row[y];
        if (typeof val === 'string' && !isNaN(Number(val))) val = Number(val);
        if (typeof val === 'number' && !isNaN(val)) {
          grouped[xKey][y] += val;
        }
      });
    });
    
    let result = Object.values(grouped);
    if (result.length > 100) {
      const primaryY = yAxisCols[0];
      result.sort((a, b) => (b[primaryY] || 0) - (a[primaryY] || 0));
      result = result.slice(0, 100);
    }
    return result;
  }, [filteredData, xAxisCol, yAxisCols]);

  const summaryStats = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return null;
    const stats: Record<string, { sum: number, avg: number, max: number, min: number }> = {};
    
    numericCols.slice(0, 4).forEach(col => {
      let sum = 0, max = -Infinity, min = Infinity, count = 0;
      filteredData.forEach(row => {
        let val = row[col];
        if (typeof val === 'string' && !isNaN(Number(val))) val = Number(val);
        if (typeof val === 'number' && !isNaN(val)) {
          sum += val;
          if (val > max) max = val;
          if (val < min) min = val;
          count++;
        }
      });
      stats[col] = {
        sum,
        avg: count > 0 ? sum / count : 0,
        max: max !== -Infinity ? max : 0,
        min: min !== Infinity ? min : 0
      };
    });
    return stats;
  }, [filteredData, numericCols]);

  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (Math.abs(num) >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toFixed(0);
  };

  const handleYAxisToggle = (col: string) => {
    if (yAxisCols.includes(col)) {
      if (yAxisCols.length > 1) setYAxisCols(yAxisCols.filter(c => c !== col));
    } else {
      if (yAxisCols.length < 5) setYAxisCols([...yAxisCols, col]);
    }
  };

  if (!activeSheet) return <div className="p-8 text-center text-gray-500">No sheet available.</div>;

  const renderChart = () => {
    if (chartData.length === 0) return <div className="flex h-[400px] items-center justify-center text-gray-500">Not enough numerical data to chart.</div>;

    const commonProps = {
      data: chartData,
      margin: { top: 20, right: 30, left: 20, bottom: (chartData.length > 15 ? 80 : 40) }
    };
    
    const XAxisComponent = (
      <XAxis 
        dataKey={xAxisCol} 
        angle={chartData.length > 15 ? -45 : 0} 
        textAnchor={chartData.length > 15 ? "end" : "middle"} 
        height={chartData.length > 15 ? 100 : 40} 
        tick={{ fontSize: 12, fill: '#9ca3af' }} 
        axisLine={{ stroke: '#e5e7eb' }}
        tickLine={false}
      />
    );
    
    const YAxisComponent = <YAxis tickFormatter={formatNumber} tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />;

    switch (chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={450}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              {XAxisComponent}
              {YAxisComponent}
              <RechartsTooltip formatter={(value: number) => [value.toLocaleString(undefined, {maximumFractionDigits:2}), undefined]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#111827' }} itemStyle={{ color: '#111827' }} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              {yAxisCols.map((col, i) => (
                <Line type="monotone" key={col} dataKey={col} stroke={COLORS[i % COLORS.length]} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }} activeDot={{ r: 6 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={450}>
            <AreaChart {...commonProps}>
              <defs>
                {yAxisCols.map((col, i) => (
                  <linearGradient key={`color${col}`} id={`color${col}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              {XAxisComponent}
              {YAxisComponent}
              <RechartsTooltip formatter={(value: number) => [value.toLocaleString(undefined, {maximumFractionDigits:2}), undefined]} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#111827' }} itemStyle={{ color: '#111827' }} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              {yAxisCols.map((col, i) => (
                <Area type="monotone" key={col} dataKey={col} stroke={COLORS[i % COLORS.length]} fillOpacity={1} fill={`url(#color${col})`} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'bar':
      default:
        return (
          <ResponsiveContainer width="100%" height={450}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              {XAxisComponent}
              {YAxisComponent}
              <RechartsTooltip formatter={(value: number) => [value.toLocaleString(undefined, {maximumFractionDigits:2}), undefined]} cursor={{ fill: '#f3f4f6' }} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#111827' }} itemStyle={{ color: '#111827' }} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              {yAxisCols.map((col, i) => (
                <Bar key={col} dataKey={col} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={60} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-800">
      <header className="bg-gray-50 border-b border-gray-200 sticky top-0 z-20 px-6 py-4 flex items-center justify-between shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button onClick={onReset} className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1 font-medium text-sm border border-transparent hover:border-gray-200">
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">Trở về</span>
          </button>
          <div className="h-6 w-[1px] bg-gray-200"></div>
          <div className="flex items-center gap-2">
            <Activity className="text-blue-500" size={24} />
            <h1 className="font-bold text-lg sm:text-xl text-gray-900 truncate max-w-[200px] sm:max-w-xs">{activeSheet.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 bg-gray-100 p-1 rounded-xl border border-gray-200">
          <button className={`px-4 py-1.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${viewMode === 'telecom' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'}`} onClick={() => setViewMode('telecom')}>
            <LayoutDashboard size={14} />
            <span className="hidden sm:inline">Tổng quan Kỹ thuật</span>
          </button>
          <button className={`px-4 py-1.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${viewMode === 'custom' ? 'bg-gray-200 text-gray-900 shadow-sm border border-gray-200' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'}`} onClick={() => setViewMode('custom')}>
            <BarChart2 size={14} />
            <span className="hidden sm:inline">Tùy chỉnh Biểu đồ</span>
          </button>
          <button className={`px-4 py-1.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${viewMode === 'table' ? 'bg-gray-200 text-gray-900 shadow-sm border border-gray-200' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'}`} onClick={() => setViewMode('table')}>
            <TableIcon size={14} />
            <span className="hidden sm:inline">Dữ liệu thô</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 w-full max-w-7xl mx-auto">
        {sheets.length > 1 && (
          <div className="mb-6 flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
            {sheets.map((sheet, idx) => (
              <button key={sheet.name} onClick={() => setActiveSheetIndex(idx)} className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${activeSheetIndex === idx ? 'bg-blue-600 text-gray-900 border border-blue-500 shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100 hover:text-gray-900'}`}>
                {sheet.name} ({sheet.data.length} dòng)
              </button>
            ))}
          </div>
        )}

        {filterableCols.length > 0 && viewMode !== 'table' && (
          <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-900">
              <Filter size={16} className="text-blue-500" />
              Bộ lọc dữ liệu nâng cao
              {Object.keys(filters).length > 0 && (
                <button onClick={() => setFilters({})} className="ml-auto text-xs text-rose-400 hover:text-rose-300 transition-colors">Xóa bộ lọc</button>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {filterableCols.slice(0, 8).map(f => (
                <div key={f.col} className="flex-1 min-w-[200px] max-w-[250px]">
                  <label className="text-[10px] text-gray-500 mb-1 block uppercase tracking-wider truncate" title={f.col}>{f.col}</label>
                  <MultiSelect 
                    col={f.col} 
                    values={f.values} 
                    selected={filters[f.col] || []} 
                    onChange={(vals) => {
                      setFilters(prev => {
                        if (vals.length === 0) {
                          const next = { ...prev };
                          delete next[f.col];
                          return next;
                        }
                        return { ...prev, [f.col]: vals };
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'telecom' ? (
          <TelecomDashboard sheet={activeSheet} filteredData={filteredData} />
        ) : viewMode === 'custom' ? (
          <div className="space-y-6">
            {summaryStats && numericCols.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(summaryStats).slice(0, 4).map(([col, stats]) => (
                  <div key={col} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex-1">
                    <div className="text-gray-500 uppercase tracking-wider text-xs font-medium flex items-center gap-2 mb-3">
                      <Hash size={14} className="text-blue-500" />
                      <span className="truncate">{col} (Sum)</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-4 font-mono tracking-tight">
                      {stats.sum.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200 text-xs text-gray-500 font-mono">
                      <div><span className="text-gray-600 font-sans uppercase text-[10px]">Avg:</span> <span className="text-gray-600">{stats.avg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span></div>
                      <div><span className="text-gray-600 font-sans uppercase text-[10px]">Max:</span> <span className="text-gray-600">{stats.max.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filteredData.length > 0 || Object.keys(filters).length > 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col lg:flex-row min-h-[500px]">
                {/* Sidebar */}
                <div className="w-full lg:w-72 bg-gray-50 border-r border-gray-200 p-6 flex flex-col gap-6">
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Biểu đồ</h3>
                    <div className="flex bg-gray-100 border border-gray-200 rounded-xl p-1 gap-1">
                      {['bar', 'line', 'area'].map((type) => (
                        <button key={type} onClick={() => setChartType(type as any)} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${chartType === type ? 'bg-gray-200 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Removing sidebar filters from custom chart area as we moved them to the top */}
                  
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">

                      <Tag size={14} /> Phân nhóm theo (Trục X)
                    </h3>
                    <select value={xAxisCol} onChange={(e) => setXAxisCol(e.target.value)} className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-800 focus:outline-none focus:border-blue-500 shadow-sm appearance-none">
                      {activeSheet.columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>

                  <div className="flex-1 flex flex-col min-h-[200px]">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Hash size={14} /> Chỉ số đo lường (Tối đa 5)
                    </h3>
                    <div className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                      {numericCols.map(col => {
                        const isActive = yAxisCols.includes(col);
                        return (
                          <label key={col} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border ${isActive ? 'bg-gray-100 border-blue-500/50 shadow-sm' : 'bg-gray-50 border-gray-200 hover:border-gray-500'}`}>
                            <div className="pt-0.5">
                              <input type="checkbox" className="w-3.5 h-3.5 text-blue-600 rounded bg-gray-100 border-gray-200 focus:ring-blue-500 focus:ring-offset-[#f9fafb]" checked={isActive} onChange={() => handleYAxisToggle(col)} />
                            </div>
                            <span className={`text-xs truncate flex-1 leading-tight ${isActive ? 'font-semibold text-blue-400' : 'font-medium text-gray-600'}`}>
                              {col}
                            </span>
                          </label>
                        );
                      })}
                      {numericCols.length === 0 && (
                        <div className="text-sm text-gray-500 italic p-4 bg-gray-100 rounded-xl border border-dashed border-gray-200 text-center">Không tìm thấy cột dữ liệu số nào.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="flex-1 p-6 relative flex flex-col bg-white">
                  <div className="mb-6 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">Phân tích:</span>
                    <div className="flex gap-1 flex-wrap">
                      {yAxisCols.length > 0 ? yAxisCols.map((col, i) => (
                        <span key={col} className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded bg-gray-100 border border-gray-200 text-gray-700 flex items-center gap-1.5 max-w-[150px]">
                           <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></span>
                           <span className="truncate">{col}</span>
                        </span>
                      )) : <span className="text-gray-500 text-xs italic">Chưa chọn</span>}
                    </div>
                    <span className="text-gray-500 text-xs mx-1">theo</span>
                    <span className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-[10px] uppercase tracking-wider text-gray-600 truncate max-w-[200px]">{xAxisCol}</span>
                  </div>
                  <div className="flex-1 w-full min-h-[450px]">
                    {renderChart()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center text-gray-500 flex flex-col items-center justify-center min-h-[500px]">
                <Database size={64} className="text-gray-600 mb-6" />
                <h3 className="text-xl font-bold text-gray-700 mb-2">Sheet trống</h3>
                <p>Không có dữ liệu trong sheet này để hiển thị.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
             <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                <Database size={14} className="text-blue-500" />
                Raw Data Preview (Auto-sampled)
              </h2>
              <div className="text-[10px] text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-200 flex items-center gap-2">
                <span>Sheet: {activeSheet.name}</span>
                <span className="text-gray-900 font-bold">{filteredData.length.toLocaleString()} rows {Object.keys(filters).length > 0 && '(filtered)'}</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-white relative">
              {filteredData.length > 0 ? (
                <table className="min-w-full text-xs text-left border-collapse font-mono">
                  <thead className="text-gray-500 bg-gray-50 sticky top-0 z-10 shadow-sm backdrop-blur-sm">
                    <tr>
                      <th className="p-4 border-b border-r border-gray-200 font-medium whitespace-nowrap w-16 text-center text-gray-600 bg-gray-50">#</th>
                      {activeSheet.columns.map((col) => (
                        <th key={col} className="p-4 border-b border-gray-200 font-medium whitespace-nowrap bg-gray-50 uppercase tracking-wider">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-600">
                    {filteredData.slice(0, 500).map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-100 transition-colors group">
                        <td className="p-4 text-gray-600 text-center border-r border-gray-100 group-hover:text-gray-500">{idx + 1}</td>
                        {activeSheet.columns.map((col) => {
                          const val = row[col];
                          const isNumber = typeof val === 'number' || (typeof val === 'string' && val !== '' && !isNaN(Number(val)));
                          return (
                            <td key={col} className={`p-4 truncate max-w-[300px] ${isNumber ? 'text-gray-700 text-right' : 'text-gray-600'}`}>
                              {val === null || val === undefined || val === '' ? (
                                <span className="text-gray-600 italic text-xs">null</span>
                              ) : isNumber ? (
                                Number(val).toLocaleString(undefined, {maximumFractionDigits: 4})
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 h-full text-gray-500">
                  <TableIcon size={48} className="text-gray-600 mb-4" />
                  <p>Không có dữ liệu.</p>
                </div>
              )}
            </div>
            {filteredData.length > 500 && (
              <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between px-6">
                <span className="text-[10px] text-gray-600">Showing 500 of {filteredData.length.toLocaleString()} entries</span>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
