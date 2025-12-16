import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Search, Copy, Edit, Trash2, ChevronLeft, 
  Send, Wand2, Check, X, User, Save, 
  Bold, Italic, Underline, List
} from 'lucide-react';
import { Template, Category, VariableMap } from './types';
import { INITIAL_TEMPLATES, CATEGORY_COLORS } from './constants';
import { getTemplates, saveTemplates } from './services/storageService';
import { suggestContent } from './services/geminiService';

// --- Helper Functions ---

const generateId = () => Math.random().toString(36).substr(2, 9);

const extractVariables = (text: string): string[] => {
  // Extract variables, ignoring HTML tags
  const regex = /\{([^}]+)\}/g;
  const matches = text.match(regex);
  if (!matches) return [];
  return [...new Set(matches)].map(m => m.slice(1, -1));
};

const replaceVariables = (text: string, variables: VariableMap): string => {
  let newText = text;
  Object.entries(variables).forEach(([key, value]) => {
    // Replace all occurrences of {key}
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    // Simple HTML escaping for values to prevent breaking layout
    const safeValue = value ? value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : `{${key}}`;
    newText = newText.replace(regex, safeValue); 
  });
  return newText;
};

// Convert plain text newlines to HTML breaks if needed (migration helper)
const normalizeContent = (content: string): string => {
  if (!content) return '';
  // If it has no HTML tags but has newlines, convert to HTML
  if (!/<[a-z][\s\S]*>/i.test(content) && content.includes('\n')) {
    return content.replace(/\n/g, '<br>');
  }
  return content;
};

// Convert HTML to plain text for clipboard fallback
const htmlToPlainText = (html: string): string => {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  // Replace block elements with newlines
  const blockElements = ['p', 'div', 'br', 'li', 'tr'];
  blockElements.forEach(tag => {
    const elements = temp.getElementsByTagName(tag);
    for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (tag === 'br') {
            el.replaceWith('\n');
        } else {
            el.after('\n');
        }
    }
  });
  return temp.textContent || temp.innerText || '';
};

// --- Components ---

const RichTextEditor: React.FC<{
  initialValue: string;
  onChange: (val: string) => void;
  placeholder?: string;
}> = ({ initialValue, onChange, placeholder }) => {
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync initial value once
  useEffect(() => {
    if (editorRef.current && initialValue !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = initialValue;
    }
  }, [initialValue]);

  const execCommand = (command: string) => {
    document.execCommand(command, false);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div className="flex flex-col border border-gray-300 rounded-lg overflow-hidden bg-white h-full focus-within:ring-2 focus-within:ring-blue-500 transition-all">
      <div className="flex items-center gap-1 p-2 border-b bg-gray-50 text-gray-700">
        <button onClick={() => execCommand('bold')} className="p-1.5 hover:bg-gray-200 rounded" title="In đậm">
          <Bold className="w-4 h-4" />
        </button>
        <button onClick={() => execCommand('italic')} className="p-1.5 hover:bg-gray-200 rounded" title="In nghiêng">
          <Italic className="w-4 h-4" />
        </button>
        <button onClick={() => execCommand('underline')} className="p-1.5 hover:bg-gray-200 rounded" title="Gạch chân">
          <Underline className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-gray-300 mx-1"></div>
        <button onClick={() => execCommand('insertUnorderedList')} className="p-1.5 hover:bg-gray-200 rounded" title="Danh sách">
          <List className="w-4 h-4" />
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        className="flex-1 p-3 outline-none overflow-y-auto text-sm font-sans leading-relaxed min-h-[150px] empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        data-placeholder={placeholder}
        style={{ whiteSpace: 'pre-wrap' }}
      />
    </div>
  );
};

const App: React.FC = () => {
  // State
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>(Category.ALL);
  const [isEditing, setIsEditing] = useState(false); // True if creating or editing
  const [editForm, setEditForm] = useState<Partial<Template>>({});
  
  // Variable State (for filling out the template)
  const [variableValues, setVariableValues] = useState<VariableMap>({});
  
  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true); // For mobile responsiveness logic
  const [isCopied, setIsCopied] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);

  // Load initial data
  useEffect(() => {
    const loaded = getTemplates();
    // Normalize old data
    const normalized = loaded.map(t => ({
      ...t,
      content: normalizeContent(t.content)
    }));
    setTemplates(normalized);
  }, []);

  // Save on change
  useEffect(() => {
    if (templates.length > 0) {
      saveTemplates(templates);
    }
  }, [templates]);

  // Derived State
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      // Search in plain text version of content to avoid matching HTML tags
      const plainContent = htmlToPlainText(t.content).toLowerCase();
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            plainContent.includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === Category.ALL || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, selectedCategory]);

  const activeTemplate = useMemo(() => 
    templates.find(t => t.id === selectedTemplateId), 
  [templates, selectedTemplateId]);

  // Reset variables when template changes
  useEffect(() => {
    if (activeTemplate) {
      const vars = extractVariables(activeTemplate.content);
      const initialMap: VariableMap = {};
      vars.forEach(v => initialMap[v] = '');
      setVariableValues(initialMap);
      setIsCopied(false);
      
      // On mobile, hide sidebar when selecting a template
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    }
  }, [activeTemplate?.id]);

  // --- Handlers ---

  const handleCreateNew = () => {
    const newTemplate: Template = {
      id: generateId(),
      title: 'Mẫu tin nhắn mới',
      content: 'Chào <b>{danh_xung} {ten}</b>,<br>...',
      category: Category.CONSULTING,
      lastUsed: Date.now(),
    };
    setEditForm(newTemplate);
    setSelectedTemplateId(null); // Deselect current
    setIsEditing(true);
    setSidebarOpen(false); // Mobile UX
  };

  const handleEditStart = () => {
    if (activeTemplate) {
      setEditForm({ ...activeTemplate });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    if (!editForm.title || !editForm.content) return;

    if (activeTemplate && activeTemplate.id === editForm.id) {
      // Update existing
      setTemplates(prev => prev.map(t => t.id === editForm.id ? { ...t, ...editForm } as Template : t));
    } else {
      // Create new
      const newT = { ...editForm, id: generateId(), lastUsed: Date.now() } as Template;
      setTemplates(prev => [newT, ...prev]);
      setSelectedTemplateId(newT.id);
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm('Bạn có chắc muốn xóa mẫu này không?')) {
      setTemplates(prev => prev.filter(t => t.id !== activeTemplate?.id));
      setSelectedTemplateId(null);
      setSidebarOpen(true);
    }
  };

  const handleCopy = async () => {
    if (!activeTemplate) return;
    const finalHtml = replaceVariables(activeTemplate.content, variableValues);
    const finalPlainText = htmlToPlainText(finalHtml);
    
    try {
      // Create a ClipboardItem with both HTML and Plain Text
      const blobHtml = new Blob([finalHtml], { type: 'text/html' });
      const blobText = new Blob([finalPlainText], { type: 'text/plain' });
      
      const data = [new ClipboardItem({
          ["text/html"]: blobHtml,
          ["text/plain"]: blobText,
      })];
      
      await navigator.clipboard.write(data);
      
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      
      // Update last used
      setTemplates(prev => prev.map(t => 
        t.id === activeTemplate.id ? { ...t, lastUsed: Date.now() } : t
      ));
    } catch (err) {
      console.error('Failed to copy', err);
      // Fallback for browsers that don't support ClipboardItem fully
      try {
        await navigator.clipboard.writeText(finalPlainText);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (fallbackErr) {
        alert('Không thể copy. Vui lòng thử lại.');
      }
    }
  };

  const handleAiSuggestion = async () => {
    if (!aiPrompt.trim() || !editForm.content) return;
    
    setIsGeneratingAI(true);
    try {
      const newContent = await suggestContent(editForm.content, aiPrompt);
      setEditForm(prev => ({ ...prev, content: newContent }));
      setShowAiModal(false);
      setAiPrompt('');
    } catch (error) {
      alert("Lỗi khi gọi AI: " + (error as Error).message);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleBackToList = () => {
    setSidebarOpen(true);
    setSelectedTemplateId(null);
    setIsEditing(false);
  };

  // --- Render Sections ---

  const renderSidebar = () => (
    <div className={`
      fixed inset-0 z-20 md:static md:inset-auto md:w-80 lg:w-96 flex flex-col bg-white border-r border-gray-200 h-full transform transition-transform duration-300 ease-in-out
      ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    `}>
      <div className="p-4 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
            <Send className="w-6 h-6" /> InsureChat
          </h1>
          <button 
            onClick={handleCreateNew}
            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition shadow-md"
            aria-label="Tạo mới"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text"
            placeholder="Tìm kiếm mẫu tin..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {Object.values(Category).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`
                whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors border
                ${selectedCategory === cat 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}
              `}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            Không tìm thấy mẫu nào.
          </div>
        ) : (
          filteredTemplates.map(t => {
            const plainPreview = htmlToPlainText(t.content);
            return (
              <div 
                key={t.id}
                onClick={() => setSelectedTemplateId(t.id)}
                className={`
                  p-3 rounded-lg cursor-pointer border transition-all hover:shadow-sm
                  ${selectedTemplateId === t.id 
                    ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500' 
                    : 'bg-white border-gray-200 hover:border-blue-300'}
                `}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-gray-800 line-clamp-1">{t.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${CATEGORY_COLORS[t.category]}`}>
                    {t.category}
                  </span>
                </div>
                <p className="text-sm text-gray-500 line-clamp-2">{plainPreview}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderEditMode = () => (
    <div className="flex flex-col h-full bg-white md:rounded-l-none">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
        <button onClick={() => { setIsEditing(false); if(!activeTemplate) setSidebarOpen(true); }} className="text-gray-500 hover:text-gray-700">
          <X className="w-6 h-6" />
        </button>
        <h2 className="font-bold text-gray-800">
          {editForm.id ? 'Chỉnh sửa mẫu' : 'Tạo mẫu mới'}
        </h2>
        <button 
          onClick={handleSave}
          className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
        >
          <Save className="w-4 h-4" /> Lưu
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tên mẫu tin</label>
          <input 
            type="text" 
            value={editForm.title || ''}
            onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Ví dụ: Nhắc đóng phí..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nhóm / Thẻ</label>
          <div className="flex flex-wrap gap-2">
            {Object.values(Category).filter(c => c !== Category.ALL).map(cat => (
              <button
                key={cat}
                onClick={() => setEditForm(prev => ({ ...prev, category: cat }))}
                className={`
                  px-3 py-1.5 rounded-md text-sm border transition-colors
                  ${editForm.category === cat 
                    ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium' 
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}
                `}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-[300px]">
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-700">Nội dung tin nhắn</label>
            <button 
              onClick={() => setShowAiModal(true)}
              className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-800 bg-purple-50 px-2 py-1 rounded-md transition-colors"
            >
              <Wand2 className="w-3 h-3" /> Viết lại với AI
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Sử dụng <code>{`{ten_bien}`}</code> để tạo nội dung thay đổi được. Bôi đen văn bản để in đậm/nghiêng.
          </p>
          <div className="flex-1">
            <RichTextEditor 
              initialValue={editForm.content || ''}
              onChange={(val) => setEditForm(prev => ({ ...prev, content: val }))}
              placeholder="Nhập nội dung tin nhắn..."
            />
          </div>
        </div>
      </div>

      {/* AI Modal */}
      {showAiModal && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-600" /> Trợ lý AI
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Bạn muốn AI sửa nội dung hiện tại như thế nào?
            </p>
            <textarea 
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 mb-4 h-24 text-sm"
              placeholder="Ví dụ: Làm cho giọng văn thân thiện hơn, thêm emoji, ngắn gọn lại..."
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
              >
                Hủy
              </button>
              <button 
                onClick={handleAiSuggestion}
                disabled={isGeneratingAI}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 flex items-center gap-2"
              >
                {isGeneratingAI ? 'Đang viết...' : 'Thực hiện'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderViewMode = () => {
    if (!activeTemplate) return (
      <div className="hidden md:flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50">
        <Send className="w-16 h-16 mb-4 text-gray-300" />
        <p>Chọn một mẫu tin nhắn để bắt đầu</p>
      </div>
    );

    const variables = extractVariables(activeTemplate.content);
    const finalPreview = replaceVariables(activeTemplate.content, variableValues);

    return (
      <div className="flex flex-col h-full bg-white relative">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center gap-3 bg-white sticky top-0 z-10">
          <button 
            onClick={handleBackToList} 
            className="md:hidden flex items-center gap-1 text-gray-600 hover:text-blue-600 pr-2 border-r border-gray-200 mr-2"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Danh sách</span>
          </button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 rounded-full ${CATEGORY_COLORS[activeTemplate.category]}`}>
                {activeTemplate.category}
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight mt-1 truncate">{activeTemplate.title}</h2>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={handleEditStart} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition">
              <Edit className="w-5 h-5" />
            </button>
            <button onClick={handleDelete} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition">
              <Trash2 className="w-5 h-5" />
            </button>
            {/* Desktop Close Button */}
            <button onClick={() => setSelectedTemplateId(null)} className="hidden md:block p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition ml-1" title="Đóng">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            
            {/* Input Variables Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <User className="w-4 h-4" /> Thông tin khách hàng
              </h3>
              
              {variables.length === 0 ? (
                <p className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  Mẫu này không có biến cần điền.
                </p>
              ) : (
                <div className="grid gap-3">
                  {variables.map(v => (
                    <div key={v}>
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                        {v.replace(/_/g, ' ')}
                      </label>
                      <input 
                        type="text"
                        value={variableValues[v] || ''}
                        onChange={(e) => setVariableValues(prev => ({ ...prev, [v]: e.target.value }))}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                        placeholder={`Nhập ${v}...`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preview Section */}
            <div className="flex flex-col h-full">
               <h3 className="font-semibold text-gray-700 mb-2 flex items-center justify-between">
                <span>Xem trước tin nhắn</span>
                {isCopied && <span className="text-xs text-green-600 font-medium flex items-center gap-1"><Check className="w-3 h-3" /> Đã copy</span>}
              </h3>
              <div className="flex-1 relative">
                {/* HTML Preview Area */}
                <div
                  className="w-full h-full min-h-[300px] p-4 bg-blue-50/50 border border-blue-100 rounded-xl text-gray-800 text-base leading-relaxed overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: finalPreview }}
                />
                
                <div className="absolute bottom-4 right-4">
                  <button
                    onClick={handleCopy}
                    className={`
                      flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-lg transition-all transform active:scale-95
                      ${isCopied 
                        ? 'bg-green-500 text-white' 
                        : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-200'}
                    `}
                  >
                    {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    {isCopied ? 'Đã sao chép' : 'Sao chép tin nhắn'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                * Tin nhắn đã được copy kèm định dạng (in đậm, nghiêng) để gửi qua Zalo / Messenger.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-full flex overflow-hidden bg-gray-100">
      {/* Sidebar - Conditional rendering for mobile */}
      {renderSidebar()}
      
      {/* Main Content Area */}
      <div className={`
        flex-1 flex flex-col h-full bg-white transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'hidden md:flex' : 'flex w-full fixed inset-0 z-30'}
      `}>
        {isEditing ? renderEditMode() : renderViewMode()}
      </div>
    </div>
  );
};

export default App;