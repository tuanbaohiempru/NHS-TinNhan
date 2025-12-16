import { Template, Category } from './types';

export const INITIAL_TEMPLATES: Template[] = [
  {
    id: '1',
    title: 'Nhắc đóng phí định kỳ',
    content: `Chào <b>{danh_xung} {ten_khach}</b>, chúc {danh_xung} một ngày tốt lành! ☀️<br><br>Em xin phép nhắc nhẹ {danh_xung} về kỳ phí bảo hiểm sắp đến hạn vào ngày <b>{ngay_dong_phi}</b> cho hợp đồng số <b>{ma_hop_dong}</b>.<br><br>Để đảm bảo quyền lợi bảo vệ liên tục, {danh_xung} nhớ đóng phí đúng hạn nhé. Cần hỗ trợ gì cứ nhắn em ạ!`,
    category: Category.PAYMENT,
    lastUsed: Date.now(),
  },
  {
    id: '2',
    title: 'Chúc mừng sinh nhật',
    content: `🎉 Chúc mừng sinh nhật <b>{danh_xung} {ten_khach}</b>!<br><br>Chúc {danh_xung} tuổi mới thật nhiều sức khỏe, hạnh phúc và thành công. Cảm ơn {danh_xung} đã tin tưởng đồng hành cùng em trong suốt thời gian qua. 🎂🎁`,
    category: Category.BIRTHDAY,
    lastUsed: Date.now() - 10000,
  },
  {
    id: '3',
    title: 'Hẹn gặp tư vấn lại',
    content: `Chào <b>{danh_xung} {ten_khach}</b>,<br><br>Dạo này công việc của {danh_xung} thế nào ạ? Em thấy gần đây công ty có ra mắt quyền lợi bổ sung mới rất hay về chăm sóc sức khỏe.<br><br>Nếu {danh_xung} rảnh vào <i>{thoi_gian_hen}</i>, em ghé qua cập nhật thông tin nhanh cho mình nhé?`,
    category: Category.CONSULTING,
    lastUsed: Date.now() - 20000,
  }
];

export const CATEGORY_COLORS: Record<Category, string> = {
  [Category.ALL]: 'bg-gray-100 text-gray-800',
  [Category.PAYMENT]: 'bg-red-100 text-red-800',
  [Category.BIRTHDAY]: 'bg-purple-100 text-purple-800',
  [Category.CONSULTING]: 'bg-blue-100 text-blue-800',
  [Category.CARE]: 'bg-green-100 text-green-800',
  [Category.CONTRACT]: 'bg-orange-100 text-orange-800',
};