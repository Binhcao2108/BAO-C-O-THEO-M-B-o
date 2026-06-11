export interface DataRow {
  [key: string]: any;
}

export interface SheetData {
  name: string;
  data: DataRow[];
  columns: string[];
}
