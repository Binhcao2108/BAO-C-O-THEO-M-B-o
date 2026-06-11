import React, { useMemo, useState } from 'react';
import { SheetData } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { AlertCircle, Activity, ArrowRight, ServerCrash, Users, Search, Download } from 'lucide-react';
import { findColumnByKeywords, COL_KEYWORDS, getIssueCategory, summarizeText } from '../utils/telecomMappings';

interface Props {
  sheet: SheetData;
  filteredData: any[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const getErrorTags = (text: string, row?: any): string[] => {
  const tags: string[] = [];
  
  if (text && text !== 'N/A' && text !== 'Chưa phát hiện lỗi') {
    const lower = text.toLowerCase();
    if (lower.includes('los') || lower.includes('mất tín hiệu') || lower.includes('đèn đỏ')) tags.push('Mất tín hiệu (LOS)');
    if (lower.includes('suy hao') || lower.match(/rx\s*-\d+/) || lower.includes('quang yếu')) tags.push('Suy hao quang');
    if (lower.includes('nguồn') || lower.includes('power') || lower.includes('tắt')) tags.push('Lỗi nguồn');
    if (lower.includes('nhiệt độ') || lower.includes('temperature') || lower.includes('quá nhiệt')) tags.push('Quá nhiệt');
    if (lower.includes('treo') || lower.includes('reboot') || lower.includes('khởi động')) tags.push('Treo / Reboot');
    if (lower.includes('rssi') || lower.includes('wifi yếu') || lower.includes('wifi kém')) tags.push('Wifi yếu (RSSI)');
    if (lower.includes('band steering')) tags.push('Tắt Band Steering');
    if (lower.includes('lan 100') || lower.includes('nhận 100') || lower.includes('dây lan') || lower.includes('lan')) tags.push('Lỗi dây LAN / Cổng 100M');
    if (lower.includes('mesh')) tags.push('Lỗi Mesh');
    if (lower.includes('cáp') || lower.includes('đứt')) tags.push('Đứt / Lỗi Cáp');
    if (lower.includes('xong') || lower.includes('hoàn thành') || lower.includes('done')) tags.push('Đã xử lý (Xong)');
    if (lower.includes('chưa') || lower.includes('đang')) tags.push('Đang hoặc Chưa xử lý');
  }

  // Check explicit indicator columns in the row with value 1, true, or similar true-like values
  if (row) {
    const isTrue = (val: any) => String(val).trim() === '1' || String(val).trim().toLowerCase() === 'true' || String(val).trim().toLowerCase() === 'yes';
    Object.keys(row).forEach(key => {
      const kLower = key.toLowerCase();
      if (isTrue(row[key])) {
        if (kLower.includes('weakrssi') || kLower.includes('wifi kém') || kLower.includes('wifi yếu') || kLower.includes('ổn định wifi')) {
          tags.push('Wifi yếu (RSSI)');
        }
        if (kLower.includes('lan') && kLower.includes('100')) {
          tags.push('Lỗi dây LAN / Cổng 100M');
        }
        if (kLower.includes('mất tín hiệu') || kLower.includes('los')) {
          tags.push('Mất tín hiệu (LOS)');
        }
        if (kLower.includes('suy hao') || kLower.includes('quang yếu')) {
          tags.push('Suy hao quang');
        }
      } else if (String(row[key]).trim() === '0') {
        // If an explicit indicator column says 0, maybe we should remove the tag if it was false-positively added by text parsing?
        // E.g. "Wifi kém- weakRssi" is 0 -> it is NOT weak wifi.
        if (kLower.includes('weakrssi') || kLower.includes('wifi kém') || kLower.includes('wifi yếu') || kLower.includes('ổn định wifi')) {
          const index = tags.indexOf('Wifi yếu (RSSI)');
          if (index > -1) tags.splice(index, 1);
        }
        if (kLower.includes('lan') && kLower.includes('100')) {
          const index = tags.indexOf('Lỗi dây LAN / Cổng 100M');
          if (index > -1) tags.splice(index, 1);
        }
      }
    });
  }

  // Deduplicate tags
  return Array.from(new Set(tags));
};

const ErrorDetail = ({ text, tags = [], color = 'rose' }: { text: string, tags?: string[], color?: 'rose' | 'amber' }) => {
  if (!text || text === 'N/A' || text === 'Chưa phát hiện lỗi') return <span className="text-gray-500 italic">Chưa phát hiện lỗi</span>;
  
  let cleanDesc = text.trim();
  if (cleanDesc.length > 200) cleanDesc = cleanDesc.substring(0, 200) + '...';

  const isRose = color === 'rose';

  return (
    <div className="flex flex-col gap-2 w-full max-w-[350px]" title={text}>
      <span className={`text-xs leading-relaxed font-sans ${isRose ? 'text-rose-800' : 'text-amber-800'}`}>{cleanDesc}</span>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(t => (
            <span key={t} className={`px-2 py-0.5 border rounded text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap shadow-sm ${
              isRose 
                ? 'bg-rose-50 border-rose-200 text-rose-700' 
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default function TelecomDashboard({ sheet, filteredData }: Props) {
  const [filterDetect, setFilterDetect] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const telecomData = useMemo(() => {
    if (!sheet || filteredData.length === 0) return null;

    const cols = sheet.columns;
    const regionCol = findColumnByKeywords(cols, COL_KEYWORDS.region);
    const causeCol = findColumnByKeywords(cols, COL_KEYWORDS.cause);
    const warningCol = findColumnByKeywords(cols, COL_KEYWORDS.warning);
    const accountCol = findColumnByKeywords(cols, COL_KEYWORDS.account);
    const modemCol = findColumnByKeywords(cols, COL_KEYWORDS.modem);
    const statusCol = findColumnByKeywords(cols, COL_KEYWORDS.status);
    
    // We try to find the "reason" or "warning" by combining
    const getReason = (row: any) => {
      let r = '';
      if (causeCol && row[causeCol]) r += String(row[causeCol]) + ' ';
      if (warningCol && row[warningCol]) r += String(row[warningCol]);
      return r.trim();
    };

    const causesCount: Record<string, number> = {};
    const categoryCount: Record<string, number> = {};
    const regionCount: Record<string, number> = {};
    const modemCount: Record<string, number> = {};
    const detectCount: Record<string, number> = {};
    const statusCount: Record<string, number> = {};

    const actionList: any[] = [];
    const uniqueDetectTags = new Set<string>();
    const uniqueStatusTags = new Set<string>();

    filteredData.forEach((row, idx) => {
      const pReason = getReason(row);
      const category = getIssueCategory(pReason);
      
      const region = regionCol && row[regionCol] ? String(row[regionCol]) : 'Unknown';
      const user = accountCol && row[accountCol] ? String(row[accountCol]) : `Cus-${idx}`;
      const modem = modemCol && row[modemCol] ? String(row[modemCol]) : 'Unknown';
      
      const rawDetectedError = warningCol && row[warningCol] ? String(row[warningCol]) : (causeCol && row[causeCol] ? String(row[causeCol]) : 'Chưa phát hiện lỗi');
      const rawStatusValue = statusCol && row[statusCol] ? String(row[statusCol]) : 'Chưa phát hiện lỗi';
      
      const detectedError = summarizeText(rawDetectedError);
      const statusValue = summarizeText(rawStatusValue);
      
      if (pReason) {
        causesCount[pReason] = (causesCount[pReason] || 0) + 1;
      }

      categoryCount[category] = (categoryCount[category] || 0) + 1;
      regionCount[region] = (regionCount[region] || 0) + 1;
      modemCount[modem] = (modemCount[modem] || 0) + 1;

      const detectTags = getErrorTags(rawDetectedError || detectedError, row);
      if (detectTags.length === 0) {
        detectCount['Chưa phát hiện lỗi'] = (detectCount['Chưa phát hiện lỗi'] || 0) + 1;
      } else {
        detectTags.forEach(t => {
          uniqueDetectTags.add(t);
          detectCount[t] = (detectCount[t] || 0) + 1;
        });
      }

      const realStatus = rawStatusValue !== 'Chưa phát hiện lỗi' && rawStatusValue ? String(rawStatusValue).trim() : 'Chưa phát hiện lỗi';
      const statusTags = realStatus !== 'Chưa phát hiện lỗi' && realStatus !== '' ? [realStatus] : [];
      statusTags.forEach(t => {
        uniqueStatusTags.add(t);
      });
      
      if (realStatus !== 'Chưa phát hiện lỗi' && realStatus !== '') {
        statusCount[realStatus] = (statusCount[realStatus] || 0) + 1;
      } else {
        statusCount['Chưa phát hiện lỗi'] = (statusCount['Chưa phát hiện lỗi'] || 0) + 1;
      }

      // add all items to action list
      actionList.push({
        user,
        region,
        modem,
        detectedError,
        rawDetectedError,
        status: statusValue,
        rawStatus: rawStatusValue,
        detectTags,
        statusTags
      });
    });

    const paretoCauses = Object.entries(causesCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name: name.length > 50 ? name.substring(0, 50) + '...' : name, count }));

    const categoryData = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
      
    const regionData = Object.entries(regionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name: name.length > 15 ? name.substring(0, 15) : name, count }));

    const modemData = Object.entries(modemCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name: name.length > 20 ? name.substring(0, 20) : name, count }));

    const paretoDetects = Object.entries(detectCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name: name.length > 50 ? name.substring(0, 50) + '...' : name, count }));

    const paretoStatus = Object.entries(statusCount)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name: name.length > 50 ? name.substring(0, 50) + '...' : name, count }));

    return {
      total: filteredData.length,
      paretoCauses,
      paretoDetects,
      paretoStatus,
      categoryData,
      regionData,
      modemData,
      actionList,
      availableDetectTags: Array.from(uniqueDetectTags).sort().concat(detectCount['Chưa phát hiện lỗi'] ? ['Chưa phát hiện lỗi'] : []),
      availableStatusTags: Array.from(uniqueStatusTags).sort().concat(statusCount['Chưa phát hiện lỗi'] ? ['Chưa phát hiện lỗi'] : [])
    };

  }, [sheet, filteredData]);

  if (!telecomData) return <div className="p-8 text-center text-gray-500">Đang phân tích dữ liệu...</div>;

  const displayedActions = telecomData.actionList.filter(a => {
    if (filterDetect) {
      if (filterDetect === 'Chưa phát hiện lỗi') {
        if (a.detectTags.length > 0) return false;
      } else {
        if (!a.detectTags.includes(filterDetect)) return false;
      }
    }
    if (filterStatus) {
      if (filterStatus === 'Chưa phát hiện lỗi') {
        if (a.statusTags.length > 0 && a.statusTags[0] !== 'Chưa phát hiện lỗi') return false;
      } else {
        if (!a.statusTags.includes(filterStatus)) return false;
      }
    }
    return true;
  });

  const topModem = telecomData.modemData[0]?.name || 'N/A';
  const topRegion = telecomData.regionData[0]?.name || 'N/A';
  const topCause = telecomData.paretoCauses[0]?.name || 'N/A';

  const handleDownloadCSV = () => {
    if (displayedActions.length === 0) return;

    const headers = ['Account / Thuê bao', 'Vùng / Region', 'Thiết bị / Modem', 'Lỗi Detect', 'Tình trạng'];
    const csvContent = [
      headers.join(','),
      ...displayedActions.map(a => 
        [
          `"${a.user || ''}"`,
          `"${a.region || ''}"`,
          `"${a.modem || ''}"`,
          `"${(a.rawDetectedError || a.detectedError || '').replace(/"/g, '""')}"`,
          `"${(a.rawStatus || a.status || '').replace(/"/g, '""')}"`
        ].join(',')
      )
    ].join('\n');

    // Add BOM for UTF-8 Excel support
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `danh_sach_loi_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-50 rounded-full blur-xl group-hover:bg-blue-100 transition-all"></div>
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <div className="p-2 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
              <Activity size={18} />
            </div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tổng Thiết bị / Thuê bao</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900 font-mono mt-1 relative z-10">{telecomData.total.toLocaleString()}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-amber-50 rounded-full blur-xl group-hover:bg-amber-100 transition-all"></div>
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <div className="p-2 bg-amber-50 border border-amber-100 rounded-xl text-amber-600">
              <ServerCrash size={18} />
            </div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dòng Modem Nhiều Nhất</h3>
          </div>
          <div className="text-lg font-bold text-gray-900 mt-2 relative z-10 truncate" title={topModem}>{topModem}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-50 rounded-full blur-xl group-hover:bg-emerald-100 transition-all"></div>
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600">
              <Users size={18} />
            </div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Khu Vực Phát Sinh Nhiều</h3>
          </div>
          <div className="text-lg font-bold text-gray-900 mt-2 relative z-10 truncate" title={topRegion}>{topRegion}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-rose-50 rounded-full blur-xl group-hover:bg-rose-100 transition-all"></div>
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <div className="p-2 bg-rose-50 border border-rose-100 rounded-xl text-rose-600">
              <AlertCircle size={18} />
            </div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lỗi Phổ Biến Nhất</h3>
          </div>
          <div className="text-lg font-bold text-gray-900 mt-2 relative z-10 truncate" title={topCause}>{topCause}</div>
        </div>
      </div>

      {/* Row 1 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pareto Detects */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-500" /> Nhóm lỗi detect thường gặp
          </h3>
          <div className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
              <BarChart data={telecomData.paretoDetects} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} width={250} />
                <RechartsTooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px', color: '#111827' }} />
                <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Initial Detect Error / Status */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <Activity size={16} className="text-amber-500" /> Tình trạng lỗi ban đầu
          </h3>
          <div className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
              <BarChart data={telecomData.paretoStatus} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} width={250} />
                <RechartsTooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px', color: '#111827' }} />
                <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2 Charts */}
      <div className="grid grid-cols-1 gap-6">
        {/* Modem Chart */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <ServerCrash size={16} className="text-blue-500" /> Phân loại theo Modem (Thiết bị)
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={telecomData.modemData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px', color: '#111827' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Action List */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <ArrowRight size={16} className="text-blue-500" /> Danh sách thiết bị / thuê bao lỗi ({displayedActions.length} kết quả)
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={filterDetect}
                onChange={e => setFilterDetect(e.target.value)}
                className="pl-3 pr-8 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full sm:w-48 appearance-none cursor-pointer"
              >
                <option value="">Tất cả lỗi (Detect)</option>
                {telecomData.availableDetectTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
            <div className="relative">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="pl-3 pr-8 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full sm:w-48 appearance-none cursor-pointer"
              >
                <option value="">Tất cả tình trạng</option>
                {telecomData.availableStatusTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
            
            <button
              onClick={handleDownloadCSV}
              disabled={displayedActions.length === 0}
              className="px-3 py-1.5 flex items-center gap-1.5 text-sm bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors ml-auto md:ml-0"
              title="Xuất CSV danh sách hiện tại"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Xuất CSV</span>
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                <th className="pb-3 px-4 font-medium">Số hợp đồng</th>
                <th className="pb-3 px-4 font-medium">Địa lý</th>
                <th className="pb-3 px-4 font-medium">Modem</th>
                <th className="pb-3 px-4 font-medium">Lỗi Detect</th>
                <th className="pb-3 px-4 font-medium">Tình trạng lỗi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedActions.map((action, i) => (
                <tr key={i} className="group hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 text-gray-900 font-mono text-xs align-top whitespace-nowrap">{action.user}</td>
                  <td className="py-3 px-4 text-gray-600 text-xs align-top">{action.region}</td>
                  <td className="py-3 px-4 text-blue-600 font-mono text-xs align-top min-w-[120px]">{action.modem}</td>
                  <td className="py-3 px-4 align-top">
                    <ErrorDetail text={action.detectedError} tags={action.detectTags} color="rose" />
                  </td>
                  <td className="py-3 px-4 align-top">
                    <ErrorDetail text={action.status} tags={action.statusTags} color="amber" />
                  </td>
                </tr>
              ))}
              {displayedActions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500 italic">Không tìm thấy dữ liệu.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
