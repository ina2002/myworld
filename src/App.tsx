import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Link as LinkIcon, 
  FileText, 
  Image as ImageIcon, 
  Star, 
  Search, 
  Trash2, 
  X, 
  Save,
  Upload,
  ExternalLink,
  Scissors,
  Table,
  Type as TypeIcon,
  Pencil,
  RotateCcw,
  Eraser
} from 'lucide-react';
import { ScrapbookItem, ItemType } from './types';
import { tagItem, semanticSearch, stickerifyImage } from './services/gemini';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [items, setItems] = useState<ScrapbookItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[] | null>(null);
  const [isAdding, setIsAdding] = useState<ItemType | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [brushColor, setBrushColor] = useState('#9B8E7E'); // Morandi Taupe
  const canvasRef = useRef<HTMLDivElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const res = await fetch('/api/items');
    const data = await res.json();
    setItems(data);
  };

  const saveItem = async (item: ScrapbookItem) => {
    await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    fetchItems();
  };

  const deleteItem = async (id: string) => {
    await fetch(`/api/items/${id}`, { method: 'DELETE' });
    fetchItems();
  };

  const handleAddItem = async (type: ItemType, data: Partial<ScrapbookItem>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newItem: ScrapbookItem = {
      id,
      type,
      x: Math.random() * 200 + 100,
      y: Math.random() * 200 + 100,
      rotation: 0,
      scale: 1,
      tags: [],
      ...data,
    };

    setLoading(true);
    if (type === 'note' || type === 'link') {
      const tags = await tagItem(newItem.content || newItem.title || '', type);
      newItem.tags = tags;
    }
    setLoading(false);

    await saveItem(newItem);
    setIsAdding(null);
  };

  const handleFileUpload = async (file: File, type: ItemType) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    const { file_path } = await res.json();
    
    if (type === 'sticker') {
      // Optional: stickerify
      handleAddItem('sticker', { file_path, title: file.name });
    } else {
      handleAddItem('pdf', { file_path, title: file.name });
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) {
      setSearchResults(null);
      return;
    }
    setLoading(true);
    const results = await semanticSearch(searchQuery, items);
    setSearchResults(results);
    setLoading(false);
  };

  const addStar = () => {
    handleAddItem('sticker', { 
      content: '⭐', 
      title: 'Star',
      scale: 0.5 + Math.random() * 0.5
    });
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsMouseDown(true);
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = isEraser ? '#000' : brushColor;
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.lineWidth = isEraser ? 20 : 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isMouseDown) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsMouseDown(false);
  };

  const clearDrawing = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveDrawing = async () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    
    // Check if canvas is empty (optional but good)
    const dataUrl = canvas.toDataURL('image/png');
    
    // Upload the drawing
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], "drawing.png", { type: "image/png" });
    
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    const { file_path } = await res.json();
    
    handleAddItem('drawing', { file_path, title: 'My Drawing' });
    setIsDrawing(false);
    setIsEraser(false);
    clearDrawing();
  };

  const exportToCSV = () => {
    if (items.length === 0) return;

    const headers = ['ID', 'Type', 'Title', 'Content', 'Tags', 'Rating', 'File Path'];
    const rows = items.map(item => [
      item.id,
      item.type,
      `"${(item.title || '').replace(/"/g, '""')}"`,
      `"${(item.content || '').replace(/"/g, '""')}"`,
      `"${(item.tags || []).join(', ')}"`,
      item.rating || '',
      item.file_path || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `scrapbook_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-[#1A1A1A] font-serif overflow-hidden flex flex-col">
      {/* Header */}
      <header className="p-4 md:p-6 border-b border-black/10 flex flex-col lg:flex-row gap-4 justify-between items-center bg-white/50 backdrop-blur-md z-50">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full lg:w-auto">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight italic">IdeaScrapbook</h1>
          <div className="hidden sm:block h-8 w-[1px] bg-black/10 mx-2" />
          <div className="flex flex-wrap justify-center gap-1 md:gap-2">
            <button onClick={() => setIsAdding('note')} className="p-2 hover:bg-black/5 rounded-full transition-colors" title="Add Note">
              <FileText size={20} />
            </button>
            <button onClick={() => setIsAdding('link')} className="p-2 hover:bg-black/5 rounded-full transition-colors" title="Add Link">
              <LinkIcon size={20} />
            </button>
            <label className="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer" title="Upload Image/PDF">
              <Upload size={20} />
              <input type="file" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.type.includes('image')) handleFileUpload(file, 'sticker');
                  else if (file.type.includes('pdf')) handleFileUpload(file, 'pdf');
                }
              }} />
            </label>
            <button onClick={addStar} className="p-2 hover:bg-black/5 rounded-full transition-colors text-yellow-500" title="Add Star">
              <Star size={20} fill="currentColor" />
            </button>
            <div className="w-[1px] h-6 bg-black/10 mx-1 self-center" />
            <button onClick={() => setIsAdding('text')} className="p-2 hover:bg-black/5 rounded-full transition-colors text-purple-500" title="Add Cute Text">
              <TypeIcon size={20} />
            </button>
            <div className="flex items-center gap-1 ml-1 md:ml-2">
              <button 
                onClick={() => {
                  setIsDrawing(!isDrawing);
                  if (!isDrawing) setIsEraser(false);
                }} 
                className={cn(
                  "p-2 rounded-full transition-all",
                  isDrawing ? "bg-black text-white scale-110" : "hover:bg-black/5 text-blue-500"
                )} 
                title="Brush Tool"
              >
                <Pencil size={20} />
              </button>
              {isDrawing && (
                <div className="flex flex-wrap items-center gap-1 ml-1 animate-in slide-in-from-left-2 bg-white/80 p-1 rounded-xl shadow-sm">
                  {['#9B8E7E', '#B8C4BB', '#D6C5C1', '#8E9775', '#6D8299'].map(color => (
                    <button 
                      key={color}
                      onClick={() => {
                        setBrushColor(color);
                        setIsEraser(false);
                      }}
                      className={cn(
                        "w-5 h-5 md:w-6 md:h-6 rounded-full border-2 transition-transform",
                        (!isEraser && brushColor === color) ? "border-black scale-125" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <button 
                    onClick={() => setIsEraser(!isEraser)} 
                    className={cn(
                      "p-1 rounded-full transition-all",
                      isEraser ? "bg-black text-white" : "hover:bg-black/5 text-black/60"
                    )}
                    title="Eraser"
                  >
                    <Eraser size={16} />
                  </button>
                  <button onClick={clearDrawing} className="p-1 hover:bg-black/5 rounded-full" title="Clear All">
                    <RotateCcw size={16} />
                  </button>
                  <button onClick={saveDrawing} className="px-2 py-1 bg-black text-white text-[10px] font-bold rounded-md ml-1">
                    DONE
                  </button>
                </div>
              )}
            </div>
            <div className="w-[1px] h-6 bg-black/10 mx-1 self-center" />
            <button onClick={exportToCSV} className="p-2 hover:bg-black/5 rounded-full transition-colors text-emerald-600" title="Export to CSV">
              <Table size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white border border-black/10 rounded-full px-4 py-1 shadow-sm w-full sm:w-auto">
          <Search size={18} className="text-black/40 shrink-0" />
          <input 
            type="text" 
            placeholder="Search ideas, skills, PDFs..." 
            className="bg-transparent outline-none w-full sm:w-64 text-sm py-1"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setSearchResults(null); }} className="text-black/40 hover:text-black shrink-0">
              <X size={14} />
            </button>
          )}
        </div>
      </header>

      {/* Main Canvas */}
      <main className="flex-1 relative overflow-auto p-4 md:p-20" ref={canvasRef}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        {isDrawing && (
          <canvas
            ref={drawingCanvasRef}
            width={Math.max(window.innerWidth * 2, 2000)}
            height={Math.max(window.innerHeight * 2, 2000)}
            className="absolute inset-0 z-[60] cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        )}

        <div className="relative w-full h-full min-h-[2000px] min-w-[2000px]">
          {items.map((item) => {
            const isSearchResult = searchResults?.includes(item.id);
            const isDimmed = searchResults !== null && !isSearchResult;

            return (
              <ScrapbookItemComponent 
                key={item.id} 
                item={item} 
                onDelete={() => deleteItem(item.id)}
                onUpdate={(updates) => {
                  // Optimistic update
                  setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...updates } : i));
                  saveItem({ ...item, ...updates });
                }}
                isDimmed={isDimmed}
                isHighlighted={isSearchResult}
              />
            );
          })}
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-black/10"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold italic">Add {isAdding}</h2>
                <button onClick={() => setIsAdding(null)} className="text-black/40 hover:text-black">
                  <X size={24} />
                </button>
              </div>

              {isAdding === 'note' && <NoteForm onSubmit={(data) => handleAddItem('note', data)} />}
              {isAdding === 'link' && <LinkForm onSubmit={(data) => handleAddItem('link', data)} />}
              {isAdding === 'text' && <TextForm onSubmit={(data) => handleAddItem('text', data)} />}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScrapbookItemComponent({ item, onDelete, onUpdate, isDimmed, isHighlighted }: { 
  item: ScrapbookItem, 
  onDelete: () => void, 
  onUpdate: (updates: Partial<ScrapbookItem>) => void,
  isDimmed: boolean,
  isHighlighted?: boolean
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [clipPath, setClipPath] = useState<string | null>(null);

  const handleStickerify = async () => {
    if (!item.file_path) return;
    try {
      // Convert image to base64 for Gemini
      const res = await fetch(item.file_path);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const { path } = await stickerifyImage(base64);
        setClipPath(`polygon(${path})`);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragEnd={(_, info) => {
        onUpdate({ x: item.x + info.offset.x, y: item.y + info.offset.y });
      }}
      initial={{ x: item.x, y: item.y, rotate: item.rotation, scale: item.scale }}
      animate={{ 
        x: item.x, 
        y: item.y, 
        rotate: item.rotation, 
        scale: isHighlighted ? item.scale * 1.1 : item.scale,
        opacity: isDimmed ? 0.3 : 1,
        zIndex: isHighlighted ? 100 : (item.content === '⭐' ? 80 : 10)
      }}
      className={cn(
        "absolute cursor-grab active:cursor-grabbing group",
        isHighlighted && "ring-4 ring-yellow-400 ring-offset-4 rounded-lg"
      )}
    >
      <div className="relative">
        {/* Controls */}
        <div 
          className="absolute -top-8 -right-8 md:-top-6 md:-right-6 flex gap-1 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity z-[110] cursor-default"
          onPointerDownCapture={(e) => e.stopPropagation()}
          onMouseDownCapture={(e) => e.stopPropagation()}
        >
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onUpdate({ rotation: (item.rotation + 15) % 360 });
            }}
            className="p-2 md:p-1.5 bg-white shadow-lg rounded-full hover:bg-black hover:text-white transition-colors border border-black/5"
            title="Rotate"
          >
            <RotateCcw size={16} className="md:w-[14px] md:h-[14px]" />
          </button>
          {item.type === 'sticker' && item.file_path && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleStickerify();
              }} 
              className="p-2 md:p-1.5 bg-white shadow-md rounded-full hover:bg-black hover:text-white transition-colors"
            >
              <Scissors size={16} className="md:w-[14px] md:h-[14px]" />
            </button>
          )}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }} 
            className="p-2 md:p-1.5 bg-white shadow-md rounded-full hover:bg-red-500 hover:text-white transition-colors"
          >
            <Trash2 size={16} className="md:w-[14px] md:h-[14px]" />
          </button>
        </div>

        {/* Content */}
        {item.type === 'text' && (
          <div className="font-cute text-3xl p-4 min-w-[100px] text-center select-none hover:bg-black/5 rounded-lg transition-colors">
            {item.content}
          </div>
        )}

        {item.type === 'drawing' && item.file_path && (
          <img 
            src={item.file_path} 
            alt="Drawing" 
            className="max-w-[400px] h-auto pointer-events-none select-none"
            referrerPolicy="no-referrer"
          />
        )}

        {item.type === 'note' && (
          <div className="bg-white p-6 shadow-xl border border-black/5 min-w-[250px] max-w-[400px] rounded-sm transform hover:scale-[1.02] transition-transform">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-6 bg-yellow-200/50 backdrop-blur-sm border border-yellow-300/30 rotate-2" />
            <h3 className="font-bold text-lg mb-2 border-b border-black/10 pb-1">{item.title}</h3>
            <div className="prose prose-sm font-sans text-sm leading-relaxed">
              <Markdown>{item.content}</Markdown>
            </div>
            <div className="mt-4 flex flex-wrap gap-1">
              {item.tags.map(tag => (
                <span key={tag} className="text-[10px] uppercase tracking-wider bg-black/5 px-1.5 py-0.5 rounded text-black/60">#{tag}</span>
              ))}
            </div>
          </div>
        )}

        {item.type === 'link' && (
          <div className="bg-white p-5 shadow-xl border border-black/5 min-w-[250px] rounded-xl flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <LinkIcon size={20} />
              </div>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={12} fill={i < (item.rating || 0) ? "#FBBF24" : "none"} className={i < (item.rating || 0) ? "text-yellow-400" : "text-gray-200"} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-1 line-clamp-1">{item.title}</h3>
              <p className="text-xs text-black/60 line-clamp-2 italic">"{item.content}"</p>
            </div>
            <a href={item.title} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-2 bg-black text-white text-xs rounded-lg hover:bg-black/80 transition-colors">
              Visit Link <ExternalLink size={12} />
            </a>
          </div>
        )}

        {item.type === 'sticker' && (
          <div className="relative group">
            {item.file_path ? (
              <div 
                className="bg-white p-2 shadow-2xl rounded-sm"
                style={{ clipPath: clipPath || 'none' }}
              >
                <img 
                  src={item.file_path} 
                  alt={item.title} 
                  className="max-w-[200px] h-auto rounded-sm"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="text-6xl select-none drop-shadow-lg filter hover:scale-110 transition-transform">
                {item.content}
              </div>
            )}
          </div>
        )}

        {item.type === 'pdf' && (
          <div className="bg-[#1A1A1A] text-white p-4 shadow-2xl rounded-lg min-w-[180px] flex flex-col items-center gap-3 border border-white/10">
            <div className="w-12 h-16 bg-red-500 rounded flex items-center justify-center shadow-inner">
              <span className="font-bold text-xs">PDF</span>
            </div>
            <div className="text-center">
              <h3 className="text-xs font-bold line-clamp-2 mb-1">{item.title}</h3>
              <a href={item.file_path} target="_blank" rel="noopener noreferrer" className="text-[10px] text-white/60 hover:text-white underline">
                Open Document
              </a>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TextForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [text, setText] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <input 
        type="text" 
        placeholder="Type something cute..." 
        className="w-full text-3xl font-cute border-b border-black/10 py-4 outline-none focus:border-black transition-colors text-center"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <button 
        onClick={() => onSubmit({ content: text })}
        className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black/80 transition-all active:scale-95"
      >
        <Save size={20} /> Add Text
      </button>
    </div>
  );
}

function NoteForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <input 
        type="text" 
        placeholder="Idea Title..." 
        className="w-full text-xl font-bold border-b border-black/10 py-2 outline-none focus:border-black transition-colors"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea 
        placeholder="Write your thoughts here (Markdown supported)..." 
        className="w-full h-40 font-sans text-sm p-4 bg-black/5 rounded-xl outline-none focus:bg-black/[0.08] transition-colors resize-none"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button 
        onClick={() => onSubmit({ title, content })}
        className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black/80 transition-all active:scale-95"
      >
        <Save size={20} /> Save to Scrapbook
      </button>
    </div>
  );
}

function LinkForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [url, setUrl] = useState('');
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(3);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-widest text-black/40">URL</label>
        <input 
          type="text" 
          placeholder="https://..." 
          className="w-full border-b border-black/10 py-2 outline-none focus:border-black transition-colors"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-widest text-black/40">Your Evaluation</label>
        <textarea 
          placeholder="What do you think about this link?" 
          className="w-full h-24 font-sans text-sm p-4 bg-black/5 rounded-xl outline-none focus:bg-black/[0.08] transition-colors resize-none"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-widest text-black/40">Rating</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((r) => (
            <button 
              key={r} 
              onClick={() => setRating(r)}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                rating === r ? "bg-yellow-400 text-white shadow-lg scale-110" : "bg-black/5 text-black/40 hover:bg-black/10"
              )}
            >
              <Star size={18} fill={rating >= r ? "currentColor" : "none"} />
            </button>
          ))}
        </div>
      </div>
      <button 
        onClick={() => onSubmit({ title: url, content: comment, rating })}
        className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black/80 transition-all active:scale-95 mt-4"
      >
        <Save size={20} /> Save Link
      </button>
    </div>
  );
}
