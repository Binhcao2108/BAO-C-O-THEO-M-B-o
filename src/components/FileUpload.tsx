import React, { useCallback, useState } from 'react';
import { UploadCloud, FileSpreadsheet, PieChart, Table } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SheetData, DataRow } from '../types';

interface FileUploadProps {
  onDataLoaded: (sheets: SheetData[]) => void;
}

export default function FileUpload({ onDataLoaded }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const processFile = async (file: File) => {
    setIsLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      const sheetsData: SheetData[] = workbook.SheetNames.map(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<DataRow>(worksheet, { defval: null });
        
        let columns: string[] = [];
        if (json.length > 0) {
          columns = Object.keys(json[0]);
        }
        
        return {
          name: sheetName,
          data: json,
          columns
        };
      });
      
      onDataLoaded(sheetsData);
    } catch (error) {
      console.error("Error parsing file:", error);
      alert("Failed to parse the file. Please ensure it is a valid Excel or CSV file.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = function(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-4">Excel Data Dashboard</h1>
        <p className="text-gray-500 max-w-xl mx-auto text-lg">
          Tải lên file dữ liệu thô Excel (.xlsx, .csv) để tự động tạo Dashboard trực quan hóa và xem số liệu chi tiết.
        </p>
      </div>

      <div 
        className={`w-full max-w-3xl p-16 border-2 border-dashed rounded-2xl transition-all duration-200 ease-in-out flex flex-col items-center justify-center relative shadow-sm ${
          isDragging ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-gray-300 bg-white hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className={`p-5 rounded-full mb-6 ${isLoading ? 'bg-gray-100' : 'bg-blue-50 text-blue-600'}`}>
          {isLoading ? (
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          ) : (
            <UploadCloud size={48} strokeWidth={1.5} />
          )}
        </div>
        <h3 className="text-2xl font-semibold text-gray-800 mb-3">
          {isLoading ? 'Đang xử lý file...' : 'Tải lên hoặc kéo thả file Excel vào đây'}
        </h3>
        <p className="text-gray-500 text-center mb-8 max-w-sm">
          Hỗ trợ định dạng .xlsx, .xls, .csv. Dữ liệu của bạn được xử lý hoàn toàn trên trình duyệt, không tải lên server.
        </p>
        
        <label className="cursor-pointer bg-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm active:scale-95">
          Chọn File Mở Lên
          <input 
            type="file" 
            className="hidden" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleChange}
            disabled={isLoading}
          />
        </label>
      </div>
      
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl text-center">
         <div className="bg-white p-8 rounded-2xl border border-gray-200 flex flex-col items-center shadow-sm">
            <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-4">
              <FileSpreadsheet className="text-green-500" size={24} />
            </div>
            <h4 className="font-semibold text-gray-800 text-lg">Format Đa Dạng</h4>
            <p className="text-sm text-gray-500 mt-2">Hỗ trợ nhiều sheet, tự động nhận diện kiểu dữ liệu cột</p>
         </div>
         <div className="bg-white p-8 rounded-2xl border border-gray-200 flex flex-col items-center shadow-sm">
            <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-4">
              <PieChart className="text-purple-500" size={24} />
            </div>
            <h4 className="font-semibold text-gray-800 text-lg">Dashboard Động</h4>
            <p className="text-sm text-gray-500 mt-2">Biểu đồ thông minh tự động tóm tắt dữ liệu số lượng lớn</p>
         </div>
         <div className="bg-white p-8 rounded-2xl border border-gray-200 flex flex-col items-center shadow-sm">
            <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-4">
              <Table className="text-orange-500" size={24} />
            </div>
            <h4 className="font-semibold text-gray-800 text-lg">Raw Data View</h4>
            <p className="text-sm text-gray-500 mt-2">Duyệt dữ liệu dạng lưới table nhanh gọn và trực quan</p>
         </div>
      </div>
    </div>
  );
}
