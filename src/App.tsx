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
  Scissors
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
  const canvasRef = useRef<HTMLDivElement>(null);

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
      rotation: (Math.random() - 0.5) * 20,
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

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-[#1A1A1A] font-serif overflow-hidden flex flex-col">
      {/* Header */}
      <header className="p-6 border-b border-black/10 flex justify-between items-center bg-white/50 backdrop-blur-md z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight italic">IdeaScrapbook</h1>
          <div className="h-8 w-[1px] bg-black/10 mx-2" />
          <div className="flex gap-2">
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
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white border border-black/10 rounded-full px-4 py-1 shadow-sm">
          <Search size={18} className="text-black/40" />
          <input 
            type="text" 
            placeholder="Search ideas, skills, PDFs..." 
            className="bg-transparent outline-none w-64 text-sm py-1"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setSearchResults(null); }} className="text-black/40 hover:text-black">
              <X size={14} />
            </button>
          )}
        </div>
      </header>

      {/* Main Canvas */}
      <main className="flex-1 relative overflow-auto p-20" ref={canvasRef}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        <div className="relative w-full h-full min-h-[2000px] min-w-[2000px]">
          {items.map((item) => {
            const isSearchResult = searchResults?.includes(item.id);
            const isDimmed = searchResults !== null && !isSearchResult;

            return (
              <ScrapbookItemComponent 
                key={item.id} 
                item={item} 
                onDelete={() => deleteItem(item.id)}
                onUpdate={(updates) => saveItem({ ...item, ...updates })}
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
        zIndex: isHighlighted ? 50 : 10
      }}
      className={cn(
        "absolute cursor-grab active:cursor-grabbing group",
        isHighlighted && "ring-4 ring-yellow-400 ring-offset-4 rounded-lg"
      )}
    >
      <div className="relative">
        {/* Controls */}
        <div className="absolute -top-4 -right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          {item.type === 'sticker' && item.file_path && (
            <button onClick={handleStickerify} className="p-1.5 bg-white shadow-md rounded-full hover:bg-black hover:text-white transition-colors">
              <Scissors size={14} />
            </button>
          )}
          <button onClick={onDelete} className="p-1.5 bg-white shadow-md rounded-full hover:bg-red-500 hover:text-white transition-colors">
            <Trash2 size={14} />
          </button>
        </div>

        {/* Content */}
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
                className="bg-white p-2 shadow-2xl rounded-sm rotate-1"
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
