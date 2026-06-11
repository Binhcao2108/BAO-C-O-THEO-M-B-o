export function findColumnByKeywords(columns: string[], keywords: string[]): string | null {
  // Try exact match first for accuracy
  for (const keyword of keywords) {
    for (const col of columns) {
      if (col.toLowerCase() === keyword.toLowerCase()) return col;
    }
  }
  // Fallback to substring match
  for (const keyword of keywords) {
    for (const col of columns) {
      if (col.toLowerCase().includes(keyword.toLowerCase())) return col;
    }
  }
  return null;
}

export const COL_KEYWORDS = {
  region: ['block', 'địa lý', 'khu vực', 'pyn', 'địa bàn', 'quận', 'huyện', 'chi nhánh', 'vùng'],
  cause: ['nguyên nhân', 'lỗi', 'reason', 'cause', 'dự đoán'],
  warning: ['lỗi detect', 'cảnh báo', 'warning', 'alert', 'mỹ bảo', 'detect'],
  status: ['tình trạng lỗi', 'trạng thái', 'tình trạng', 'status', 'kết quả'],
  modem: ['modem', 'thiết bị', 'mac', 'chủng loại', 'loại'],
  team: ['đội', 'kỹ thuật', 'ktv', 'nhóm', 'team', 'người xử lý'],
  date: ['ngày', 'thời gian', 'date', 'time', 'timestamp', 'created'],
  account: ['số hợp đồng', 'hợp đồng', 'mã thuê bao', 'thuê bao', 'tài khoản', 'account', 'user', 'id', 'khách hàng'],
  type: ['loại phản ánh', 'loại', 'ticket type']
};

export const summarizeText = (text: string) => {
  if (!text) return 'Chưa phát hiện lỗi';
  let t = String(text).trim();
  
  try {
    if (t.startsWith('{') && t.endsWith('}')) {
       const obj = JSON.parse(t);
       if (obj.message) t = obj.message;
       else if (obj.reason) t = obj.reason;
       else if (obj.error) t = obj.error;
    }
  } catch(e) {}
  
  // Remove technical prefixes and timestamps
  t = t.replace(/\d{4}-\d{2}-\d{2}\s?\d{2}:\d{2}:\d{2}/g, '');
  t = t.replace(/\d{2}\/\d{2}\/\d{4}\s?\d{2}:\d{2}:\d{2}/g, '');
  t = t.replace(/\[.*?\]\s*/g, '');
  t = t.replace(/^(error|warning|info|alert|debug)[:\-]?\s*/i, '');
  t = t.replace(/^mã lỗi[:\-]?\s*/i, '');
  
  // Shorten common customer / tech phrases
  const pairs: [RegExp, string][] = [
    [/khách hàng/ig, 'KH'],
    [/(thông báo|gọi lên|báo|phản ánh|yêu cầu)\s/ig, 'báo '],
    [/kỹ thuật viên/ig, 'KTV'],
    [/thiết bị đầu cuối/ig, 'TBĐC'],
    [/thiết bị/ig, 'TB'],
    [/liên hệ/ig, 'LH'],
    [/kiểm tra/ig, 'KT'],
    [/xử lý/ig, 'XL'],
    [/không thể/ig, 'k.thể'],
    [/không/ig, 'ko'],
    [/hiện tượng/ig, 'bị'],
    [/tình trạng/ig, 'bị'],
    [/nguyên nhân/ig, 'do'],
    [/mất kết nối/ig, 'mất KN'],
    [/tín hiệu quang/ig, 'quang'],
    [/băng thông/ig, 'BW'],
    [/hệ thống/ig, 'HT'],
    [/phát hiện/ig, 'thấy']
  ];

  for (const [regex, replacement] of pairs) {
    t = t.replace(regex, replacement);
  }
  
  t = t.replace(/\s+/g, ' ').trim();
  
  if (t.length > 0) {
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }
  
  if (t.length > 120) {
    t = t.substring(0, 120) + '...';
  }
  return t || 'Chưa phát hiện lỗi';
};

export const getIssueCategory = (text: string) => {
  if (!text) return 'Chưa phân loại';
  const lower = String(text).toLowerCase();
  if (lower.match(/los|quang|suy hao|đứt|rx|tx|tín hiệu|đỏ/)) return 'Tín hiệu (Quang)';
  if (lower.match(/rssi|band steering|mesh|wifi|lan|cấu hình|tối ưu|100m/)) return 'Thông số lỗi (Cấu hình/LAN)';
  if (lower.match(/nguồn|treo|firmware|nhiệt|hỏng|bộ định tuyến|router/)) return 'Thiết bị (Phần cứng)';
  if (lower.match(/vùng phủ|khoảng cách|khách hàng|thiết bị đầu cuối|điện thoại|pc/)) return 'Khách hàng (Môi trường/Đầu cuối)';
  return 'Chưa phân loại';
};
