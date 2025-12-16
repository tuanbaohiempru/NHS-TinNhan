export interface Template {
  id: string;
  title: string;
  content: string;
  category: Category;
  lastUsed: number;
}

export enum Category {
  ALL = 'Tất cả',
  PAYMENT = 'Nhắc phí',
  BIRTHDAY = 'Sinh nhật',
  CONSULTING = 'Tư vấn',
  CARE = 'Chăm sóc',
  CONTRACT = 'Hợp đồng'
}

export type VariableMap = Record<string, string>;
