import { GoogleGenAI } from "@google/genai";

// Note: In a real production app, you should not expose the key on the client side directly 
// without restrictions, but for this requested architecture it is used via process.env.
const apiKey = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey: apiKey });

export const suggestContent = async (currentContent: string, instruction: string): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key chưa được cấu hình.");
  }

  try {
    const prompt = `
      Bạn là một trợ lý viết tin nhắn chuyên nghiệp cho tư vấn viên bảo hiểm nhân thọ tại Việt Nam.
      
      Nhiệm vụ: Viết lại hoặc cải thiện nội dung tin nhắn dưới đây theo yêu cầu: "${instruction}".
      
      Nội dung gốc (HTML):
      "${currentContent}"
      
      Yêu cầu bắt buộc:
      1. Giữ nguyên các biến trong ngoặc nhọn, ví dụ {ten_khach}, {danh_xung} nếu có.
      2. Văn phong tự nhiên, chân thành, chuyên nghiệp, phù hợp với văn hóa Việt Nam.
      3. Trả về kết quả dưới dạng HTML đơn giản (sử dụng <b> để in đậm, <i> để in nghiêng, <br> để xuống dòng). KHÔNG dùng Markdown.
      4. Chỉ trả về nội dung tin nhắn mới, không bao gồm lời dẫn hay giải thích.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || currentContent;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};