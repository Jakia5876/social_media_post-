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
  Trash2,
  Video,
  LogOut,
  User,
  Settings,
  ShieldCheck,
  Users,
  Key,
  LogIn,
  UserPlus,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type as GeminiType } from "@google/genai";
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  deleteDoc,
  serverTimestamp,
  deleteField
} from 'firebase/firestore';



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

const Logo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <div className={`${className} flex items-center justify-center overflow-hidden rounded-xl bg-[#000B18] shadow-inner`}>
    <svg viewBox="0 0 100 100" className="w-full h-full p-1">
      {/* Outer circuit ring */}
      <circle cx="50" cy="50" r="42" fill="none" stroke="#00A3FF" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#00A3FF" strokeWidth="0.5" opacity="0.3" />
      
      {/* Circuit lines/dots */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
        <g key={angle} transform={`rotate(${angle} 50 50)`}>
          <line x1="50" y1="8" x2="50" y2="15" stroke="#00A3FF" strokeWidth="1" />
          <circle cx="50" cy="8" r="1.5" fill="#00A3FF" />
        </g>
      ))}

      {/* A3M Text */}
      <text x="50" y="52" textAnchor="middle" style={{ fontSize: '24px', fontWeight: '900', fontFamily: 'Inter, sans-serif' }}>
        <tspan fill="#FFB800">A</tspan>
        <tspan fill="#00A3FF">3</tspan>
        <tspan fill="#FF4D00">M</tspan>
      </text>
      
      {/* IT TECH Text */}
      <text x="50" y="72" textAnchor="middle" fill="white" style={{ fontSize: '8px', fontWeight: 'bold', letterSpacing: '2px', fontFamily: 'Inter, sans-serif' }}>
        IT TECH
      </text>
    </svg>
  </div>
);

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
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

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
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState<string>('');
  const [userImage, setUserImage] = useState<string | null>(null);
  const [thumbnailStyle, setThumbnailStyle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [localApiKey, setLocalApiKey] = useState(localStorage.getItem('GEMINI_API_KEY') || '');

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserProfile(data);
          if (data.geminiApiKey) {
            setLocalApiKey(data.geminiApiKey);
          }
          // Update last login
          await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
        } else {
          // Check if there's a pending invitation/profile by email
          // (This is a simplified version, ideally you'd query by email)
          const newProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: firebaseUser.email === 'jakiadantal@gmail.com' ? 'admin' : 'user',
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
          };
          await setDoc(userRef, newProfile);
          setUserProfile(newProfile);
        }
      } else {
        setUserProfile(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Admin: Listen to all users
  useEffect(() => {
    if (userProfile?.role === 'admin') {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, [userProfile]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError("Login failed: " + err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowAdminPanel(false);
    setShowUserPanel(false);
  };

  const deleteUser = async (userId: string) => {
    if (window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (err: any) {
        setError("Failed to delete user: " + err.message);
      }
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) return;
    try {
      // We create a document with a random ID or the email as ID
      // Using email as ID for "pre-authorized" users is easier to find
      const userRef = doc(db, 'users', `invited_${newUserEmail.replace(/\./g, '_')}`);
      await setDoc(userRef, {
        email: newUserEmail,
        role: newUserRole,
        createdAt: serverTimestamp(),
        isInvited: true
      });
      setNewUserEmail('');
      setShowAddUser(false);
    } catch (err: any) {
      setError("Failed to add user: " + err.message);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    await setDoc(doc(db, 'users', userId), { role: newRole }, { merge: true });
  };

  const saveUserApiKey = async (key: string) => {
    if (user) {
      if (window.confirm("Are you sure you want to save this API key? This will override your current settings.")) {
        await setDoc(doc(db, 'users', user.uid), { geminiApiKey: key }, { merge: true });
        setLocalApiKey(key);
        localStorage.setItem('GEMINI_API_KEY', key);
        setError(null);
        // Show success feedback
        const btn = document.getElementById('save-key-btn');
        if (btn) {
          const originalText = btn.innerText;
          btn.innerText = "✅ KEY SAVED!";
          btn.classList.replace('bg-blue-600', 'bg-green-600');
          setTimeout(() => {
            btn.innerText = originalText;
            btn.classList.replace('bg-green-600', 'bg-blue-600');
          }, 2000);
        }
      }
    }
  };

  const clearUserApiKey = async () => {
    if (user) {
      if (window.confirm("Are you sure you want to clear your API key? The app will revert to the default fallback key.")) {
        await setDoc(doc(db, 'users', user.uid), { geminiApiKey: deleteField() }, { merge: true });
        setLocalApiKey('');
        localStorage.removeItem('GEMINI_API_KEY');
        const input = document.getElementById('api-key-input') as HTMLInputElement;
        if (input) input.value = '';
        setError(null);
      }
    }
  };

  const loadDemoData = () => {
    setTopic("Healthy Morning Routine");
    setPostData({
      title: "5 Habits for a Productive Morning ☀️",
      description: "Start your day right with these 5 simple habits:\n1. Hydrate first thing\n2. No screens for 30 mins\n3. Light stretching\n4. Mindful meditation\n5. High-protein breakfast\n\nWhich one is your favorite? Let us know below! 👇",
      hashtags: ["#MorningRoutine", "#Productivity", "#Wellness", "#HealthyHabits", "#MorningVibes"],
      overrides: {
        youtube: {
          title: "MY MORNING ROUTINE: 5 Habits That Changed My Life",
          description: "In this video, I share the 5 morning habits that have completely transformed my productivity and mental health. These are simple, science-backed routines you can start today!",
          hashtags: ["#MorningRoutine", "#ProductivityTips", "#SelfCare", "#MorningVibes", "#HabitStacking"]
        },
        tiktok: {
          title: "Morning Routine Hack! ☀️",
          description: "Stop scrolling and start living! 5 habits to change your life. #MorningRoutine #Wellness",
          hashtags: ["#MorningRoutine", "#Wellness", "#Productivity", "#LifeHack", "#MorningVibes"]
        },
        facebook: {},
        instagram: {},
        linkedin: {
          title: "The CEO Morning Routine: Optimizing for Performance",
          description: "Success isn't accidental; it's built in the first 60 minutes of your day. Here are 5 habits I've implemented to ensure peak performance.",
          hashtags: ["#Leadership", "#Productivity", "#MorningRoutine", "#ProfessionalDevelopment", "#Performance"]
        },
        x: {
          title: "Morning Routine 101",
          description: "5 habits for a better day: 1. Water 2. No phone 3. Move 4. Meditate 5. Protein. Simple but effective.",
          hashtags: ["#MorningRoutine", "#Productivity", "#Wellness"]
        },
      },
    });
    setThumbnailUrl("https://picsum.photos/seed/morning/1280/720");
  };

  const getAI = () => {
    // Priority: User Profile Key > Local Storage > Environment Variable > Hardcoded Fallback
    let apiKey = userProfile?.geminiApiKey || localApiKey || process.env.GEMINI_API_KEY || 'AIzaSyD9iT9fqca95AegcowEu1bYoSsjgPZ59gY';
    
    // Clean up key if it's accidentally set to "undefined" or "null" as strings
    if (apiKey === 'undefined' || apiKey === 'null' || !apiKey) {
      apiKey = 'AIzaSyD9iT9fqca95AegcowEu1bYoSsjgPZ59gY';
    }

    if (!apiKey || apiKey.length < 10) {
      throw new Error('API Key is missing. Please set it in your User Settings.');
    }
    return new GoogleGenAI({ apiKey });
  };

  const saveApiKey = (key: string) => {
    const trimmedKey = key.trim();
    setLocalApiKey(trimmedKey);
    if (trimmedKey) {
      localStorage.setItem('GEMINI_API_KEY', trimmedKey);
      setError(null);
    } else {
      localStorage.removeItem('GEMINI_API_KEY');
    }
  };

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

      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents,
          config: {
            imageConfig: {
              aspectRatio: activePlatform === 'youtube' ? '16:9' : 
                           activePlatform === 'tiktok' || activePlatform === 'instagram' ? '9:16' : '1:1'
            }
          }
        });
      } catch (e: any) {
        if (e.message?.includes('not found') || e.message?.includes('404')) {
          // Fallback to a more stable model if available, though image generation is specific
          throw new Error("The image generation model is not available for your API key yet. Please try again later or use a different key.");
        }
        throw e;
      }

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

  const generateVideo = async () => {
    const title = getDisplayValue('title', activePlatform);
    const description = getDisplayValue('description', activePlatform);
    
    if (!title && !topic) return;

    setIsGeneratingVideo(true);
    setVideoProgress('Initializing Veo...');
    setError(null);
    try {
      const ai = getAI();
      const platformName = PLATFORMS.find(p => p.id === activePlatform)?.name;
      
      const prompt = `Create a high-energy, professional promotional video for ${platformName}. 
      Title: "${title || topic}". 
      Content: "${description || topic}". 
      The video should be visually engaging, modern, and perfectly suited for ${platformName}'s audience.`;

      const operation = await ai.models.generateVideos({
        model: 'veo-3.1-lite-generate-preview',
        prompt,
        config: {
          numberOfVideos: 1,
          resolution: '1080p',
          aspectRatio: activePlatform === 'youtube' ? '16:9' : 
                       activePlatform === 'tiktok' || activePlatform === 'instagram' ? '9:16' : '1:1'
        }
      });

      setVideoProgress('Generating video... (this may take a minute)');
      
      let currentOp = operation;
      while (!currentOp.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        currentOp = await (ai.operations as any).get({ name: (currentOp as any).name });
        setVideoProgress('Still processing... hang tight!');
      }

      if (currentOp.response?.generatedVideos?.[0]?.video?.videoBytes) {
        const videoBase64 = currentOp.response.generatedVideos[0].video.videoBytes;
        setVideoUrl(`data:video/mp4;base64,${videoBase64}`);
      } else {
        throw new Error("Video generation completed but no video data was returned.");
      }
    } catch (err: any) {
      console.error("Video generation failed:", err);
      setError(err.message || "Failed to generate video. Veo might be unavailable for your key.");
    } finally {
      setIsGeneratingVideo(false);
      setVideoProgress('');
    }
  };

  const generateAIContent = async (platform?: Platform) => {
    if (!topic.trim()) {
      setError("Please enter a topic first!");
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const ai = getAI();
      const platformName = platform ? PLATFORMS.find(p => p.id === platform)?.name : 'general';
      const prompt = `Create a ${platformName} social media post about this topic: "${topic}". 
      Provide a catchy title, a detailed description, and a list of 5-10 relevant hashtags. 
      Return the result in JSON format.`;

      let response;
      try {
        response = await ai.models.generateContent({
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
      } catch (e: any) {
        if (e.message?.includes('not found') || e.message?.includes('404')) {
          // Fallback to Gemini 2.0 Flash Experimental which is widely available
          response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
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
        } else {
          throw e;
        }
      }

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

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-12 rounded-[32px] shadow-2xl shadow-blue-500/10 max-w-md w-full text-center space-y-8"
        >
          <div className="mx-auto w-fit shadow-xl shadow-blue-500/30 rounded-3xl overflow-hidden">
            <Logo className="w-24 h-24" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">A3M Social Post Creator</h1>
            <p className="text-gray-500">Sign in to start creating viral content</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20"
          >
            <div className="bg-white p-1 rounded-lg">
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
            </div>
            Sign in with Google
          </button>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Secure Authentication by Firebase</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans selection:bg-blue-100">
      {/* Admin Panel Overlay */}
      <AnimatePresence>
        {showAdminPanel && userProfile?.role === 'admin' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="bg-red-600 p-2 rounded-xl">
                    <ShieldCheck className="text-white w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold">Admin Dashboard</h2>
                </div>
                <button onClick={() => setShowAdminPanel(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                      <Users className="w-4 h-4" /> User Management ({allUsers.length})
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 md:w-64">
                        <input 
                          type="text"
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-4 pr-4 py-2 bg-gray-100 border border-transparent focus:border-blue-500 rounded-xl text-sm outline-none transition-all"
                        />
                      </div>
                      <button 
                        onClick={() => setShowAddUser(!showAddUser)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95"
                      >
                        <Plus className="w-4 h-4" /> Add User
                      </button>
                    </div>
                  </div>

                  {showAddUser && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold uppercase text-gray-400 mb-1 block">Email Address</label>
                          <input 
                            type="email"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            placeholder="user@example.com"
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:border-blue-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-gray-400 mb-1 block">Initial Role</label>
                          <select 
                            value={newUserRole}
                            onChange={(e) => setNewUserRole(e.target.value as any)}
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:border-blue-500 text-sm bg-white"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setShowAddUser(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700">Cancel</button>
                        <button onClick={handleAddUser} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold">Create User</button>
                      </div>
                    </motion.div>
                  )}
                  
                  <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        <tr>
                          <th className="px-6 py-4">User Details</th>
                          <th className="px-6 py-4">Role</th>
                          <th className="px-6 py-4">Last Active</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {allUsers
                          .filter(u => u.email?.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((u) => (
                          <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                  <User className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold flex items-center gap-2">
                                    {u.email}
                                    {u.isInvited && <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Invited</span>}
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-mono truncate max-w-[150px]">{u.uid || u.id}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <select 
                                value={u.role}
                                onChange={(e) => updateUserRole(u.id, e.target.value)}
                                className={`text-xs font-bold border rounded-lg px-2 py-1 outline-none transition-colors ${
                                  u.role === 'admin' ? 'border-red-200 text-red-600 bg-red-50' : 'border-gray-200 text-gray-600 bg-white'
                                }`}
                              >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-500">
                                  {u.lastLogin ? new Date(u.lastLogin.seconds * 1000).toLocaleDateString() : 'Never'}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                  {u.lastLogin ? new Date(u.lastLogin.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {u.uid !== user?.uid && (
                                <button 
                                  onClick={() => deleteUser(u.id)}
                                  className="text-gray-400 hover:text-red-600 p-2 transition-colors rounded-lg hover:bg-red-50"
                                  title="Delete User"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Settings Overlay */}
      <AnimatePresence>
        {showUserPanel && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 p-2 rounded-xl">
                    <Settings className="text-white w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold">User Settings</h2>
                </div>
                <button onClick={() => setShowUserPanel(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Key className="w-4 h-4" /> Gemini API Configuration
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Enter your personal Gemini API key to enable AI features. This key is stored securely in your private profile.
                  </p>
                  <div className="space-y-4">
                    <input 
                      id="api-key-input"
                      type="password"
                      defaultValue={userProfile?.geminiApiKey || ''}
                      placeholder="Paste your API key here..."
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          saveUserApiKey((e.target as HTMLInputElement).value);
                        }
                      }}
                    />
                    <div className="flex gap-3">
                      <button 
                        id="save-key-btn"
                        onClick={() => {
                          const input = document.getElementById('api-key-input') as HTMLInputElement;
                          saveUserApiKey(input.value);
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all active:scale-95"
                      >
                        Save API Key
                      </button>
                      <button 
                        onClick={clearUserApiKey}
                        className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center"
                        title="Clear Key"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-700 font-bold transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-600 text-white px-6 py-4 sticky top-0 z-[80] shadow-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-4 justify-between">
          <div className="flex items-center gap-3 shrink-0">
            <Logo className="w-10 h-10" />
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">A3M Social Post Creator v1.2</h1>
          </div>

          <div className="flex-1 max-w-xl w-full flex items-center gap-2">
            <div className="relative flex-1">
              <Lightbulb className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text"
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  if (error && e.target.value.length > 0) setError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && generateAIContent()}
                placeholder="Enter your topic (e.g. New coffee shop)..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
              />
            </div>
            <button 
              onClick={() => generateAIContent()}
              disabled={isGenerating || !topic.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-6 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isGenerating ? 'Creating...' : 'Create Post'}
            </button>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {userProfile?.role === 'admin' && (
              <button 
                onClick={() => setShowAdminPanel(true)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600 relative group"
                title="Admin Dashboard"
              >
                <ShieldCheck className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 bg-red-600 w-2 h-2 rounded-full" />
              </button>
            )}
            <button 
              onClick={() => setShowUserPanel(true)}
              className="flex items-center gap-2 p-1 pr-3 hover:bg-gray-100 rounded-full transition-all border border-transparent hover:border-gray-200"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs overflow-hidden">
                {user?.photoURL ? <img src={user.photoURL} alt="Profile" /> : <User className="w-4 h-4" />}
              </div>
              <span className="text-xs font-bold hidden md:inline">{user?.displayName || user?.email?.split('@')[0]}</span>
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
                  disabled={isGeneratingThumbnail || isGeneratingVideo || (!topic.trim() && !getDisplayValue('title', activePlatform))}
                  className="text-blue-600 hover:text-blue-700 p-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                  title={`Generate ${activeConfig.name} Thumbnail`}
                >
                  {isGeneratingThumbnail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                  Thumbnail
                </button>
                <button 
                  onClick={generateVideo}
                  disabled={isGeneratingVideo || isGeneratingThumbnail || (!topic.trim() && !getDisplayValue('title', activePlatform))}
                  className="text-purple-600 hover:text-purple-700 p-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                  title={`Generate ${activeConfig.name} Video`}
                >
                  {isGeneratingVideo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                  Video
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
          <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-200 flex flex-wrap gap-2">
            {PLATFORMS.map((p) => {
              const Icon = p.icon;
              const isActive = activePlatform === p.id;
              const brandColor = p.color.replace('bg-', 'text-');
              const brandBgLight = p.color.replace('bg-', 'bg-').replace('-600', '-50').replace('-700', '-50').replace('-900', '-50').replace('bg-black', 'bg-gray-100');
              
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePlatform(p.id)}
                  className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all relative group ${
                    isActive 
                      ? 'text-white' 
                      : `text-gray-500 hover:${brandBgLight} ${brandColor.replace('text-', 'hover:text-')}`
                  }`}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="active-pill"
                      className={`absolute inset-0 rounded-xl ${p.color} shadow-lg shadow-${p.color.split('-')[1]}-500/20`}
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-2">
                    <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : brandColor}`} />
                    <span className="text-sm font-bold hidden sm:inline">{p.name}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Preview Card */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden sticky top-24">
            <div className={`h-2 ${activeConfig.color}`} />
            
            {/* Media Area */}
            <div className={`bg-gray-100 relative group overflow-hidden ${
              activePlatform === 'tiktok' || activePlatform === 'instagram' ? 'aspect-[9/16] max-h-[400px]' : 'aspect-video'
            }`}>
              {videoUrl ? (
                <video 
                  src={videoUrl} 
                  controls 
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                />
              ) : thumbnailUrl ? (
                <img 
                  src={thumbnailUrl} 
                  alt="Post Thumbnail" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                  <div className="bg-gray-50 p-4 rounded-full mb-4">
                    <ImageIcon className="w-8 h-8 opacity-20" />
                  </div>
                  <p className="text-xs font-medium">No media generated yet</p>
                  <div className="mt-4 flex flex-col gap-2 w-full max-w-[200px]">
                    <button 
                      onClick={generateThumbnail}
                      disabled={isGeneratingThumbnail || isGeneratingVideo || (!topic.trim() && !getDisplayValue('title', activePlatform))}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:bg-gray-300 flex items-center justify-center gap-2"
                    >
                      {isGeneratingThumbnail ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                      {isGeneratingThumbnail ? 'Designing...' : 'Create Thumbnail'}
                    </button>
                    <button 
                      onClick={generateVideo}
                      disabled={isGeneratingVideo || isGeneratingThumbnail || (!topic.trim() && !getDisplayValue('title', activePlatform))}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:bg-gray-300 flex items-center justify-center gap-2"
                    >
                      {isGeneratingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                      {isGeneratingVideo ? 'Processing...' : 'Create Video'}
                    </button>
                  </div>
                </div>
              )}
              
              {(isGeneratingThumbnail || isGeneratingVideo) && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center text-blue-600 z-20">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">{isGeneratingVideo ? 'Generating Video...' : 'Designing...'}</p>
                  {isGeneratingVideo && <p className="text-[10px] text-gray-500 mt-1">{videoProgress}</p>}
                </div>
              )}

              {(thumbnailUrl || videoUrl) && !isGeneratingThumbnail && !isGeneratingVideo && (
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = (videoUrl || thumbnailUrl)!;
                      link.download = videoUrl ? `promo-${activePlatform}.mp4` : `thumbnail-${activePlatform}.png`;
                      link.click();
                    }}
                    className="bg-white/90 p-2 rounded-lg shadow-sm hover:bg-white text-gray-700"
                    title="Download Media"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={videoUrl ? generateVideo : generateThumbnail}
                    className="bg-white/90 p-2 rounded-lg shadow-sm hover:bg-white text-gray-700"
                    title="Refresh Media"
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
        <p>© 2026 A3M Social Post Creator • Built for creators</p>
      </footer>
    </div>
  );
}
