/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, Component, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { 
  Car, 
  MapPin, 
  Calendar as CalendarIcon, 
  Clock, 
  Star, 
  CheckCircle2, 
  ArrowRight, 
  Menu, 
  X,
  Phone,
  Mail,
  Instagram,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Settings as SettingsIcon,
  LogOut,
  Plus,
  Trash2,
  Edit2,
  Lock,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { format, addDays, startOfToday, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { auth, db } from './firebase';

// --- Types & Constants ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type Service = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  price: number;
  icon: string;
};

type Booking = {
  id?: string;
  userId?: string;
  serviceId: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  date: string;
  carInfo: string;
  distance: number;
  travelFee: number;
  total: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: Timestamp;
};

type Availability = {
  date: string;
  slots: string[];
};

type GlobalSettings = {
  baseLocation: string;
  travelFeePerKm: number;
  maxDistance: number;
  adminEmail: string;
};

type UserProfile = {
  email: string;
  role: 'admin' | 'user';
  phone?: string;
  defaultCarInfo?: string;
};

const DEFAULT_SERVICES: Service[] = [
  {
    id: 'exterior',
    name: 'Exterior Detail',
    tagline: 'Outside, Perfected',
    description: 'Hand wash, clay bar treatment, tire dressing, window polish, and a streak-free protective wax.',
    price: 80,
    icon: 'Car',
  },
  {
    id: 'interior',
    name: 'Interior Detail',
    tagline: 'Inside, Restored',
    description: 'Full vacuum, steam cleaning, dashboard rejuvenation, leather conditioning, and deep deodorizing.',
    price: 120,
    icon: 'Sparkles',
  }
];

const DEFAULT_SETTINGS: GlobalSettings = {
  baseLocation: 'Sussex, NB',
  travelFeePerKm: 0.5,
  maxDistance: 100,
  adminEmail: 'admin@wiliodaeze.resend.app'
};

// --- Error Boundary ---
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

// --- Components ---

const Navbar = ({ onBookClick, onDashboardClick, user }: { onBookClick: () => void, onDashboardClick: () => void, user: FirebaseUser | null }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      isScrolled ? 'bg-brand-white/90 backdrop-blur-md py-4 border-b border-brand-light-grey' : 'bg-transparent py-8'
    }`}>
      <div className="max-w-7xl mx-auto px-6 md:px-10 flex justify-between items-center">
        <div className="font-condensed font-bold text-lg tracking-[0.12em] uppercase">
          PureRun
        </div>

        <div className="hidden md:flex items-center gap-10">
          <a href="#services" className="text-[11px] tracking-[0.14em] uppercase font-medium opacity-60 hover:opacity-100 transition-opacity">Services</a>
          <a href="#how-it-works" className="text-[11px] tracking-[0.14em] uppercase font-medium opacity-60 hover:opacity-100 transition-opacity">Process</a>
          {user ? (
            <button onClick={onDashboardClick} className="flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase font-medium opacity-60 hover:opacity-100 transition-opacity">
              <SettingsIcon className="w-3 h-3" /> Dashboard
            </button>
          ) : (
            <button onClick={onDashboardClick} className="text-[11px] tracking-[0.14em] uppercase font-medium opacity-60 hover:opacity-100 transition-opacity flex items-center gap-2">
              <Lock className="w-3 h-3" /> Login
            </button>
          )}
          <button onClick={onBookClick} className="btn-primary py-2 px-6">
            Book Now
          </button>
        </div>

        <button className="md:hidden p-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 bg-brand-white border-b border-brand-light-grey p-6 flex flex-col gap-6 md:hidden shadow-xl"
          >
            <a href="#services" onClick={() => setIsMobileMenuOpen(false)} className="text-sm tracking-widest uppercase font-medium">Services</a>
            <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="text-sm tracking-widest uppercase font-medium">Process</a>
            <button onClick={() => { setIsMobileMenuOpen(false); onDashboardClick(); }} className="text-sm tracking-widest uppercase font-medium text-left">{user ? 'Dashboard' : 'Login'}</button>
            <button onClick={() => { setIsMobileMenuOpen(false); onBookClick(); }} className="btn-primary w-full">Book Now</button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const BookingModal = ({ isOpen, onClose, services, settings, user, profile }: { isOpen: boolean, onClose: () => void, services: Service[], settings: GlobalSettings, user: FirebaseUser | null, profile: UserProfile | null }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    serviceId: '',
    name: user?.displayName || '',
    email: user?.email || '',
    phone: profile?.phone || '',
    location: '',
    date: '',
    carInfo: profile?.defaultCarInfo || '',
    distance: 0
  });

  useEffect(() => {
    if (user || profile) {
      setFormData(prev => ({
        ...prev,
        name: user?.displayName || prev.name,
        email: user?.email || prev.email,
        phone: profile?.phone || prev.phone,
        carInfo: profile?.defaultCarInfo || prev.carInfo
      }));
    }
  }, [user, profile]);

  const selectedService = useMemo(() => services.find(s => s.id === formData.serviceId), [formData.serviceId, services]);
  
  const travelFee = useMemo(() => {
    if (formData.distance <= 0) return 0;
    return formData.distance * settings.travelFeePerKm;
  }, [formData.distance, settings.travelFeePerKm]);

  const total = useMemo(() => {
    return (selectedService?.price || 0) + travelFee;
  }, [selectedService, travelFee]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
    } else {
      try {
        const bookingData: Booking = {
          userId: user?.uid,
          serviceId: formData.serviceId,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          location: formData.location,
          date: formData.date,
          carInfo: formData.carInfo,
          distance: formData.distance,
          travelFee: travelFee,
          total: total,
          status: 'pending',
          createdAt: Timestamp.now()
        };
        await addDoc(collection(db, 'bookings'), bookingData);
        
        // Notify Admin via Email
        const serviceName = services.find(s => s.id === formData.serviceId)?.name || 'Detailing Service';
        fetch('/api/notify-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            booking: { ...bookingData, serviceName },
            adminEmail: settings.adminEmail 
          })
        })
        .then(async res => {
          const data = await res.json();
          if (!res.ok) {
            console.error("Admin notification failed", data);
            toast.error("Admin Alert Failed", { description: "You might need to verify your domain in Resend." });
          }
        })
        .catch(err => console.error("Admin notification network error", err));

        toast.success("Booking Request Sent!", {
          description: "Your booking will be confirmed shortly! Check your email for updates.",
          duration: 5000,
        });
        
        onClose();
        setStep(1);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'bookings');
        toast.error("Failed to submit booking request.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-brand-black/60 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="relative bg-brand-white w-full max-w-xl overflow-hidden shadow-2xl">
        <button onClick={onClose} className="absolute top-6 right-6 z-10 opacity-40 hover:opacity-100"><X className="w-5 h-5" /></button>
        <div className="p-8 md:p-12">
          <div className="mb-8">
            <p className="font-condensed text-[10px] tracking-[0.2em] uppercase text-brand-grey mb-2">Step {step} of 3</p>
            <h2 className="text-3xl">{step === 1 ? "Choose service" : step === 2 ? "Where & When" : "Contact Details"}</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <div className="space-y-3">
                {services.map(s => (
                  <label key={s.id} className={`flex items-center justify-between p-4 border cursor-pointer transition-all ${formData.serviceId === s.id ? 'border-brand-black bg-zinc-50' : 'border-brand-light-grey hover:border-brand-grey'}`}>
                    <div className="flex items-center gap-4">
                      <input type="radio" name="service" required className="sr-only" checked={formData.serviceId === s.id} onChange={() => setFormData({...formData, serviceId: s.id})} />
                      <div className="p-2 bg-brand-black text-brand-white"><Car className="w-4 h-4" /></div>
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-[10px] uppercase tracking-wider text-brand-grey">${s.price}+</p>
                      </div>
                    </div>
                    {formData.serviceId === s.id && <CheckCircle2 className="w-5 h-5 text-brand-black" />}
                  </label>
                ))}
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-brand-grey mb-1.5">Location (Sussex Area)</label>
                  <input type="text" required placeholder="Street address" className="w-full border-b border-brand-light-grey py-3 focus:border-brand-black outline-none" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-brand-grey mb-1.5">Distance from Sussex (km)</label>
                  <input type="number" required min="0" max={settings.maxDistance} className="w-full border-b border-brand-light-grey py-3 focus:border-brand-black outline-none" value={formData.distance} onChange={e => setFormData({...formData, distance: Number(e.target.value)})} />
                  <p className="text-[10px] text-brand-grey mt-1">Travel fee: ${travelFee.toFixed(2)} (Free within Sussex)</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-brand-grey mb-1.5">Date</label>
                    <input type="date" required min={format(new Date(), 'yyyy-MM-dd')} className="w-full border-b border-brand-light-grey py-3 focus:border-brand-black outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-brand-grey mb-1.5">Car Info</label>
                    <input type="text" required placeholder="Make/Model" className="w-full border-b border-brand-light-grey py-3 focus:border-brand-black outline-none" value={formData.carInfo} onChange={e => setFormData({...formData, carInfo: e.target.value})} />
                  </div>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-4">
                <input type="text" required placeholder="Full Name" className="w-full border-b border-brand-light-grey py-3 focus:border-brand-black outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                <input type="email" required placeholder="Email Address" className="w-full border-b border-brand-light-grey py-3 focus:border-brand-black outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                <input type="tel" required placeholder="Phone Number" className="w-full border-b border-brand-light-grey py-3 focus:border-brand-black outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                <div className="bg-zinc-50 p-4 border border-brand-light-grey">
                  <div className="flex justify-between text-sm mb-2"><span>{selectedService?.name}</span><span>${selectedService?.price}</span></div>
                  <div className="flex justify-between text-sm mb-2"><span>Travel Fee ({formData.distance}km)</span><span>${travelFee.toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold border-t border-brand-light-grey pt-2"><span>Total</span><span>${total.toFixed(2)}</span></div>
                </div>
              </div>
            )}
            <div className="pt-6 flex justify-between items-center">
              {step > 1 ? <button type="button" onClick={() => setStep(step - 1)} className="text-[10px] uppercase tracking-widest font-semibold">Back</button> : <div />}
              <button type="submit" className="btn-primary">{step === 3 ? "Confirm" : "Continue"}</button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

const UserDashboard = ({ user, onClose, services }: { user: FirebaseUser, onClose: () => void, services: Service[] }) => {
  const [activeTab, setActiveTab] = useState<'bookings' | 'profile'>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'bookings'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubBookings = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
      setLoading(false);
    }, (err) => {
      console.error("Dashboard error:", err);
      setLoading(false);
    });

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      }
    });

    return () => { unsubBookings(); unsubProfile(); };
  }, [user.uid]);

  const handleCancelBooking = async (id: string) => {
    if (confirm("Are you sure you want to cancel this booking?")) {
      try {
        await updateDoc(doc(db, 'bookings', id), { status: 'cancelled' });
        toast.info("Booking Cancelled", {
          description: "Your appointment has been successfully cancelled."
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `bookings/${id}`);
        toast.error("Failed to cancel booking.");
      }
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        phone: profile.phone || '',
        defaultCarInfo: profile.defaultCarInfo || ''
      });
      toast.success("Profile Updated", {
        description: "Your contact and vehicle information has been saved."
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      toast.error("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const activeBookings = bookings.filter(b => b.status === 'pending' || b.status === 'confirmed');
  const pastBookings = bookings.filter(b => b.status === 'completed' || b.status === 'cancelled');

  return (
    <div className="fixed inset-0 z-[100] bg-brand-white flex flex-col">
      <header className="p-6 border-b border-brand-light-grey flex justify-between items-center bg-brand-white">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-serif">My Dashboard</h2>
          <span className="text-[10px] uppercase tracking-widest text-brand-grey">{user.email}</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => signOut(auth)} className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 hover:text-red-500 transition-colors">
            <LogOut className="w-3 h-3" /> Sign Out
          </button>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-brand-light-grey p-6 space-y-2 hidden md:block">
          <button onClick={() => setActiveTab('bookings')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'bookings' ? 'bg-brand-black text-brand-white' : 'hover:bg-zinc-100'}`}>
            <CalendarIcon className="w-4 h-4" /> My Bookings
          </button>
          <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-brand-black text-brand-white' : 'hover:bg-zinc-100'}`}>
            <Car className="w-4 h-4" /> My Profile
          </button>
        </aside>

        <div className="md:hidden border-b border-brand-light-grey flex">
          <button onClick={() => setActiveTab('bookings')} className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold ${activeTab === 'bookings' ? 'bg-brand-black text-brand-white' : ''}`}>Bookings</button>
          <button onClick={() => setActiveTab('profile')} className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold ${activeTab === 'profile' ? 'bg-brand-black text-brand-white' : ''}`}>Profile</button>
        </div>

        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          {activeTab === 'bookings' && (
            <div className="max-w-4xl">
              <div className="mb-12">
                <h3 className="text-3xl mb-2">Welcome back, {user.displayName?.split(' ')[0]}</h3>
                <p className="text-brand-grey text-sm">Manage your detailing appointments and car care history.</p>
              </div>

              <div className="space-y-12">
                <section>
                  <h4 className="font-condensed text-[11px] tracking-[0.22em] uppercase text-brand-grey mb-6">Active Bookings</h4>
                  {loading ? (
                    <div className="py-10 text-brand-grey">Loading...</div>
                  ) : activeBookings.length === 0 ? (
                    <div className="py-10 text-center border border-dashed border-brand-light-grey">
                      <p className="text-brand-grey text-sm">No active bookings.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeBookings.map(b => (
                        <BookingCard key={b.id} booking={b} services={services} onCancel={handleCancelBooking} />
                      ))}
                    </div>
                  )}
                </section>

                {pastBookings.length > 0 && (
                  <section>
                    <h4 className="font-condensed text-[11px] tracking-[0.22em] uppercase text-brand-grey mb-6">Booking History</h4>
                    <div className="space-y-4 opacity-70">
                      {pastBookings.map(b => (
                        <BookingCard key={b.id} booking={b} services={services} />
                      ))}
                    </div>
                  </section>
                )}

                <section className="bg-zinc-50 p-8 border border-brand-light-grey">
                  <h4 className="font-condensed text-[11px] tracking-[0.22em] uppercase text-brand-grey mb-4">Need Help?</h4>
                  <p className="text-sm text-zinc-600 mb-6">If you need to reschedule or have questions about your service, please contact us directly.</p>
                  <div className="flex flex-wrap gap-6">
                    <a href="tel:5065550123" className="flex items-center gap-2 text-sm font-medium"><Phone className="w-4 h-4" /> (506) 555-0123</a>
                    <a href="mailto:hello@purerun.ca" className="flex items-center gap-2 text-sm font-medium"><Mail className="w-4 h-4" /> hello@purerun.ca</a>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'profile' && profile && (
            <div className="max-w-md">
              <h3 className="text-3xl mb-8">My Profile</h3>
              <form onSubmit={handleUpdateProfile} className="space-y-8">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-brand-grey mb-1.5">Email Address</label>
                  <input type="email" disabled className="w-full border-b border-brand-light-grey py-3 outline-none opacity-50 cursor-not-allowed" value={profile.email} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-brand-grey mb-1.5">Phone Number</label>
                  <input 
                    type="tel" 
                    placeholder="(506) 000-0000"
                    className="w-full border-b border-brand-light-grey py-3 focus:border-brand-black outline-none" 
                    value={profile.phone || ''} 
                    onChange={e => setProfile({...profile, phone: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-brand-grey mb-1.5">Default Vehicle Info</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 2022 Honda Civic (Black)"
                    className="w-full border-b border-brand-light-grey py-3 focus:border-brand-black outline-none" 
                    value={profile.defaultCarInfo || ''} 
                    onChange={e => setProfile({...profile, defaultCarInfo: e.target.value})} 
                  />
                  <p className="text-[10px] text-brand-grey mt-2">This will be pre-filled when you book a new service.</p>
                </div>
                <button type="submit" disabled={isSaving} className="btn-primary w-full flex items-center justify-center gap-2">
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const BookingCard = ({ booking, services, onCancel }: { booking: Booking, services: Service[], onCancel?: (id: string) => void, key?: string }) => {
  return (
    <div className="border border-brand-light-grey p-6 hover:border-brand-grey transition-colors">
      <div className="flex flex-col md:flex-row justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className={`px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold ${
              booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
              booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : 
              booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
              'bg-zinc-100 text-zinc-500'
            }`}>
              {booking.status}
            </span>
            <span className="text-xs text-brand-grey">{booking.createdAt ? format(booking.createdAt.toDate(), 'MMM d, yyyy') : 'Recently'}</span>
          </div>
          <h5 className="text-xl font-medium mb-1">{services.find(s => s.id === booking.serviceId)?.name || 'Detailing Service'}</h5>
          <p className="text-sm text-zinc-500 mb-4">{booking.carInfo} • {booking.location}</p>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-brand-grey" /> {booking.date}</div>
            <div className="font-bold">${booking.total.toFixed(2)}</div>
          </div>
        </div>
        <div className="flex items-end">
          {booking.status === 'pending' && onCancel && (
            <button 
              onClick={() => onCancel(booking.id!)}
              className="text-[10px] uppercase tracking-widest font-bold text-red-500 hover:underline"
            >
              Cancel Booking
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = ({ user, onClose, services, setServices, settings, setSettings }: { user: FirebaseUser, onClose: () => void, services: Service[], setServices: any, settings: GlobalSettings, setSettings: any }) => {
  const [activeTab, setActiveTab] = useState<'bookings' | 'services' | 'calendar' | 'settings'>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [systemStatus, setSystemStatus] = useState<{ emailConfigured: boolean, adminEmail: string, isDevelopment: boolean } | null>(null);
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => setSystemStatus(data))
      .catch(err => console.error("Failed to fetch system status", err));
  }, []);

  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    try {
      const res = await fetch('/api/test-email', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success("Test Email Sent!", { description: `Check ${systemStatus?.adminEmail}` });
      } else {
        toast.error("Test Failed", { description: data.details || "Check Resend dashboard" });
      }
    } catch (err) {
      toast.error("Network Error", { description: "Could not reach email service" });
    } finally {
      setIsTestingEmail(false);
    }
  };

  useEffect(() => {
    const unsubBookings = onSnapshot(query(collection(db, 'bookings'), orderBy('createdAt', 'desc')), (snap) => {
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'bookings'));

    const unsubAvail = onSnapshot(collection(db, 'availability'), (snap) => {
      setAvailability(snap.docs.map(d => d.data() as Availability));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'availability'));

    return () => { unsubBookings(); unsubAvail(); };
  }, []);

  const handleUpdateBookingStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'bookings', id), { status });
      toast.success(`Booking ${status}`, {
        description: `The booking status has been updated to ${status}.`
      });

      if (status === 'confirmed') {
        const booking = bookings.find(b => b.id === id);
        if (booking) {
          const serviceName = services.find(s => s.id === booking.serviceId)?.name || 'Detailing Service';
          fetch('/api/notify-customer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ booking: { ...booking, serviceName } })
          })
          .then(async res => {
            const data = await res.json();
            if (!res.ok) {
              console.error("Customer notification failed", data);
              toast.error("Email Not Sent", { description: data.details || "Check Resend restrictions" });
            } else if (data.status === 'skipped') {
              toast.info("Email Skipped", { description: "Resend API Key missing" });
            }
          })
          .catch(err => console.error("Customer notification network error", err));
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${id}`);
      toast.error("Failed to update booking status.");
    }
  };

  const handleToggleSlot = async (date: string, slot: string) => {
    const dayAvail = availability.find(a => a.date === date) || { date, slots: [] };
    const newSlots = dayAvail.slots.includes(slot) 
      ? dayAvail.slots.filter(s => s !== slot) 
      : [...dayAvail.slots, slot];
    
    try {
      await setDoc(doc(db, 'availability', date), { date, slots: newSlots });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `availability/${date}`);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'settings', 'global'), settings);
      toast.success("Settings Saved", {
        description: "Business settings have been updated successfully."
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/global');
      toast.error("Failed to save settings.");
    }
  };

  const handleAddService = async () => {
    const name = prompt("Service Name");
    const price = Number(prompt("Base Price"));
    const tagline = prompt("Tagline (optional)") || "";
    const description = prompt("Description (optional)") || "";
    if (name && price) {
      try {
        const newService = { name, price, tagline, description, icon: 'Car' };
        await addDoc(collection(db, 'services'), newService);
        toast.success("Service Added", {
          description: `${name} has been added to the service list.`
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'services');
        toast.error("Failed to add service.");
      }
    }
  };

  const handleEditService = async (service: Service) => {
    const name = prompt("Service Name", service.name);
    const price = Number(prompt("Base Price", service.price.toString()));
    const tagline = prompt("Tagline", service.tagline);
    const description = prompt("Description", service.description);
    
    if (name && price) {
      try {
        await updateDoc(doc(db, 'services', service.id), { name, price, tagline, description });
        toast.success("Service Updated", {
          description: `${name} has been updated.`
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `services/${service.id}`);
        toast.error("Failed to update service.");
      }
    }
  };

  const handleDeleteService = async (id: string) => {
    if (confirm("Delete this service?")) {
      try {
        await deleteDoc(doc(db, 'services', id));
        toast.info("Service Deleted");
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `services/${id}`);
        toast.error("Failed to delete service.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-brand-white flex flex-col">
      <header className="p-6 border-b border-brand-light-grey flex justify-between items-center bg-brand-white">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-serif">Admin Dashboard</h2>
          <span className="text-[10px] uppercase tracking-widest text-brand-grey">{user.email}</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => signOut(auth)} className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 hover:text-red-500 transition-colors">
            <LogOut className="w-3 h-3" /> Sign Out
          </button>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-brand-light-grey p-6 flex flex-col justify-between hidden md:flex">
          <div className="space-y-2">
            {[
              { id: 'bookings', label: 'Bookings', icon: <CalendarIcon className="w-4 h-4" /> },
              { id: 'services', label: 'Services', icon: <Car className="w-4 h-4" /> },
              { id: 'calendar', label: 'Availability', icon: <Clock className="w-4 h-4" /> },
              { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-4 h-4" /> }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-brand-black text-brand-white' : 'hover:bg-zinc-100'}`}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {systemStatus && (
            <div className="p-4 bg-zinc-50 border border-brand-light-grey rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${systemStatus.emailConfigured ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-[10px] uppercase tracking-widest font-bold">Email Service</span>
                </div>
                {systemStatus.emailConfigured && (
                  <button 
                    onClick={handleTestEmail} 
                    disabled={isTestingEmail}
                    className="text-[8px] uppercase tracking-widest font-bold hover:underline disabled:opacity-50"
                  >
                    {isTestingEmail ? 'Sending...' : 'Test'}
                  </button>
                )}
              </div>
              <div className="text-[10px] text-brand-grey leading-tight">
                <p className="mb-1">Admin: {systemStatus.adminEmail}</p>
                <p>{systemStatus.emailConfigured ? '✓ API Key Active' : '✗ API Key Missing'}</p>
              </div>
            </div>
          )}
        </aside>

        <div className="md:hidden border-b border-brand-light-grey flex overflow-x-auto no-scrollbar">
          {[
            { id: 'bookings', label: 'Bookings', icon: <CalendarIcon className="w-4 h-4" /> },
            { id: 'services', label: 'Services', icon: <Car className="w-4 h-4" /> },
            { id: 'calendar', label: 'Availability', icon: <Clock className="w-4 h-4" /> },
            { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-4 h-4" /> }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 flex flex-col items-center gap-1 px-4 py-3 text-[9px] uppercase tracking-widest font-bold transition-colors ${activeTab === tab.id ? 'bg-brand-black text-brand-white' : 'hover:bg-zinc-100'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          {activeTab === 'bookings' && (
            <div className="space-y-6">
              <h3 className="text-xl mb-6">Recent Bookings</h3>
              <div className="space-y-4">
                {bookings.map(b => (
                  <div key={b.id} className="border border-brand-light-grey p-6 flex flex-col md:flex-row justify-between gap-6 hover:border-brand-grey transition-colors">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold ${b.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : b.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                          {b.status}
                        </span>
                        <span className="text-xs text-brand-grey">{format(b.createdAt.toDate(), 'MMM d, h:mm a')}</span>
                      </div>
                      <h4 className="text-lg font-medium">{b.name} — {b.carInfo}</h4>
                      <p className="text-sm text-zinc-500">{b.location} ({b.distance}km)</p>
                      <p className="text-sm font-medium mt-2">{services.find(s => s.id === b.serviceId)?.name} — ${b.total.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={b.status} onChange={(e) => handleUpdateBookingStatus(b.id!, e.target.value)} className="text-xs border border-brand-light-grey p-2 outline-none">
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'services' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl">Manage Services</h3>
                <button onClick={handleAddService} className="btn-primary flex items-center gap-2 py-2 px-4"><Plus className="w-4 h-4" /> Add New</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {services.map(s => (
                  <div key={s.id} className="border border-brand-light-grey p-6 flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-medium">{s.name}</h4>
                      <p className="text-sm text-zinc-500">${s.price}</p>
                      {s.tagline && <p className="text-[10px] uppercase tracking-wider text-brand-grey mt-1">{s.tagline}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEditService(s)} className="p-2 text-brand-grey hover:bg-zinc-100 rounded-full"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteService(s.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="space-y-6">
              <h3 className="text-xl mb-6">Weekly Availability</h3>
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                {Array.from({ length: 14 }).map((_, i) => {
                  const date = addDays(startOfToday(), i);
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const dayAvail = availability.find(a => a.date === dateStr);
                  return (
                    <div key={dateStr} className="border border-brand-light-grey p-4 text-center">
                      <p className="text-[10px] uppercase tracking-widest text-brand-grey mb-1">{format(date, 'EEE')}</p>
                      <p className="font-bold mb-4">{format(date, 'MMM d')}</p>
                      <div className="space-y-2">
                        {['Morning', 'Afternoon', 'Evening'].map(slot => (
                          <button 
                            key={slot} 
                            onClick={() => handleToggleSlot(dateStr, slot)}
                            className={`w-full py-2 text-[9px] uppercase tracking-widest font-bold border ${dayAvail?.slots.includes(slot) ? 'bg-brand-black text-brand-white border-brand-black' : 'text-brand-grey border-brand-light-grey hover:border-brand-grey'}`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-md space-y-8">
              <h3 className="text-xl">Business Settings</h3>
              <form onSubmit={handleUpdateSettings} className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-brand-grey mb-1.5">Base Location</label>
                  <input type="text" className="w-full border-b border-brand-light-grey py-3 outline-none" value={settings.baseLocation || ''} onChange={e => setSettings({...settings, baseLocation: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-brand-grey mb-1.5">Travel Fee per KM ($)</label>
                  <input type="number" step="0.01" className="w-full border-b border-brand-light-grey py-3 outline-none" value={settings.travelFeePerKm || 0} onChange={e => setSettings({...settings, travelFeePerKm: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-brand-grey mb-1.5">Max Travel Radius (KM)</label>
                  <input type="number" className="w-full border-b border-brand-light-grey py-3 outline-none" value={settings.maxDistance || 0} onChange={e => setSettings({...settings, maxDistance: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-brand-grey mb-1.5">Admin Notification Email</label>
                  <input type="email" className="w-full border-b border-brand-light-grey py-3 outline-none" value={settings.adminEmail || ''} onChange={e => setSettings({...settings, adminEmail: e.target.value})} />
                  <p className="text-[10px] text-brand-grey mt-1">This email will receive all new booking alerts.</p>
                </div>
                <button type="submit" className="btn-primary w-full">Save Settings</button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const ADMIN_EMAILS = ["admin@wiliodaeze.resend.app", "delawalaubaid@gmail.com"];

// --- Main App ---

function MainApp() {
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isUserDashboardOpen, setIsUserDashboardOpen] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [services, setServices] = useState<Service[]>(DEFAULT_SERVICES);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const isAdmin = useMemo(() => {
    if (!user || !user.emailVerified) return false;
    return ADMIN_EMAILS.includes(user.email || '') || userProfile?.role === 'admin';
  }, [user, userProfile]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setIsAuthReady(true);
      
      if (u) {
        // Ensure user profile exists
        const userRef = doc(db, 'users', u.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          const role = ADMIN_EMAILS.includes(u.email || '') ? 'admin' : 'user';
          const newProfile: UserProfile = {
            email: u.email!,
            role: role
          };
          await setDoc(userRef, newProfile);
          setUserProfile(newProfile);
        } else {
          setUserProfile(userSnap.data() as UserProfile);
        }
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;

    const unsubServices = onSnapshot(collection(db, 'services'), (snap) => {
      if (snap.empty && isAdmin) {
        // Seed initial services if empty - only if admin
        DEFAULT_SERVICES.forEach(s => {
          setDoc(doc(db, 'services', s.id), s).catch(err => {
            console.error("Failed to seed services", err);
          });
        });
      } else if (!snap.empty) {
        setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'services'));

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as GlobalSettings);
      } else if (isAdmin) {
        // Seed initial settings if missing - only if admin
        setDoc(doc(db, 'settings', 'global'), DEFAULT_SETTINGS).catch(err => {
          console.error("Failed to seed settings", err);
        });
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/global'));

    // Listen to profile changes if logged in
    let unsubProfile: (() => void) | undefined;
    if (user) {
      unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        }
      });
    }

    // Connection test
    const testConnection = async () => {
      try { await getDocFromServer(doc(db, 'test', 'connection')); } catch (e) {}
    };
    testConnection();

    return () => { 
      unsubServices(); 
      unsubSettings(); 
      if (unsubProfile) unsubProfile();
    };
  }, [isAuthReady, user]);

  const handleDashboardClick = async () => {
    if (user) {
      if (isAdmin) {
        setIsAdminOpen(true);
      } else {
        setIsUserDashboardOpen(true);
      }
    } else {
      try {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        if (ADMIN_EMAILS.includes(result.user.email || '')) {
          setIsAdminOpen(true);
        } else {
          setIsUserDashboardOpen(true);
        }
      } catch (err) {
        console.error("Login failed", err);
      }
    }
  };

  return (
    <div className="min-h-screen selection:bg-brand-black selection:text-brand-white">
      <Navbar onBookClick={() => setIsBookingOpen(true)} onDashboardClick={handleDashboardClick} user={user} />
      <BookingModal 
        isOpen={isBookingOpen} 
        onClose={() => setIsBookingOpen(false)} 
        services={services} 
        settings={settings} 
        user={user} 
        profile={userProfile}
      />
      
      {isAdminOpen && user && isAdmin && (
        <AdminDashboard 
          user={user} 
          onClose={() => setIsAdminOpen(false)} 
          services={services} 
          setServices={setServices}
          settings={settings}
          setSettings={setSettings}
        />
      )}

      {isUserDashboardOpen && user && (
        <UserDashboard 
          user={user} 
          onClose={() => setIsUserDashboardOpen(false)} 
          services={services} 
        />
      )}

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col md:flex-row pt-20">
        <div className="flex-1 flex flex-col justify-center px-6 md:px-20 py-20">
          <div className="animate-fade-up">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-[1px] bg-brand-grey" />
              <p className="font-condensed text-[11px] tracking-[0.22em] uppercase text-brand-grey">Sussex, NB & Beyond</p>
            </div>
            <h1 className="text-7xl md:text-[100px] leading-[0.9] mb-10">
              Detail,<br />
              <span className="italic">delivered</span><br />
              to you.
            </h1>
            <p className="text-lg text-zinc-600 max-w-sm mb-12 leading-relaxed">
              Serving Sussex and surrounding areas within 100km. Professional detailing at your preferred location.
            </p>
            <div className="flex flex-wrap items-center gap-8">
              <button onClick={() => setIsBookingOpen(true)} className="btn-primary">Book a Detail</button>
              <a href="#services" className="btn-ghost">See Services</a>
            </div>
          </div>
        </div>
        <div className="flex-1 bg-brand-black relative overflow-hidden flex items-center justify-center min-h-[400px]">
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="400" cy="300" r="250" stroke="white" strokeWidth="0.5" /><circle cx="400" cy="300" r="180" stroke="white" strokeWidth="0.5" /><circle cx="400" cy="300" r="100" stroke="white" strokeWidth="0.5" />
              <path d="M0 300 H800" stroke="white" strokeWidth="0.5" /><path d="M400 0 V600" stroke="white" strokeWidth="0.5" />
            </svg>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.5 }} className="text-center relative z-10">
            <span className="block font-serif text-7xl md:text-9xl text-brand-white mb-4">PureRun</span>
            <span className="block font-condensed text-xs tracking-[0.3em] uppercase text-brand-white/40">Mobile Detail Co.</span>
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-32 px-6 md:px-20 bg-brand-black text-brand-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-16">
            <p className="font-condensed text-[11px] tracking-[0.22em] uppercase text-white/30">Our Services</p>
            <div className="w-12 h-[1px] bg-white/10" />
          </div>
          <h2 className="text-4xl md:text-6xl mb-24 max-w-2xl leading-tight">Professional care for <span className="italic">every vehicle.</span></h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 border border-white/10">
            {services.map((service) => (
              <div key={service.id} className="bg-brand-black p-12 flex flex-col hover:bg-zinc-900/50 transition-colors group">
                <div className="mb-10 text-white/60 group-hover:text-white transition-colors"><Car className="w-6 h-6" /></div>
                <h3 className="text-3xl mb-4">{service.name}</h3>
                <p className="font-condensed text-[10px] tracking-[0.2em] uppercase text-white/30 mb-6">{service.tagline}</p>
                <p className="text-sm text-white/50 leading-relaxed mb-10 flex-grow">{service.description}</p>
                <div className="mt-auto">
                  <p className="font-condensed text-xs tracking-widest text-white/40 uppercase mb-2">Starting at</p>
                  <p className="text-4xl font-serif">${service.price}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-32 px-6 md:px-20 border-t border-brand-light-grey">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-16">
            <p className="font-condensed text-[11px] tracking-[0.22em] uppercase text-brand-grey">Process</p>
            <div className="w-12 h-[1px] bg-brand-light-grey" />
          </div>
          <div className="grid md:grid-cols-4 gap-12">
            {[
              { num: '01', title: 'Book Online', desc: 'Choose your service and pick a time that works for you.' },
              { num: '02', title: 'We Come to You', desc: 'Serving Sussex and surrounding areas within 100km.' },
              { num: '03', title: 'We Get to Work', desc: 'Professional detailing while you carry on with your day.' },
              { num: '04', title: 'Drive in Style', desc: 'Inspect the work and enjoy your spotless vehicle.' }
            ].map((step, i) => (
              <div key={i} className="group">
                <span className="block font-serif text-8xl text-brand-light-grey mb-6 group-hover:text-brand-black transition-colors duration-500">{step.num}</span>
                <h3 className="font-condensed text-sm font-bold tracking-widest uppercase mb-4">{step.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 px-6 bg-brand-black text-brand-white text-center relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
          <span className="font-serif text-[300px] leading-none">Detail</span>
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <p className="font-condensed text-[11px] tracking-[0.22em] uppercase text-white/30 mb-8">Ready to book?</p>
          <h2 className="text-5xl md:text-8xl mb-12 leading-[1.1]">Your car deserves<br /><span className="italic">better than a drive-through.</span></h2>
          <button onClick={() => setIsBookingOpen(true)} className="bg-brand-white text-brand-black font-condensed font-bold text-xs tracking-[0.2em] uppercase px-12 py-5 hover:bg-zinc-200 transition-colors">Book Your Detail</button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 md:px-20 border-t border-brand-light-grey">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="font-condensed font-bold text-lg tracking-[0.12em] uppercase">PureRun</div>
          <div className="flex gap-8">
            <a href="#" className="text-brand-grey hover:text-brand-black transition-colors"><Instagram className="w-5 h-5" /></a>
            <a href="#" className="text-brand-grey hover:text-brand-black transition-colors"><Mail className="w-5 h-5" /></a>
            <a href="#" className="text-brand-grey hover:text-brand-black transition-colors"><Phone className="w-5 h-5" /></a>
          </div>
          <p className="text-[11px] text-brand-grey tracking-wider">© 2026 PureRun Detail Co. — Sussex, NB</p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
      <Toaster position="bottom-right" richColors />
    </ErrorBoundary>
  );
}
