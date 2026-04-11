/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Youtube, 
  Facebook, 
  Instagram, 
  Linkedin, 
  Twitter, 
  Music2, 
  Plus, 
  X, 
  Copy, 
  Check, 
  Hash,
  Layout,
  Type,
  AlignLeft,
  Share2,
  Sparkles,
  Loader2,
  Lightbulb,
  Image as ImageIcon,
  Download,
  RefreshCw,
  Upload,
  Palette,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type as GeminiType } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Please add it to your environment variables.');
  }
  return new GoogleGenAI({ apiKey });
};

type Platform = 'youtube' | 'tiktok' | 'facebook' | 'instagram' | 'linkedin' | 'x';

interface PlatformConfig {
  id: Platform;
  name: string;
  icon: any;
  color: string;
  placeholder: string;
}

const PLATFORMS: PlatformConfig[] = [
  { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'bg-red-600', placeholder: 'Video title & description...' },
  { id: 'tiktok', name: 'TikTok', icon: Music2, color: 'bg-black', placeholder: 'Short & catchy caption...' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-blue-600', placeholder: 'Status update...' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-pink-600', placeholder: 'Visual storytelling...' },
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'bg-blue-700', placeholder: 'Professional update...' },
  { id: 'x', name: 'X', icon: Twitter, color: 'bg-slate-900', placeholder: 'What\'s happening?' },
];

interface PostData {
  title: string;
  description: string;
  hashtags: string[];
  overrides: Record<Platform, {
    title?: string;
    description?: string;
    hashtags?: string[];
  }>;
}

export default function App() {
  const [activePlatform, setActivePlatform] = useState<Platform>('youtube');
  const [postData, setPostData] = useState<PostData>({
    title: '',
    description: '',
    hashtags: [],
    overrides: {
      youtube: {},
      tiktok: {},
      facebook: {},
      instagram: {},
      linkedin: {},
      x: {},
    },
  });
  const [newHashtag, setNewHashtag] = useState('');
  const [copied, setCopied] = useState(false);
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [userImage, setUserImage] = useState<string | null>(null);
  const [thumbnailStyle, setThumbnailStyle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateThumbnail = async () => {
    const title = getDisplayValue('title', activePlatform);
    const description = getDisplayValue('description', activePlatform);
    
    if (!title && !topic) return;

    setIsGeneratingThumbnail(true);
    setError(null);
    try {
      const ai = getAI();
      const stylePrompt = thumbnailStyle.trim() 
        ? `The style should be: ${thumbnailStyle}.`
        : `The style should be vibrant, modern, and eye-catching, suitable for ${PLATFORMS.find(p => p.id === activePlatform)?.name}. Avoid cluttered text, focus on a strong central visual element.`;

      const prompt = `Create a high-quality, professional social media thumbnail for a post titled: "${title || topic}". 
      The post is about: "${description || topic}". 
      ${stylePrompt}`;

      const contents: any = {
        parts: [{ text: prompt }]
      };

      if (userImage) {
        contents.parts.unshift({
          inlineData: {
            data: userImage.split(',')[1],
            mimeType: userImage.split(';')[0].split(':')[1]
          }
        });
        contents.parts[1].text = `Using the provided image as context or inspiration, ${contents.parts[1].text}`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents,
        config: {
          imageConfig: {
            aspectRatio: activePlatform === 'youtube' ? '16:9' : 
                         activePlatform === 'tiktok' || activePlatform === 'instagram' ? '9:16' : '1:1'
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setThumbnailUrl(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (err: any) {
      console.error("Thumbnail generation failed:", err);
      setError(err.message || "Failed to generate thumbnail. Please check your API key.");
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  const generateAIContent = async (platform?: Platform) => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const ai = getAI();
      const platformName = platform ? PLATFORMS.find(p => p.id === platform)?.name : 'general';
      const prompt = `Create a ${platformName} social media post about this topic: "${topic}". 
      Provide a catchy title, a detailed description, and a list of 5-10 relevant hashtags. 
      Return the result in JSON format.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: GeminiType.OBJECT,
            properties: {
              title: { type: GeminiType.STRING },
              description: { type: GeminiType.STRING },
              hashtags: { 
                type: GeminiType.ARRAY,
                items: { type: GeminiType.STRING }
              }
            },
            required: ["title", "description", "hashtags"]
          }
        }
      });

      const result = JSON.parse(response.text);
      const formattedTags = result.hashtags.map((tag: string) => tag.startsWith('#') ? tag : `#${tag}`);

      if (platform) {
        setPostData(prev => ({
          ...prev,
          overrides: {
            ...prev.overrides,
            [platform]: {
              title: result.title,
              description: result.description,
              hashtags: formattedTags
            }
          }
        }));
      } else {
        setPostData(prev => ({
          ...prev,
          title: result.title,
          description: result.description,
          hashtags: formattedTags
        }));
      }
    } catch (err: any) {
      console.error("AI Generation failed:", err);
      setError(err.message || "Failed to generate content. Please check your API key.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Sync title/description to overrides if they are empty
  const updateField = (field: 'title' | 'description', value: string, platform?: Platform) => {
    if (platform) {
      setPostData(prev => ({
        ...prev,
        overrides: {
          ...prev.overrides,
          [platform]: { ...prev.overrides[platform], [field]: value }
        }
      }));
    } else {
      setPostData(prev => ({ ...prev, [field]: value }));
    }
  };

  const addHashtag = (platform?: Platform) => {
    if (!newHashtag.trim()) return;
    const tag = newHashtag.startsWith('#') ? newHashtag.trim() : `#${newHashtag.trim()}`;
    
    if (platform) {
      const currentTags = postData.overrides[platform].hashtags || postData.hashtags;
      if (!currentTags.includes(tag)) {
        setPostData(prev => ({
          ...prev,
          overrides: {
            ...prev.overrides,
            [platform]: { ...prev.overrides[platform], hashtags: [...currentTags, tag] }
          }
        }));
      }
    } else {
      if (!postData.hashtags.includes(tag)) {
        setPostData(prev => ({ ...prev, hashtags: [...prev.hashtags, tag] }));
      }
    }
    setNewHashtag('');
  };

  const removeHashtag = (tag: string, platform?: Platform) => {
    if (platform) {
      const currentTags = postData.overrides[platform].hashtags || postData.hashtags;
      setPostData(prev => ({
        ...prev,
        overrides: {
          ...prev.overrides,
          [platform]: { ...prev.overrides[platform], hashtags: currentTags.filter(t => t !== tag) }
        }
      }));
    } else {
      setPostData(prev => ({ ...prev, hashtags: prev.hashtags.filter(t => t !== tag) }));
    }
  };

  const getDisplayValue = (field: 'title' | 'description' | 'hashtags', platform: Platform) => {
    const override = postData.overrides[platform][field];
    if (override !== undefined) return override;
    return postData[field];
  };

  const handleCopy = (platform: Platform = activePlatform) => {
    const title = getDisplayValue('title', platform);
    const desc = getDisplayValue('description', platform);
    const tags = (getDisplayValue('hashtags', platform) as string[]).join(' ');
    
    const text = `${title}\n\n${desc}\n\n${tags}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAll = () => {
    let allText = "SOCIALPOST STUDIO - ALL PLATFORMS\n================================\n\n";
    PLATFORMS.forEach(p => {
      const title = getDisplayValue('title', p.id);
      const desc = getDisplayValue('description', p.id);
      const tags = (getDisplayValue('hashtags', p.id) as string[]).join(' ');
      allText += `[${p.name.toUpperCase()}]\nTITLE: ${title}\nDESCRIPTION: ${desc}\nHASHTAGS: ${tags}\n\n--------------------------------\n\n`;
    });
    
    navigator.clipboard.writeText(allText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeConfig = PLATFORMS.find(p => p.id === activePlatform)!;

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans selection:bg-blue-100">
      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-600 text-white px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-1 rounded-full">
                <X className="w-4 h-4" />
              </div>
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-4 justify-between">
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-blue-600 p-2 rounded-xl">
              <Share2 className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">SocialPost Studio</h1>
          </div>

          <div className="flex-1 max-w-xl w-full flex items-center gap-2">
            <div className="relative flex-1">
              <Lightbulb className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generateAIContent()}
                placeholder="Enter your topic (e.g. New coffee shop)..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
              />
            </div>
            <button 
              onClick={() => generateAIContent()}
              disabled={isGenerating || !topic.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95 text-sm shrink-0"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isGenerating ? 'Creating...' : 'Create Post'}
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={handleCopyAll}
              className="hidden lg:flex items-center gap-2 text-gray-500 hover:text-blue-600 px-3 py-2 rounded-lg font-medium transition-all text-sm"
            >
              <Copy className="w-4 h-4" />
              Copy All
            </button>
            <button 
              onClick={() => handleCopy()}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-all active:scale-95 text-sm"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Active'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Global & Platform Controls */}
        <div className="lg:col-span-7 space-y-8">
          {/* Global Content Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Layout className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Global Content</h2>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => generateAIContent()}
                  disabled={isGenerating || !topic.trim()}
                  className="text-blue-600 hover:text-blue-700 p-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                  title="Generate Global Content"
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Generate
                </button>
                <button 
                  onClick={() => {
                    const text = `${postData.title}\n\n${postData.description}\n\n${postData.hashtags.join(' ')}`;
                    navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="text-gray-400 hover:text-blue-600 p-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
                  title="Copy Global Content"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Type className="w-4 h-4" /> Default Title
                  </label>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(postData.title);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="text-gray-400 hover:text-blue-600 p-1"
                    title="Copy Title"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input 
                  type="text"
                  value={postData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Enter a catchy title..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <AlignLeft className="w-4 h-4" /> Default Description
                  </label>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(postData.description);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="text-gray-400 hover:text-blue-600 p-1"
                    title="Copy Description"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <textarea 
                  value={postData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="What is this post about?"
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 resize-none"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Hash className="w-4 h-4" /> Global Hashtags
                  </label>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(postData.hashtags.join(' '));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="text-gray-400 hover:text-blue-600 p-1"
                    title="Copy Hashtags"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={newHashtag}
                    onChange={(e) => setNewHashtag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addHashtag()}
                    placeholder="Add tag..."
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none transition-all"
                  />
                  <button 
                    onClick={() => addHashtag()}
                    className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg transition-colors"
                  >
                    <Plus className="w-6 h-6 text-gray-600" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[40px]">
                  <AnimatePresence mode="popLayout">
                    {postData.hashtags.map(tag => (
                      <motion.span 
                        key={tag}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium border border-blue-100"
                      >
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(tag);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="hover:text-blue-900"
                          title="Copy Tag"
                        >
                          {tag}
                        </button>
                        <button onClick={() => removeHashtag(tag)} className="hover:text-blue-900 opacity-50 hover:opacity-100">
                          <X className="w-3 h-3" />
                        </button>
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </section>

          {/* Platform Customization Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <activeConfig.icon className={`w-4 h-4 text-white p-0.5 rounded ${activeConfig.color}`} />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                  {activeConfig.name} Customization
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={generateThumbnail}
                  disabled={isGeneratingThumbnail || (!topic.trim() && !getDisplayValue('title', activePlatform))}
                  className="text-blue-600 hover:text-blue-700 p-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                  title={`Generate ${activeConfig.name} Thumbnail`}
                >
                  {isGeneratingThumbnail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                  Thumbnail
                </button>
                <button 
                  onClick={() => generateAIContent(activePlatform)}
                  disabled={isGenerating || !topic.trim()}
                  className="text-blue-600 hover:text-blue-700 p-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                  title={`Generate ${activeConfig.name} Content`}
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Generate
                </button>
                <button 
                  onClick={() => handleCopy()}
                  className="text-gray-400 hover:text-blue-600 p-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
                  title={`Copy ${activeConfig.name} Post`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                  Overrides Active
                </span>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700">Platform Title</label>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(postData.overrides[activePlatform].title || postData.title);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="text-gray-400 hover:text-blue-600 p-1"
                      title="Copy Platform Title"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => updateField('title', '', activePlatform)}
                      className="text-[10px] text-gray-400 hover:text-blue-600 uppercase font-bold tracking-widest"
                    >
                      Reset to Global
                    </button>
                  </div>
                </div>
                <input 
                  type="text"
                  value={postData.overrides[activePlatform].title ?? ''}
                  onChange={(e) => updateField('title', e.target.value, activePlatform)}
                  placeholder={`Custom title for ${activeConfig.name}...`}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700">Platform Description</label>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(postData.overrides[activePlatform].description || postData.description);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="text-gray-400 hover:text-blue-600 p-1"
                      title="Copy Platform Description"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => updateField('description', '', activePlatform)}
                      className="text-[10px] text-gray-400 hover:text-blue-600 uppercase font-bold tracking-widest"
                    >
                      Reset to Global
                    </button>
                  </div>
                </div>
                <textarea 
                  value={postData.overrides[activePlatform].description ?? ''}
                  onChange={(e) => updateField('description', e.target.value, activePlatform)}
                  placeholder={`Custom description for ${activeConfig.name}...`}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700">Platform Hashtags</label>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        const tags = postData.overrides[activePlatform].hashtags || postData.hashtags;
                        navigator.clipboard.writeText(tags.join(' '));
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="text-gray-400 hover:text-blue-600 p-1"
                      title="Copy Platform Hashtags"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => {
                        setPostData(prev => ({
                          ...prev,
                          overrides: {
                            ...prev.overrides,
                            [activePlatform]: { ...prev.overrides[activePlatform], hashtags: undefined }
                          }
                        }));
                      }}
                      className="text-[10px] text-gray-400 hover:text-blue-600 uppercase font-bold tracking-widest"
                    >
                      Reset to Global
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={newHashtag}
                    onChange={(e) => setNewHashtag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addHashtag(activePlatform)}
                    placeholder="Add platform tag..."
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none transition-all"
                  />
                  <button 
                    onClick={() => addHashtag(activePlatform)}
                    className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg transition-colors"
                  >
                    <Plus className="w-6 h-6 text-gray-600" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[40px]">
                  <AnimatePresence mode="popLayout">
                    {(postData.overrides[activePlatform].hashtags || postData.hashtags).map(tag => (
                      <motion.span 
                        key={`${activePlatform}-${tag}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${
                          postData.overrides[activePlatform].hashtags 
                            ? 'bg-purple-50 text-purple-700 border-purple-100' 
                            : 'bg-blue-50 text-blue-700 border-blue-100'
                        }`}
                      >
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(tag);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="hover:opacity-70"
                          title="Copy Tag"
                        >
                          {tag}
                        </button>
                        <button onClick={() => removeHashtag(tag, activePlatform)} className="hover:opacity-70 opacity-50 hover:opacity-100">
                          <X className="w-3 h-3" />
                        </button>
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </section>

          {/* Export All Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
              <Share2 className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Quick Copy All Platforms</h2>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PLATFORMS.map(p => (
                <button
                  key={`copy-all-${p.id}`}
                  onClick={() => handleCopy(p.id)}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${p.color} text-white`}>
                      <p.icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  <Copy className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Platform Selector & Preview */}
        <div className="lg:col-span-5 space-y-6">
          {/* Platform Selector */}
          <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-200 flex flex-wrap gap-1">
            {PLATFORMS.map((p) => {
              const Icon = p.icon;
              const isActive = activePlatform === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePlatform(p.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all relative ${
                    isActive 
                      ? 'text-white' 
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="active-pill"
                      className={`absolute inset-0 rounded-xl ${p.color}`}
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Icon className={`w-5 h-5 relative z-10 ${isActive ? 'text-white' : ''}`} />
                  <span className="text-sm font-semibold relative z-10 hidden sm:inline">{p.name}</span>
                </button>
              );
            })}
          </div>

          {/* Preview Card */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden sticky top-24">
            <div className={`h-2 ${activeConfig.color}`} />
            
            {/* Thumbnail Area */}
            <div className={`bg-gray-100 relative group overflow-hidden ${
              activePlatform === 'tiktok' || activePlatform === 'instagram' ? 'aspect-[9/16] max-h-[400px]' : 'aspect-video'
            }`}>
              {thumbnailUrl ? (
                <img 
                  src={thumbnailUrl} 
                  alt="Post Thumbnail" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                  <ImageIcon className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-xs font-medium">No thumbnail generated yet</p>
                  <button 
                    onClick={generateThumbnail}
                    disabled={isGeneratingThumbnail || (!topic.trim() && !getDisplayValue('title', activePlatform))}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:bg-gray-300 flex items-center gap-2"
                  >
                    {isGeneratingThumbnail ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    {isGeneratingThumbnail ? 'Designing...' : 'Create Thumbnail'}
                  </button>
                </div>
              )}
              
              {isGeneratingThumbnail && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center text-blue-600">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">Designing...</p>
                </div>
              )}

              {thumbnailUrl && !isGeneratingThumbnail && (
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = thumbnailUrl;
                      link.download = `thumbnail-${activePlatform}.png`;
                      link.click();
                    }}
                    className="bg-white/90 p-2 rounded-lg shadow-sm hover:bg-white text-gray-700"
                    title="Download Thumbnail"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={generateThumbnail}
                    className="bg-white/90 p-2 rounded-lg shadow-sm hover:bg-white text-gray-700"
                    title="Refresh Thumbnail"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="p-8 space-y-6">
              {/* Thumbnail Customization Tools */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Palette className="w-3 h-3" /> Thumbnail Settings
                  </h4>
                  {userImage && (
                    <button 
                      onClick={() => setUserImage(null)}
                      className="text-[10px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-1 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" /> Clear Image
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden" 
                      id="thumbnail-upload"
                    />
                    <label 
                      htmlFor="thumbnail-upload"
                      className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                        userImage ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-400 hover:bg-gray-100'
                      }`}
                    >
                      {userImage ? (
                        <div className="relative w-full aspect-video rounded-lg overflow-hidden">
                          <img src={userImage} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                            <Check className="text-white w-4 h-4" />
                          </div>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-gray-400" />
                          <span className="text-[10px] font-bold text-gray-500">Add Photo</span>
                        </>
                      )}
                    </label>
                  </div>

                  <div className="space-y-2">
                    <div className="relative">
                      <Palette className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                      <textarea 
                        value={thumbnailStyle}
                        onChange={(e) => setThumbnailStyle(e.target.value)}
                        placeholder="Style (e.g. Cyberpunk, Minimalist...)"
                        className="w-full pl-8 pr-3 py-2 text-[10px] rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none h-[68px]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full ${activeConfig.color} flex items-center justify-center text-white`}>
                    <activeConfig.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{activeConfig.name} Preview</h3>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Draft Post</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleCopy()}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-blue-600"
                  title="Copy this post"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1 group relative">
                  <h4 className="text-2xl font-bold leading-tight tracking-tight">
                    {getDisplayValue('title', activePlatform) || <span className="text-gray-200 italic">No title set</span>}
                  </h4>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(getDisplayValue('title', activePlatform) as string);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="absolute -right-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-blue-500"
                    title="Copy Title"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="group relative">
                  <div className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {getDisplayValue('description', activePlatform) || <span className="text-gray-200 italic">No description set</span>}
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(getDisplayValue('description', activePlatform) as string);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="absolute -right-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-blue-500"
                    title="Copy Description"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-4 group relative">
                  {(getDisplayValue('hashtags', activePlatform) as string[]).map(tag => (
                    <span 
                      key={tag} 
                      className="text-blue-600 font-semibold hover:underline cursor-pointer"
                      onClick={() => {
                        navigator.clipboard.writeText(tag);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText((getDisplayValue('hashtags', activePlatform) as string[]).join(' '));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="absolute -right-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-blue-500"
                    title="Copy All Hashtags"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="pt-8 border-t border-gray-100 flex items-center justify-between text-gray-400">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-gray-50" />
                  <div className="w-8 h-8 rounded-full bg-gray-50" />
                  <div className="w-8 h-8 rounded-full bg-gray-50" />
                </div>
                <div className="text-xs font-mono uppercase tracking-widest">
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto p-6 text-center text-gray-400 text-sm">
        <p>© 2026 SocialPost Studio • Built for creators</p>
      </footer>
    </div>
  );
}
