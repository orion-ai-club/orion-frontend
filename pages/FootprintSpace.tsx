import React, { useState, useEffect, useRef } from 'react';

import L from 'leaflet';
import { useTranslation } from '../i18n/LanguageContext';
import { apiService } from '../services/api';
import { Footprint, FootprintStats, Theme } from '../types';
import { toast } from '../components/Toast';
import { createPortal } from 'react-dom';
import { FootprintMap, PROVINCES_CN } from '../components/footprint/FootprintMap';

// Common Countries List
const COUNTRIES_LIST = [
  'United States',
  'United Kingdom',
  'Japan',
  'South Korea',
  'France',
  'Germany',
  'Italy',
  'Spain',
  'Australia',
  'Canada',
  'Singapore',
  'Thailand',
  'Vietnam',
  'Malaysia',
  'Indonesia',
  'India',
  'Russia',
  'Brazil',
  'Argentina',
  'Mexico',
  'Egypt',
  'South Africa',
  'Turkey',
  'United Arab Emirates',
  'Saudi Arabia',
  'Netherlands',
  'Switzerland',
  'Sweden',
  'Norway',
  'Finland',
  'Denmark',
  'New Zealand',
  'Philippines',
  'Austria',
  'Belgium',
  'Portugal',
  'Greece',
  'Ireland',
  'Poland',
  'Czech Republic',
  'Hungary',
  'Iceland'
];

interface FootprintSpaceProps {
  theme?: Theme;
}

export const FootprintSpace: React.FC<FootprintSpaceProps> = ({ theme }) => {
  const { t, language } = useTranslation();
  const [viewMode, setViewMode] = useState<'CHINA' | 'WORLD'>('CHINA');
  const [footprints, setFootprints] = useState<Footprint[]>([]);
  const [stats, setStats] = useState<FootprintStats>({
    totalCount: 0,
    countries: [],
    provinces: [],
    citiesCount: 0
  });
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  // Separate scope state for the Modal Form: 'CHINA' means Domestic input, 'GLOBAL' means International input
  const [formScope, setFormScope] = useState<'CHINA' | 'GLOBAL'>('CHINA');

  const [currentFootprint, setCurrentFootprint] = useState<Partial<Footprint>>({
    status: 'visited',
    visitDate: new Date().toISOString().split('T')[0],
    mood: 'happy',
    location: { name: '', coordinates: [116.4, 39.9] } // Default Beijing
  });
  const [isUploading, setIsUploading] = useState(false);

  const pickerMapRef = useRef<L.Map | null>(null); // For Picker Map
  const pickerContainerRef = useRef<HTMLDivElement>(null); // For Picker Div

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Data Fetching ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const { stats: s, data: d } = await apiService.getFootprints();
      setStats(s);
      setFootprints(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Tile Layer Selection ---
  // Fast and Beautiful CartoDB Tiles
  const getTileLayer = () => {
    const isDark = theme === Theme.DARK;
    return isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  };

  // --- Add/Edit Modal Logic ---
  const handleOpenAdd = () => {
    // Default form scope matches current view mode
    const initialScope = viewMode === 'CHINA' ? 'CHINA' : 'GLOBAL';
    setFormScope(initialScope);

    setCurrentFootprint({
      status: 'visited',
      visitDate: new Date().toISOString().split('T')[0],
      mood: 'happy',
      location: {
        name: '',
        coordinates: initialScope === 'CHINA' ? [116.4, 39.9] : [0, 20],
        country: initialScope === 'CHINA' ? 'China' : '',
        province: '',
        city: ''
      }
    });
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (fp: Footprint) => {
    setCurrentFootprint(fp);

    // Determine scope based on country data
    const isChina = fp.location?.country === '中国' || fp.location?.country === 'China';
    setFormScope(isChina ? 'CHINA' : 'GLOBAL');

    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFootprint.location?.name) return;

    // Enforce country based on Scope
    const finalFootprint = { ...currentFootprint };
    if (formScope === 'CHINA') {
      if (finalFootprint.location) finalFootprint.location.country = 'China';
    }
    // If Global, country is selected in form

    try {
      if (isEditMode && currentFootprint._id) {
        await apiService.updateFootprint(currentFootprint._id, finalFootprint);
      } else {
        await apiService.createFootprint(finalFootprint);
      }
      setIsModalOpen(false);
      fetchData();
      toast.success('Footprint saved!');
    } catch (e) {
      toast.error('Failed to save.');
    }
  };

  const handlePickerMapInit = () => {
    if (pickerContainerRef.current) {
      if (pickerMapRef.current) {
        pickerMapRef.current.remove();
        pickerMapRef.current = null;
      }

      const coords = currentFootprint.location?.coordinates || [116.4, 39.9];
      // Adjust zoom based on scope
      const zoom = formScope === 'CHINA' ? 4 : 2;
      const map = L.map(pickerContainerRef.current).setView([coords[1], coords[0]], zoom);
      pickerMapRef.current = map;

      L.tileLayer(getTileLayer()).addTo(map);

      let marker = L.marker([coords[1], coords[0]]).addTo(map);

      // Force resize to fix layout issues in modal
      setTimeout(() => {
        map.invalidateSize();
      }, 200);

      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        if (marker) marker.setLatLng(e.latlng);
        else marker = L.marker(e.latlng).addTo(map);

        setCurrentFootprint((prev) => ({
          ...prev,
          location: {
            ...prev.location!,
            coordinates: [lng, lat]
          }
        }));
      });
    }
  };

  // Re-init picker map when modal opens or theme/scope changes
  useEffect(() => {
    if (isModalOpen) {
      setTimeout(handlePickerMapInit, 200);
    }
    return () => {
      if (pickerMapRef.current) {
        pickerMapRef.current.remove();
        pickerMapRef.current = null;
      }
    };
  }, [isModalOpen, theme, formScope]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await apiService.uploadImage(file, { folder: 'footprints' });
      setCurrentFootprint((prev) => ({
        ...prev,
        images: [...(prev.images || []), url]
      }));
    } catch (e) {
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-24 pt-32 max-w-7xl relative z-10 min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6">
        <div>
          <h1 className="text-4xl font-display font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
            <i className="fas fa-globe-asia text-primary-500"></i> {t.footprint.title}
          </h1>
          <p className="text-slate-600 dark:text-slate-300 font-medium text-lg mb-1">
            {t.footprint.intro}
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t.footprint.subtitle}</p>
        </div>

        <div className="flex gap-4">
          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex">
            <button
              onClick={() => setViewMode('CHINA')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'CHINA' ? 'bg-primary-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
            >
              {t.footprint.tabs.china}
            </button>
            <button
              onClick={() => setViewMode('WORLD')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'WORLD' ? 'bg-primary-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
            >
              {t.footprint.tabs.world}
            </button>
          </div>

          <button
            onClick={handleOpenAdd}
            className="w-12 h-12 rounded-xl bg-primary-500 flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform"
          >
            <i className="fas fa-plus"></i>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">
            {t.footprint.stats.total}
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white">
            {stats.totalCount}
          </div>
        </div>
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">
            {t.footprint.stats.countries}
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white">
            {stats.countries.length}
          </div>
        </div>
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">
            {t.footprint.stats.provinces}
          </div>
          <div className="text-2xl font-bold text-primary-500">{stats.provinces.length}</div>
        </div>
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">
            {t.footprint.stats.cities}
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white">
            {stats.citiesCount}
          </div>
        </div>
      </div>

      {/* Map Container - EXPANDED SIZE to fill space */}
      <div className="w-full h-[80vh] bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden">
        <FootprintMap
          mode={viewMode}
          stats={stats}
          footprints={footprints}
          theme={theme}
          language={language}
        />

        {loading && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <i className="fas fa-satellite fa-spin text-4xl text-primary-500 mb-4"></i>
            <p className="text-primary-100 font-mono animate-pulse">Establishing uplink...</p>
          </div>
        )}
      </div>

      {/* List of Recent Footprints (Below Map) */}
      <div className="mt-12">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
          Recent Transmission Logs
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {footprints.map((fp) => (
            <div
              key={fp._id}
              onClick={() => handleEdit(fp)}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${fp.status === 'visited' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                  ></span>
                  <span className="text-xs font-bold uppercase text-slate-500">{fp.status}</span>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {new Date(fp.visitDate).toLocaleDateString()}
                </span>
              </div>

              <h4 className="font-bold text-lg text-slate-800 dark:text-white mb-1 group-hover:text-primary-500 transition-colors">
                {fp.location.name}
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                {fp.location.country === 'China' ? fp.location.province : fp.location.country}
                {fp.location.city ? ` · ${fp.location.city}` : ''}
              </p>

              {fp.images && fp.images.length > 0 && (
                <div className="h-32 rounded-xl overflow-hidden mb-3 bg-slate-100 dark:bg-slate-800">
                  <img
                    src={fp.images[0]}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
              )}

              <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                {fp.content}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ADD/EDIT MODAL */}
      {isModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
              {/* Left: Map Picker - Fixed Container with Overflow Hidden to prevent fly-out */}
              <div className="w-full md:w-1/2 h-64 md:h-auto relative bg-slate-100 dark:bg-slate-950 overflow-hidden md:rounded-l-3xl md:rounded-tr-none rounded-t-3xl">
                {/* Isolate Stacking Context to contain Leaflet */}
                <div
                  ref={pickerContainerRef}
                  style={{ width: '100%', height: '100%', isolation: 'isolate', zIndex: 0 }}
                ></div>

                <div className="absolute top-4 left-4 z-[500] bg-white/90 dark:bg-slate-900/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 shadow-md border border-slate-200 dark:border-slate-700 pointer-events-none">
                  {t.footprint.mapTip}
                </div>
              </div>

              {/* Right: Form */}
              <div className="w-full md:w-1/2 p-6 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {isEditMode ? t.footprint.edit : t.footprint.add}
                  </h3>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                {/* Scope Switcher */}
                <div className="flex mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFormScope('CHINA')}
                    className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${formScope === 'CHINA' ? 'bg-white dark:bg-slate-700 text-primary-500 shadow-sm' : 'text-slate-500'}`}
                  >
                    Domestic (China)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormScope('GLOBAL')}
                    className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${formScope === 'GLOBAL' ? 'bg-white dark:bg-slate-700 text-primary-500 shadow-sm' : 'text-slate-500'}`}
                  >
                    International
                  </button>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                  {/* Name & Date */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                        {t.footprint.form.name}
                      </label>
                      <input
                        required
                        placeholder="e.g. Forbidden City / Eiffel Tower"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-500 text-slate-900 dark:text-white"
                        value={currentFootprint.location?.name || ''}
                        onChange={(e) =>
                          setCurrentFootprint((prev) => ({
                            ...prev,
                            location: { ...prev.location!, name: e.target.value }
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                        {t.footprint.form.date}
                      </label>
                      <input
                        type="date"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-500 text-slate-900 dark:text-white"
                        value={
                          currentFootprint.visitDate
                            ? new Date(currentFootprint.visitDate).toISOString().split('T')[0]
                            : ''
                        }
                        onChange={(e) =>
                          setCurrentFootprint((prev) => ({ ...prev, visitDate: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  {/* Location Details (Dynamic based on Scope) */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      {formScope === 'CHINA' ? (
                        <>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                            {t.footprint.form.province}
                          </label>
                          <select
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-500 text-slate-900 dark:text-white"
                            value={currentFootprint.location?.province || ''}
                            onChange={(e) =>
                              setCurrentFootprint((prev) => ({
                                ...prev,
                                location: {
                                  ...prev.location!,
                                  province: e.target.value,
                                  country: 'China'
                                }
                              }))
                            }
                          >
                            <option value="">Select Province</option>
                            {PROVINCES_CN.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                            Country
                          </label>
                          <select
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-500 text-slate-900 dark:text-white"
                            value={currentFootprint.location?.country || ''}
                            onChange={(e) =>
                              setCurrentFootprint((prev) => ({
                                ...prev,
                                location: {
                                  ...prev.location!,
                                  country: e.target.value,
                                  province: ''
                                }
                              }))
                            }
                          >
                            <option value="">Select Country</option>
                            {COUNTRIES_LIST.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                            <option value="Other">Other</option>
                          </select>
                        </>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                        {t.footprint.form.city}
                      </label>
                      <input
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-500 text-slate-900 dark:text-white"
                        value={currentFootprint.location?.city || ''}
                        onChange={(e) =>
                          setCurrentFootprint((prev) => ({
                            ...prev,
                            location: { ...prev.location!, city: e.target.value }
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* Coordinates (Read Only/Debug) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                      Coordinates
                    </label>
                    <div className="text-xs font-mono text-slate-500 bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                      {currentFootprint.location?.coordinates?.[0].toFixed(6)},{' '}
                      {currentFootprint.location?.coordinates?.[1].toFixed(6)}
                    </div>
                  </div>

                  {/* Content & Mood */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                      {t.footprint.form.content}
                    </label>
                    <textarea
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-500 h-24 resize-none text-slate-900 dark:text-white"
                      value={currentFootprint.content || ''}
                      onChange={(e) =>
                        setCurrentFootprint((prev) => ({ ...prev, content: e.target.value }))
                      }
                    />
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                        {t.footprint.form.status}
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentFootprint((p) => ({ ...p, status: 'visited' }))}
                          className={`px-3 py-1 text-xs rounded-full border transition-all ${currentFootprint.status === 'visited' ? 'bg-emerald-500 text-white border-emerald-500' : 'text-slate-500 border-slate-300 dark:border-slate-600'}`}
                        >
                          {t.footprint.form.visited}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentFootprint((p) => ({ ...p, status: 'planned' }))}
                          className={`px-3 py-1 text-xs rounded-full border transition-all ${currentFootprint.status === 'planned' ? 'bg-blue-500 text-white border-blue-500' : 'text-slate-500 border-slate-300 dark:border-slate-600'}`}
                        >
                          {t.footprint.form.planned}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                        {t.footprint.form.mood}
                      </label>
                      <select
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm outline-none text-slate-900 dark:text-white"
                        value={currentFootprint.mood}
                        onChange={(e) =>
                          setCurrentFootprint((p) => ({ ...p, mood: e.target.value as any }))
                        }
                      >
                        <option value="happy">Happy 😊</option>
                        <option value="excited">Excited 🤩</option>
                        <option value="peaceful">Peaceful 😌</option>
                        <option value="tired">Tired 😫</option>
                        <option value="adventurous">Adventurous 🤠</option>
                      </select>
                    </div>
                  </div>

                  {/* Photos */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                      {t.footprint.form.photos}
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {currentFootprint.images?.map((img, i) => (
                        <img
                          key={i}
                          src={img}
                          className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-500 hover:text-primary-500 dark:hover:text-primary-400 transition-colors flex items-center gap-2"
                    >
                      {isUploading ? (
                        <i className="fas fa-circle-notch fa-spin"></i>
                      ) : (
                        <i className="fas fa-camera"></i>
                      )}{' '}
                      Upload Photo
                    </button>
                    <input
                      type="file"
                      className="hidden"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handlePhotoUpload}
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="submit"
                      className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-bold uppercase tracking-widest shadow-lg shadow-primary-500/30 transition-all"
                    >
                      {t.footprint.form.save}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default FootprintSpace;
