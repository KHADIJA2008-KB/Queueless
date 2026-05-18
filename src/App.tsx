/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc,
  updateDoc,
  increment,
  addDoc,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { 
  Users, 
  Clock, 
  ChevronRight, 
  LogOut, 
  LayoutDashboard, 
  UserCircle,
  AlertCircle,
  Plus,
  RefreshCw,
  QrCode,
  Share2,
  X,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';

// --- Types ---
interface ServiceQueue {
  id: string;
  name: string;
  description: string;
  address?: string;
  category?: 'Government' | 'Medical' | 'Banking' | 'Education' | 'Other';
  averageServiceTime: number;
  currentTokenNumber: number;
  totalTokensIssued: number;
  status: 'open' | 'closed';
  adminId: string;
}

interface QueueToken {
  id: string;
  tokenNumber: number;
  userName: string;
  userId: string;
  adminId: string;
  status: 'waiting' | 'serving' | 'completed' | 'cancelled';
  joinedAt: any;
  servedAt?: any;
}

interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

const handleFirestoreError = (err: any, op: FirestoreErrorInfo['operationType'], path: string | null, user: User | null) => {
  if (err.message?.includes('permission') || err.code === 'permission-denied') {
    const info: FirestoreErrorInfo = {
      error: err.message,
      operationType: op,
      path,
      authInfo: {
        userId: user?.uid || 'anonymous',
        email: user?.email || '',
        emailVerified: user?.emailVerified || false,
        isAnonymous: user?.isAnonymous || true,
        providerInfo: user?.providerData.map(p => ({ providerId: p.providerId, displayName: p.displayName || '', email: p.email || '' })) || []
      }
    };
    console.error("Firestore Security Error:", info);
    throw new Error(JSON.stringify(info));
  }
  throw err;
};

// --- Translations ---
const translations = {
  en: {
    welcome: "Welcome to QueueLess",
    welcomeSub: "Skip the physical line in Pakistan.",
    login: "Login with Google",
    welcomeHeader: "Digital Waiting Solution",
    assalam: "Assalam-o-Alaikum",
    nearby: "Nearby Services",
    admin: "Admin",
    nowServing: "Now Serving",
    back: "Back",
    home: "Home",
    share: "Share QR Code",
    scanToJoin: "Scan to Join Queue",
    joinQueue: "Join Queue",
    joining: "Joining...",
    waitTime: "Wait Time",
    avgSpeed: "Avg Speed",
    yourStatus: "Your Status",
    yourToken: "Your Token",
    peopleAhead: "people ahead",
    yourTurn: "It's your turn!",
    hurryUp: "Hurry Up!",
    hurryUpSub: "Move closer to the counter.",
    cancelToken: "Cancel Token",
    adminConsole: "Admin Console",
    totalIssued: "Total Issued",
    nextToken: "Next Token",
    setupCounter: "Setup Counter",
    serviceName: "Service Point Name",
    live: "Live",
    scanQR: "Scan QR Code Option Available on Site",
    stationId: "Station ID",
    insufficient: "Insufficient data",
    min: "min",
    noServices: "No active services found.",
    search: "Search services...",
    customerView: "Join a Queue",
    adminView: "Manage Queues",
    chooseRole: "Select Your Goal",
    addService: "Add New Service",
    myServices: "My Service Points",
    nextDesc: "Press for Next Customer",
    insights: "Smart Insights",
    peakHours: "Peak hours detected. Consider opening another counter.",
    normalFlow: "Normal flow. Average wait time is stable.",
    manage: "Manage",
    offline: "Offline Mode",
    address: "Address/Location",
    category: "Category",
    confirmCancel: "Cancel Token?",
    confirmCancelSub: "Are you sure you want to leave this queue?",
    yes: "Yes, Cancel",
    no: "Back",
    nadra: "NADRA Office",
    passport: "Passport Office",
    clinic: "Clinic",
    bank: "Bank",
    utility: "Utility Store",
    waitLow: "Fast",
    waitMedium: "Moderate",
    waitHigh: "Crowded",
    queueIntensity: "Queue Intensity",
    openNow: "Open Now",
    closed: "Closed",
    gov: "Govt Office",
    med: "Medical",
    bankCat: "Banking",
    edu: "Education",
    other: "Other"
  },
  ur: {
    welcome: "کیولیس میں خوش آمدید",
    welcomeSub: "پاکستان میں جسمانی قطاروں سے نجات پائیں۔",
    login: "گوگل کے ساتھ لاگ ان کریں",
    welcomeHeader: "ڈیجیٹل ویٹنگ سلوشن",
    assalam: "اسلام علیکم",
    nearby: "قریبی خدمات",
    admin: "ایڈمن",
    nowServing: "ابھی باری ہے",
    back: "پیچھے",
    home: "ہوم",
    share: "کیو آر کوڈ شیئر کریں",
    scanToJoin: "شامل ہونے کے لیے اسکین کریں",
    joinQueue: "قطار میں شامل ہوں",
    joining: "شامل ہو رہے ہیں...",
    waitTime: "انتظار کا وقت",
    avgSpeed: "اوسط رفتار",
    yourStatus: "آپ کی صورتحال",
    yourToken: "آپ کا ٹوکن",
    peopleAhead: "لوگ آپ سے پہلے ہیں",
    yourTurn: "اب آپ کی باری ہے!",
    hurryUp: "جلدی کریں!",
    hurryUpSub: "کاؤنٹر کے قریب جائیں۔",
    cancelToken: "ٹوکن منسوخ کریں",
    adminConsole: "ایڈمن کنسول",
    totalIssued: "کل جاری کردہ",
    nextToken: "اگلا ٹوکن",
    setupCounter: "کاؤنٹر سیٹ کریں",
    serviceName: "سروس پوائنٹ کا نام",
    live: "لائیو",
    scanQR: "سائٹ پر کیو آر کوڈ اسکین کا آپشن دستیاب ہے",
    stationId: "اسٹیشن آئی ڈی",
    insufficient: "ناکافی ڈیٹا",
    min: "منٹ",
    noServices: "کوئی فعال سروس نہیں ملی۔",
    search: "خدمات تلاش کریں...",
    customerView: "قطار میں شامل ہوں",
    adminView: "قطاروں کا انتظام کریں",
    chooseRole: "اپنا مقصد منتخب کریں",
    addService: "نئی سروس شامل کریں",
    myServices: "میری خدمات",
    nextDesc: "اگلے کسٹمر کے لیے دبائیں",
    insights: "اسمارٹ معلومات",
    peakHours: "رش زیادہ ہے۔ مزید کاؤنٹر کھولنے پر غور کریں۔",
    normalFlow: "معمول کی باری چل رہی ہے۔ انتظار کا وقت مستحکم ہے۔",
    manage: "انتظام کریں",
    offline: "آف لائن موڈ",
    address: "پتہ / مقام",
    category: "قسم",
    confirmCancel: "ٹوکن منسوخ کریں؟",
    confirmCancelSub: "کیا آپ واقعی اس قطار کو چھوڑنا چاہتے ہیں؟",
    yes: "جی ہاں، منسوخ کریں",
    no: "پیچھے",
    nadra: "نادرا آفس",
    passport: "پاسپورٹ آفس",
    clinic: "کلینک",
    bank: "بینک",
    utility: "یوٹیلیٹی اسٹور",
    waitLow: "تیز",
    waitMedium: "معتدل",
    waitHigh: "پُر ہجوم",
    queueIntensity: "قطار کی شدت",
    openNow: "ابھی کھلا ہے",
    closed: "بند ہے",
    gov: "سرکاری دفتر",
    med: "طبی",
    bankCat: "بینکنگ",
    edu: "تعلیمی",
    other: "دیگر"
  }
};

// --- App Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'user' | 'admin' | null>(null);
  const [view, setView] = useState<'home' | 'join' | 'status' | 'admin'>('home');
  const [queues, setQueues] = useState<ServiceQueue[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<ServiceQueue | null>(null);
  const [lang, setLang] = useState<'en' | 'ur'>('en');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const t = translations[lang];
  const isRtl = lang === 'ur';

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) setRole(null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const queuesQuery = query(collection(db, 'queues'), where('status', '==', 'open'));
    const unsubscribeQueues = onSnapshot(queuesQuery, (snapshot) => {
      const qList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceQueue));
      setQueues(qList);
    });
    
    return () => {
      unsubscribeQueues();
    };
  }, [user]);

  useEffect(() => {
    if (!user || queues.length === 0) return;

    // Direct Join via URL logic
    const params = new URLSearchParams(window.location.search);
    const serviceId = params.get('serviceId');
    
    if (serviceId && view === 'home') {
      const targetQueue = queues.find(q => q.id === serviceId);
      if (targetQueue) {
        setSelectedQueue(targetQueue);
        setView('join');
        // Clear param to avoid re-triggering on manual navigation back to home
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [user, queues, view]);

  const handleLogin = async () => {
    try {
      console.log("Attempting login...");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      console.log("Login successful");
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/network-request-failed') {
        alert("Network error: Please verify that third-party cookies are enabled and no ad-blockers are interfering with Firebase. If you're using an Incognito window, try a regular one.");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        >
          <RefreshCw className="text-emerald-600 w-8 h-8" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isRtl ? 'font-urdu' : 'font-sans'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className={`relative overflow-hidden flex flex-col transition-all duration-500 ${view === 'admin' ? 'w-full max-w-2xl min-h-[600px]' : 'w-[360px] h-[720px] rounded-[40px] border-[8px] border-slate-800'} glass bg-white/40 shadow-2xl`}>
        {/* Notch (only for mobile view) */}
        {view !== 'admin' && (
          <div className="h-6 w-1/3 bg-slate-800 absolute top-0 left-1/2 -translate-x-1/2 rounded-b-2xl z-40"></div>
        )}

        {/* Header */}
        <header className={`p-6 ${view === 'admin' ? 'pt-8' : 'pt-12'} flex items-center justify-between z-30`}>
          <div className={isRtl ? 'text-right' : 'text-left'}>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">QueueLess</h1>
              {!isOnline && (
                <span className="flex items-center gap-1 bg-red-50 text-red-500 text-[10px] font-black px-2 py-0.5 rounded-full border border-red-100 animate-pulse">
                  <div className="w-1 h-1 bg-red-500 rounded-full"></div>
                  {lang === 'en' ? 'OFFLINE' : 'آف لائن'}
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Digital Waiting</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setLang(lang === 'en' ? 'ur' : 'en')}
              className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100"
            >
              {lang === 'en' ? 'اردو' : 'English'}
            </button>
            {user && (
              <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-slate-900 transition-colors ml-2">
                <LogOut size={18} />
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 pt-2 overflow-y-auto z-10">
          <AnimatePresence mode="wait">
            {!user ? (
              <WelcomeScreen onLogin={handleLogin} t={t} isRtl={isRtl} />
            ) : !role ? (
              <RoleSelectionScreen onSelect={(r) => { setRole(r); setView(r === 'admin' ? 'admin' : 'home'); }} t={t} isRtl={isRtl} />
            ) : view === 'home' ? (
              <HomeScreen 
                queues={queues} 
                onSelect={(q) => { setSelectedQueue(q); setView('join'); }} 
                onAdmin={() => { setRole('admin'); setView('admin'); }}
                user={user}
                t={t}
                isRtl={isRtl}
                lang={lang}
              />
            ) : view === 'join' && selectedQueue ? (
              <JoinScreen 
                queue={selectedQueue} 
                user={user}
                onBack={() => setView('home')} 
                onJoined={() => setView('status')} 
                t={t}
                isRtl={isRtl}
              />
            ) : view === 'status' && selectedQueue ? (
              <StatusScreen 
                queue={selectedQueue} 
                user={user}
                onBack={() => setView('home')} 
                t={t}
                isRtl={isRtl}
              />
            ) : view === 'admin' ? (
              <AdminScreen 
                onBack={() => { setRole(null); setView('home'); }} 
                user={user}
                t={t}
                isRtl={isRtl}
              />
            ) : null}
          </AnimatePresence>
        </main>

        {/* Bottom Bar (Indicator) */}
        {view !== 'admin' && user && (
          <div className="h-1.5 w-1/3 bg-slate-300 mx-auto mb-2 rounded-full z-10"></div>
        )}
      </div>
    </div>
  );
}

// --- Sub-screens ---

function WelcomeScreen({ onLogin, t, isRtl }: { onLogin: () => void, t: any, isRtl: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center h-full text-center space-y-8"
    >
      <div className="w-20 h-20 bg-emerald-100 rounded-[28px] flex items-center justify-center shadow-lg shadow-emerald-100/50">
        <Users className="text-emerald-600 w-10 h-10" />
      </div>
      <div className="space-y-1">
        <h2 className="text-3xl font-black text-slate-800 tracking-tighter">{t.welcome}</h2>
        <p className="text-emerald-600 font-bold uppercase text-xs tracking-widest">{t.welcomeHeader}</p>
        <p className="text-slate-500 text-sm max-w-[200px] mx-auto mt-4 leading-relaxed">{t.welcomeSub}</p>
      </div>
      <button 
        onClick={onLogin}
        className={`w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-lg hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-200/50 uppercase tracking-tight ${isRtl ? 'pb-5' : ''}`}
      >
        {t.login}
      </button>
    </motion.div>
  );
}

function RoleSelectionScreen({ onSelect, t, isRtl }: { onSelect: (role: 'user' | 'admin') => void, t: any, isRtl: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }} 
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center min-h-[400px] gap-6"
    >
      <h2 className="text-2xl font-black text-slate-800 text-center">{t.chooseRole}</h2>
      
      <div className="grid grid-cols-2 gap-4 w-full">
        <button 
          onClick={() => onSelect('user')}
          className="flex flex-col items-center justify-center p-6 bg-emerald-500 hover:bg-emerald-600 transition-all rounded-[32px] text-center shadow-lg shadow-emerald-200 border border-emerald-400 group h-full"
        >
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-white/30 transition-colors">
            <Users className="text-white" size={32} />
          </div>
          <span className="text-sm font-black text-white uppercase tracking-tight leading-tight">{t.customerView}</span>
        </button>

        <button 
          onClick={() => onSelect('admin')}
          className="flex flex-col items-center justify-center p-6 bg-slate-800 hover:bg-slate-700 transition-all rounded-[32px] text-center shadow-lg border border-slate-700 group h-full"
        >
          <div className="w-16 h-16 bg-slate-700 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-slate-600 transition-colors">
            <LayoutDashboard className="text-white" size={32} />
          </div>
          <span className="text-sm font-black text-white uppercase tracking-tight leading-tight">{t.adminView}</span>
        </button>
      </div>
    </motion.div>
  );
}

function HomeScreen({ queues, onSelect, onAdmin, user, t, isRtl, lang }: { queues: ServiceQueue[], onSelect: (q: ServiceQueue) => void, onAdmin: () => void, user: User, t: any, isRtl: boolean, lang: 'en' | 'ur' }) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredQueues = queues.filter(q => 
    q.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.description && q.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (q.address && q.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (q.category && q.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className={`glass bg-white/60 p-5 rounded-3xl ${isRtl ? 'text-right' : 'text-left'}`}>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">{t.assalam}</h3>
        <p className="text-xl font-black text-slate-800">{user.displayName?.split(' ')[0] || 'Friend'}</p>
      </div>

      <div className="relative">
        <input 
          type="text" 
          placeholder={lang === 'en' ? "Search NADRA, Banks, Clinics..." : "نادرا، بینک، کلینک تلاش کریں..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`w-full py-3 px-10 glass bg-white/60 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${isRtl ? 'text-right' : 'text-left'}`}
        />
        <div className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRtl ? 'right-3' : 'left-3'}`}>
          <Search size={16} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h4 className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">{t.nearby}</h4>
          <button onClick={onAdmin} className="text-white text-[10px] font-black uppercase flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-full hover:bg-slate-700 transition-all shadow-sm">
            <LayoutDashboard size={12} /> {t.adminView}
          </button>
        </div>
        
        {filteredQueues.length === 0 ? (
          <div className="p-8 text-center glass rounded-3xl text-slate-400 text-sm border-dashed">
            {t.noServices}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQueues.map(q => (
              <motion.div 
                key={q.id}
                whileHover={{ scale: 1.01 }}
                onClick={() => onSelect(q)}
                className="p-4 glass bg-white/80 rounded-3xl flex flex-col gap-4 cursor-pointer border-white/50 group shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : 'flex-row'} min-w-0 flex-1`}>
                    <div className="shrink-0 w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center shadow-inner">
                      <Users className="text-emerald-500 w-6 h-6" />
                    </div>
                    <div className={`${isRtl ? 'text-right' : 'text-left'} min-w-0 flex-1`}>
                      <div className="flex flex-col">
                          <h5 className="font-black text-slate-800 text-base leading-tight group-hover:text-emerald-600 transition-colors truncate">{q.name}</h5>
                          <div className={`flex items-center gap-2 mt-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                            {q.category && (
                                <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest truncate max-w-[80px]">
                                    {q.category === 'Government' ? t.gov : 
                                     q.category === 'Medical' ? t.med :
                                     q.category === 'Banking' ? t.bankCat :
                                     q.category === 'Education' ? t.edu : t.other}
                                </span>
                            )}
                            <span className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest ${q.status === 'open' ? 'text-emerald-600' : 'text-rose-500'} shrink-0`}>
                                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${q.status === 'open' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                {q.status === 'open' ? t.openNow : t.closed}
                            </span>
                          </div>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-center justify-center bg-emerald-50 rounded-2xl px-3 py-1.5 border border-emerald-100 min-w-[70px]">
                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-1">{t.nowServing}</span>
                    <span className="text-base font-black text-emerald-600 leading-none">#{q.currentTokenNumber}</span>
                  </div>
                </div>

                <div className={`flex items-center justify-between gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className={`shrink-1 min-w-0 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{q.address || 'Pakistan'}</p>
                    </div>
                    <div 
                      className={`shrink-0 flex items-center gap-1.5 bg-emerald-500 text-white px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 group-hover:bg-emerald-600 transition-all active:scale-95 ${isRtl ? 'flex-row-reverse' : ''}`}
                    >
                        {t.joinQueue}
                        <ChevronRight className={isRtl ? 'rotate-180' : ''} size={14} />
                    </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function JoinScreen({ queue, user, onBack, onJoined, t, isRtl }: { queue: ServiceQueue, user: User, onBack: () => void, onJoined: () => void, t: any, isRtl: boolean }) {
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const tokenNumber = queue.totalTokensIssued + 1;
      await updateDoc(doc(db, 'queues', queue.id), {
        totalTokensIssued: increment(1)
      }).catch(err => handleFirestoreError(err, 'update', `queues/${queue.id}`, user));

      await addDoc(collection(db, 'queues', queue.id, 'tokens'), {
        tokenNumber,
        userName: user.displayName || 'Anonymous',
        userId: user.uid,
        adminId: queue.adminId,
        status: 'waiting',
        joinedAt: serverTimestamp()
      }).catch(err => handleFirestoreError(err, 'create', `queues/${queue.id}/tokens`, user));

      onJoined();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Permission Denied');
    } finally {
      setJoining(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <button onClick={onBack} className={`text-slate-400 flex items-center gap-1 font-bold text-xs uppercase tracking-widest ${isRtl ? 'flex-row-reverse' : ''}`}>
        <ChevronRight className={isRtl ? '' : 'rotate-180'} size={14} /> {t.back}
      </button>

      <div className={`space-y-1 ${isRtl ? 'text-right' : 'text-left'}`}>
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">{queue.name}</h2>
        <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{queue.address || 'Pakistan'}</p>
        {queue.category && <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{queue.category}</p>}
      </div>

      <div className="glass bg-emerald-50/50 p-6 rounded-3xl text-center border-emerald-200">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t.nowServing}</p>
        <p className="text-6xl font-black text-emerald-600">#{queue.currentTokenNumber}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`p-4 glass bg-white/60 rounded-2xl ${isRtl ? 'text-right' : 'text-left'}`}>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">{t.waitTime}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-800">{queue.averageServiceTime * (queue.totalTokensIssued - queue.currentTokenNumber)}</span>
            <span className="text-[10px] font-bold text-slate-400">{t.min}</span>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-[8px] font-black uppercase tracking-tighter">
                <span className="text-slate-400">{t.queueIntensity}</span>
                <span className={
                    (queue.averageServiceTime * (queue.totalTokensIssued - queue.currentTokenNumber)) < 15 ? 'text-emerald-500' : 
                    (queue.averageServiceTime * (queue.totalTokensIssued - queue.currentTokenNumber)) < 30 ? 'text-orange-400' : 'text-red-500'
                }>
                    {(queue.averageServiceTime * (queue.totalTokensIssued - queue.currentTokenNumber)) < 15 ? t.waitLow : 
                     (queue.averageServiceTime * (queue.totalTokensIssued - queue.currentTokenNumber)) < 30 ? t.waitMedium : t.waitHigh}
                </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100/50 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(8, (queue.averageServiceTime * (queue.totalTokensIssued - queue.currentTokenNumber) / 60) * 100))}%` }}
                    className={`h-full ${
                        (queue.averageServiceTime * (queue.totalTokensIssued - queue.currentTokenNumber)) < 15 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 
                        (queue.averageServiceTime * (queue.totalTokensIssued - queue.currentTokenNumber)) < 30 ? 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                    }`}
                />
            </div>
          </div>
        </div>
        <div className={`p-4 glass bg-white/60 rounded-2xl ${isRtl ? 'text-right' : 'text-left'}`}>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">{t.avgSpeed}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-800">{queue.averageServiceTime}</span>
            <span className="text-[10px] font-bold text-slate-400">{t.min}</span>
          </div>
          <p className="text-[8px] font-bold text-slate-300 uppercase mt-4">{t.stationId}: 01</p>
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <button 
          onClick={handleJoin}
          disabled={joining}
          className={`w-full py-4 bg-emerald-500 text-white rounded-2xl font-black shadow-lg shadow-emerald-200/50 uppercase tracking-tight flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-50 ${isRtl ? 'pb-5' : ''}`}
        >
          {joining ? t.joining : t.joinQueue}
        </button>
        <p className="text-[10px] text-center text-slate-400 uppercase font-bold tracking-widest">{t.scanQR}</p>
      </div>
    </motion.div>
  );
}

function StatusScreen({ queue, user, onBack, t, isRtl }: { queue: ServiceQueue, user: User, onBack: () => void, t: any, isRtl: boolean }) {
  const [token, setToken] = useState<QueueToken | null>(null);
  const [liveQueue, setLiveQueue] = useState<ServiceQueue>(queue);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const unsubscribeQueue = onSnapshot(doc(db, 'queues', queue.id), (doc) => {
      setLiveQueue({ id: doc.id, ...doc.data() } as ServiceQueue);
    });

    const tokenQuery = query(
      collection(db, 'queues', queue.id, 'tokens'),
      where('userId', '==', user.uid),
      orderBy('joinedAt', 'desc'),
      limit(1)
    );

    const unsubscribeToken = onSnapshot(tokenQuery, (snapshot) => {
      if (!snapshot.empty) {
        setToken({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as QueueToken);
      }
    });

    return () => {
      unsubscribeQueue();
      unsubscribeToken();
    };
  }, [queue.id, user.uid]);

  const handleCancel = async () => {
    if (!token) return;
    setCancelling(true);
    try {
        await updateDoc(doc(db, 'queues', queue.id, 'tokens', token.id), {
            status: 'cancelled'
        }).catch(err => handleFirestoreError(err, 'update', `queues/${queue.id}/tokens/${token.id}`, user));
        onBack();
    } catch (err) {
        console.error(err);
    } finally {
        setCancelling(false);
        setShowConfirm(false);
    }
  };

  const peopleAhead = token ? Math.max(0, token.tokenNumber - liveQueue.currentTokenNumber) : 0;
  const estimatedWait = peopleAhead * liveQueue.averageServiceTime;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6 flex flex-col h-full"
    >
      <div className="flex items-center justify-between">
        <button onClick={onBack} className={`text-slate-400 flex items-center gap-1 font-bold text-xs uppercase tracking-widest ${isRtl ? 'flex-row-reverse' : ''}`}>
          <ChevronRight className={isRtl ? '' : 'rotate-180'} size={14} /> {t.home}
        </button>
        <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Joined</span>
      </div>

      <div className="flex-1 space-y-6">
        <div className="glass bg-white/80 p-6 rounded-[32px] border-white/50">
            <div className={`flex justify-between items-start mb-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="text-xs font-black text-slate-800 uppercase tracking-widest">{t.yourStatus}</span>
            <div className={`w-2 h-2 rounded-full animate-pulse ${token?.status === 'cancelled' ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
            </div>

            <div className={`flex justify-between items-end ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className={`flex flex-col ${isRtl ? 'text-right' : 'text-left'}`}>
                <span className="text-5xl font-black text-slate-800 tracking-tighter">#{token?.tokenNumber || '--'}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.yourToken}</span>
            </div>
            <div className={isRtl ? 'text-left' : 'text-right'}>
                <span className="text-2xl font-black text-emerald-600">{estimatedWait} <span className="text-xs">{t.min}</span></span>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t.waitTime}</p>
            </div>
            </div>

            <div className="mt-6 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(10, 100 - (peopleAhead * 10))}%` }}
                className={`h-full ${token?.status === 'cancelled' ? 'bg-red-200' : 'bg-emerald-500'}`}
            ></motion.div>
            </div>
            <p className="text-[10px] mt-3 p-2 bg-emerald-50 rounded-xl text-emerald-700 font-bold text-center uppercase tracking-widest">
                {token?.status === 'cancelled' ? 'CANCELLED' : peopleAhead === 0 ? t.yourTurn : `${peopleAhead} ${t.peopleAhead}`}
            </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
            <div className="p-4 glass bg-white/40 rounded-2xl text-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t.nowServing}</p>
                <p className="text-xl font-black text-slate-800">#{liveQueue.currentTokenNumber}</p>
            </div>
            <div className="p-4 glass bg-white/40 rounded-2xl text-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t.totalIssued}</p>
                <p className="text-xl font-black text-slate-800">{liveQueue.totalTokensIssued}</p>
            </div>
        </div>

        {peopleAhead > 0 && peopleAhead <= 5 && token?.status !== 'cancelled' && (
            <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className={`p-5 bg-orange-600 text-white rounded-[24px] flex items-center gap-4 shadow-lg shadow-orange-200 ${isRtl ? 'flex-row-reverse text-right' : ''}`}
            >
                <AlertCircle size={32} />
                <div>
                    <p className="font-bold">{t.hurryUp}</p>
                    <p className="text-xs opacity-90">{t.hurryUpSub}</p>
                </div>
            </motion.div>
        )}
      </div>

      <div className="mt-auto pt-6 flex flex-col gap-4">
        {token?.status !== 'cancelled' && (
            <button 
                onClick={() => setShowConfirm(true)}
                className="w-full flex items-center justify-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-red-500 transition-colors"
            >
                {t.cancelToken}
            </button>
        )}
      </div>

      <AnimatePresence>
        {showConfirm && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
            >
                <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="glass bg-white p-8 rounded-[40px] max-w-xs w-full text-center space-y-6 shadow-2xl overflow-hidden relative"
                >
                    <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-2 text-red-500">
                        <AlertCircle size={40} />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-black text-slate-800">{t.confirmCancel}</h3>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">{t.confirmCancelSub}</p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <button 
                            disabled={cancelling}
                            onClick={handleCancel}
                            className="w-full py-4 bg-red-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-red-100 transition-all hover:bg-red-600 active:scale-95"
                        >
                            {cancelling ? '...' : t.yes}
                        </button>
                        <button 
                            onClick={() => setShowConfirm(false)}
                            className="w-full py-3 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600 transition-colors"
                        >
                            {t.no}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AdminScreen({ onBack, user, t, isRtl }: { onBack: () => void, user: User, t: any, isRtl: boolean }) {
  const [loading, setLoading] = useState(true);
  const [myQueues, setMyQueues] = useState<ServiceQueue[]>([]);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<ServiceQueue['category']>('Other');
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'queues'), where('adminId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const qList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceQueue));
      setMyQueues(qList);
      setLoading(false);
      // If no active queue selected, pick the first one if it exists
      if (!activeQueueId && qList.length > 0) {
        setActiveQueueId(qList[0].id);
      }
    });
    return () => unsubscribe();
  }, [user.uid, activeQueueId]);

  const activeQueue = myQueues.find(q => q.id === activeQueueId);

  const handleCreate = async () => {
    if (!name) return;
    setIsCreating(true);
    try {
        const docRef = await addDoc(collection(db, 'queues'), {
            name,
            address,
            category,
            description: "Managed by QueueLess Admin",
            averageServiceTime: 5,
            currentTokenNumber: 1,
            totalTokensIssued: 1,
            status: 'open',
            adminId: user.uid
        }).catch(err => handleFirestoreError(err, 'create', 'queues', user));
        setActiveQueueId(docRef.id);
        setName('');
        setAddress('');
        setCategory('Other');
    } catch (err) { console.error(err); } finally { setIsCreating(false); }
  };

  const handleNext = async () => {
    if (!activeQueue || activeQueue.currentTokenNumber >= activeQueue.totalTokensIssued) return;
    try {
        await updateDoc(doc(db, 'queues', activeQueue.id), {
            currentTokenNumber: increment(1)
        }).catch(err => handleFirestoreError(err, 'update', `queues/${activeQueue.id}`, user));
    } catch (err) { console.error(err); }
  };

  if (loading) return null;

  const shareUrl = `${window.location.origin}${window.location.pathname}?serviceId=${activeQueue?.id}`;

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="px-4 py-8 space-y-8"
    >
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-6 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <button onClick={onBack} className="shrink-0 w-10 h-10 flex items-center justify-center glass bg-white rounded-full text-slate-400 hover:text-slate-800 transition-colors shadow-sm active:scale-95">
                <ChevronRight className={isRtl ? '' : 'rotate-180'} size={20} />
            </button>
            <div className={`min-w-0 ${isRtl ? 'text-right' : 'text-left'}`}>
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tighter uppercase italic leading-none">
                    {t.adminConsole}
                </h2>
                <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest truncate max-w-[180px] sm:max-w-none">
                    {activeQueue?.name || t.myServices}
                  </p>
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-300 uppercase tracking-widest sm:border-l sm:border-slate-200 sm:pl-3">
                    <span className="hidden sm:inline">Region:</span>
                    <span className="text-slate-400">Karachi-1</span>
                  </div>
                </div>
            </div>
        </div>
        <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : 'justify-end'}`}>
          <div className="flex items-center bg-slate-100/50 p-1 rounded-[20px] border border-slate-200/50 shadow-inner">
            {activeQueue && (
              <button 
                onClick={() => setShowQR(true)}
                className="w-9 h-9 flex items-center justify-center bg-white text-emerald-600 rounded-[14px] hover:bg-emerald-50 transition-all shadow-sm active:scale-95"
                title={t.share}
              >
                <QrCode size={18} />
              </button>
            )}
            <div className="px-3 h-9 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{t.live}</span>
            </div>
          </div>
        </div>
      </div>

      {showQR && activeQueue && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="glass bg-white p-8 rounded-[40px] max-w-sm w-full relative shadow-2xl"
          >
            <button 
              onClick={() => setShowQR(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-800"
            >
              <X size={24} />
            </button>
            
            <div className="text-center space-y-6">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-800">{t.share}</h3>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">{activeQueue.name}</p>
              </div>
              
              <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-inner flex items-center justify-center">
                <QRCodeSVG value={shareUrl} size={180} level="H" />
              </div>
              
              <div className="space-y-4">
                <p className="text-xs text-slate-400 font-medium">{t.scanToJoin}</p>
                <div className="p-3 bg-slate-50 rounded-xl break-all text-[10px] font-mono text-slate-500 border border-slate-100 select-all">
                  {shareUrl}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Main Control Area (Stats + Next Button) - High priority on mobile */}
        <div className="lg:col-span-2 order-1 lg:order-2 space-y-6">
            {activeQueue ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Active Queue Status & Controls */}
                    <div className="flex flex-col gap-6">
                        <div className="flex-1 glass bg-white/60 p-6 sm:p-10 rounded-[32px] flex flex-col items-center justify-center text-center shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 leading-none">{t.nowServing}</p>
                            <p className="text-7xl sm:text-8xl font-black text-slate-800 tracking-tighter leading-none mb-2">#{activeQueue.currentTokenNumber}</p>
                            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                              {t.live}
                            </div>
                        </div>
                        
                        <button 
                            onClick={handleNext}
                            disabled={activeQueue.currentTokenNumber >= activeQueue.totalTokensIssued}
                            className={`group w-full bg-slate-800 text-white rounded-[28px] py-6 sm:py-8 flex items-center justify-center gap-4 hover:bg-slate-700 transition-all active:scale-95 shadow-xl shadow-slate-200 disabled:opacity-50 disabled:grayscale ${isRtl ? 'flex-row-reverse' : ''}`}
                        >
                            <div className="flex flex-col items-center sm:items-start">
                              <span className="text-xl sm:text-2xl font-black tracking-tight uppercase leading-none">{t.nextToken}</span>
                              <span className="text-[10px] font-bold opacity-50 uppercase tracking-widest mt-1">{t.nextDesc}</span>
                            </div>
                            <ChevronRight className={`group-hover:translate-x-1 transition-transform ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : ''}`} size={28} />
                        </button>
                    </div>

                    {/* Stats & Insights */}
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                           <div className={`p-6 glass bg-slate-50/50 rounded-3xl border-slate-200/50 shadow-sm ${isRtl ? 'text-right' : 'text-left'}`}>
                               <div className="w-8 h-8 bg-sky-100 rounded-xl flex items-center justify-center mb-3 text-sky-600">
                                 <Users size={16} />
                               </div>
                               <p className="text-[9px] text-slate-400 mb-1 uppercase font-black tracking-widest">{t.totalIssued}</p>
                               <p className="text-3xl font-black text-slate-800 leading-none">{activeQueue.totalTokensIssued}</p>
                           </div>
                           <div className={`p-6 glass bg-emerald-50/50 rounded-3xl border-emerald-100/50 shadow-sm ${isRtl ? 'text-right' : 'text-left'}`}>
                               <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center mb-3 text-emerald-600">
                                 <LayoutDashboard size={16} />
                               </div>
                               <p className="text-[9px] text-emerald-600/60 mb-1 uppercase font-black tracking-widest">{t.avgSpeed}</p>
                               <p className="text-3xl font-black text-emerald-700 leading-none">{activeQueue.averageServiceTime}{t.min[0]}</p>
                           </div>
                        </div>
                        
                        <div className={`glass p-6 rounded-3xl shadow-sm border-white ${isRtl ? 'text-right' : 'text-left'}`}>
                            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                              {t.insights}
                            </h3>
                            <p className="text-xs text-slate-500 leading-relaxed font-medium">
                              {activeQueue.totalTokensIssued > 10 ? t.peakHours : t.normalFlow}
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-64 flex items-center justify-center glass bg-white/40 p-12 rounded-[40px] text-slate-400 font-black uppercase tracking-widest border-2 border-dashed border-slate-200 text-center">
                    {t.noServices}
                </div>
            )}
        </div>

        {/* Sidebar (My Services + Creation) */}
        <div className="lg:col-span-1 order-2 lg:order-1 space-y-6">
            <div className="glass p-6 rounded-[32px] space-y-6 shadow-sm border-white">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t.myServices}</h3>
                  <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-hide no-scrollbar">
                      {myQueues.map(q => (
                          <button 
                              key={q.id}
                              onClick={() => setActiveQueueId(q.id)}
                              className={`shrink-0 lg:shrink-1 w-48 lg:w-full p-4 rounded-2xl flex items-center justify-between transition-all font-black text-xs uppercase tracking-tight text-left ${activeQueueId === q.id ? 'bg-slate-800 text-white shadow-lg shadow-slate-200' : 'bg-white/50 text-slate-600 hover:bg-white border border-slate-100'}`}
                          >
                              <span className="truncate pr-2">{q.name}</span>
                              <span className={`shrink-0 text-[9px] px-2 py-1 rounded-lg font-black ${activeQueueId === q.id ? 'bg-white/20' : 'bg-slate-100'}`}>#{q.currentTokenNumber}</span>
                          </button>
                      ))}
                      {myQueues.length === 0 && (
                        <p className="text-[10px] text-slate-400 font-bold uppercase italic px-2">No services yet</p>
                      )}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-3">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1">{t.addService}</h3>
                    <div className="space-y-2">
                      <input 
                          type="text" 
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={t.serviceName}
                          className="w-full p-4 glass bg-white/50 rounded-2xl text-xs font-black uppercase tracking-tight outline-none border-2 border-transparent focus:border-emerald-200 transition-all shadow-sm placeholder:text-slate-300"
                      />
                      <input 
                          type="text" 
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder={t.address}
                          className="w-full p-4 glass bg-white/50 rounded-2xl text-xs font-black uppercase tracking-tight outline-none border-2 border-transparent focus:border-emerald-200 transition-all shadow-sm placeholder:text-slate-300"
                      />
                      <select 
                          value={category}
                          onChange={(e) => setCategory(e.target.value as any)}
                          className="w-full p-4 glass bg-white/50 rounded-2xl text-xs font-black uppercase tracking-tight outline-none border-2 border-transparent focus:border-emerald-200 transition-all shadow-sm appearance-none cursor-pointer"
                      >
                          <option value="Other">{t.category}</option>
                          <option value="Government">{t.nadra} / Government</option>
                          <option value="Medical">{t.clinic} / Medical</option>
                          <option value="Banking">{t.bank} / Banking</option>
                          <option value="Education">Education</option>
                      </select>
                      <button 
                          onClick={handleCreate}
                          disabled={isCreating || !name}
                          className="w-full py-4 bg-emerald-500 text-white rounded-[20px] font-black text-[11px] uppercase tracking-widest disabled:opacity-50 shadow-lg shadow-emerald-100 active:scale-95 transition-all mt-2"
                      >
                          {isCreating ? t.joining : t.addService}
                      </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </motion.div>
  );
}
