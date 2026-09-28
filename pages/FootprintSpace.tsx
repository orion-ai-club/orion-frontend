import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts/core';
import { GeoComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsType } from 'echarts/core';

echarts.use([GeoComponent, TooltipComponent, CanvasRenderer]);
import L from 'leaflet';
import { useTranslation } from '../i18n/LanguageContext';
import { apiService } from '../services/api';
import { Footprint, FootprintStats, Theme } from '../types';
import { toast } from '../components/Toast';
import { createPortal } from 'react-dom';

// Stable Aliyun DataV Atlas GeoJSON for China
const CHINA_GEOJSON_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';

// Standard Full Chinese Province Names (Matching GeoJSON features)
const PROVINCES_CN = [
  '北京市',
  '天津市',
  '上海市',
  '重庆市',
  '河北省',
  '山西省',
  '辽宁省',
  '吉林省',
  '黑龙江省',
  '江苏省',
  '浙江省',
  '安徽省',
  '福建省',
  '江西省',
  '山东省',
  '河南省',
  '湖北省',
  '湖南省',
  '广东省',
  '海南省',
  '四川省',
  '贵州省',
  '云南省',
  '陕西省',
  '甘肃省',
  '青海省',
  '台湾省',
  '内蒙古自治区',
  '广西壮族自治区',
  '西藏自治区',
  '宁夏回族自治区',
  '新疆维吾尔自治区',
  '香港特别行政区',
  '澳门特别行政区'
];

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

// English Name Mapping for ECharts
const NAME_MAP_EN: Record<string, string> = {
  北京市: 'Beijing',
  天津市: 'Tianjin',
  上海市: 'Shanghai',
  重庆市: 'Chongqing',
  河北省: 'Hebei',
  山西省: 'Shanxi',
  辽宁省: 'Liaoning',
  吉林省: 'Jilin',
  黑龙江省: 'Heilongjiang',
  江苏省: 'Jiangsu',
  浙江省: 'Zhejiang',
  安徽省: 'Anhui',
  福建省: 'Fujian',
  江西省: 'Jiangxi',
  山东省: 'Shandong',
  河南省: 'Henan',
  湖北省: 'Hubei',
  湖南省: 'Hunan',
  广东省: 'Guangdong',
  海南省: 'Hainan',
  四川省: 'Sichuan',
  贵州省: 'Guizhou',
  云南省: 'Yunnan',
  陕西省: 'Shaanxi',
  甘肃省: 'Gansu',
  青海省: 'Qinghai',
  台湾省: 'Taiwan',
  内蒙古自治区: 'Inner Mongolia',
  广西壮族自治区: 'Guangxi',
  西藏自治区: 'Tibet',
  宁夏回族自治区: 'Ningxia',
  新疆维吾尔自治区: 'Xinjiang',
  香港特别行政区: 'Hong Kong',
  澳门特别行政区: 'Macau'
};

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

  const mapContainerRef = useRef<HTMLDivElement>(null); // For ECharts
  const leafletMapRef = useRef<L.Map | null>(null); // For Leaflet Instance
  const leafletContainerRef = useRef<HTMLDivElement>(null); // For Leaflet Div
  const pickerMapRef = useRef<L.Map | null>(null); // For Picker Map
  const pickerContainerRef = useRef<HTMLDivElement>(null); // For Picker Div
  const chartInstance = useRef<EChartsType | null>(null);

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

  // --- ECharts China Map Logic ---
  useEffect(() => {
    let isMounted = true;

    // Always dispose previous instance to prevent conflicts or memory leaks when switching modes
    if (chartInstance.current) {
      chartInstance.current.dispose();
      chartInstance.current = null;
    }

    if (viewMode === 'CHINA' && mapContainerRef.current) {
      const initChart = async () => {
        try {
          if (!mapContainerRef.current || !isMounted) return;

          const chart = echarts.init(mapContainerRef.current);
          chartInstance.current = chart;
          chart.showLoading({ color: '#f59e0b', maskColor: 'rgba(0,0,0,0)' });

          const response = await fetch(CHINA_GEOJSON_URL, { referrerPolicy: 'no-referrer' });
          if (!response.ok) throw new Error('Network response was not ok');
          const chinaJson = await response.json();

          if (!isMounted) {
            chart.dispose();
            return;
          }

          echarts.registerMap('china', chinaJson);
          chart.hideLoading();

          const dataMap = PROVINCES_CN.map((provFull) => {
            // Robust Matching: normalize names by removing common suffixes for comparison
            const visited = stats.provinces.some((p) => {
              if (!p) return false;
              const cleanP = p.replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔)/g, '');
              const cleanFull = provFull.replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔)/g, '');
              return cleanFull.includes(cleanP) || cleanP.includes(cleanFull);
            });

            // FIX: Map name to English if current language is English
            // This ensures ECharts matches the data value to the displayed (translated) region name
            let mapName = provFull;
            if (language === 'en' && NAME_MAP_EN[provFull]) {
              mapName = NAME_MAP_EN[provFull];
            }

            return {
              name: mapName,
              value: visited ? 1 : 0,
              itemStyle: {
                areaColor: visited ? '#f59e0b' : theme === Theme.DARK ? '#1e293b' : '#e2e8f0',
                borderColor: theme === Theme.DARK ? '#475569' : '#cbd5e1',
                // Enhanced glow effect for visited provinces
                shadowColor: visited ? 'rgba(245, 158, 11, 0.6)' : undefined,
                shadowBlur: visited ? 15 : 0,
                opacity: 1
              }
            };
          });

          chart.setOption({
            backgroundColor: 'transparent',
            tooltip: {
              trigger: 'item',
              formatter: (params: any) => {
                return params.name;
              }
            },
            geo: {
              map: 'china',
              roam: true,
              layoutCenter: ['50%', '50%'],
              layoutSize: '100%', // Fill the container
              nameMap: language === 'en' ? NAME_MAP_EN : undefined,
              label: {
                show: true,
                color: theme === Theme.DARK ? '#94a3b8' : '#64748b',
                fontSize: 10
              },
              emphasis: {
                itemStyle: {
                  areaColor: '#f59e0b',
                  shadowBlur: 20,
                  shadowColor: 'rgba(245, 158, 11, 0.8)'
                },
                label: {
                  show: true,
                  color: '#fff'
                }
              },
              select: {
                itemStyle: {
                  areaColor: '#f59e0b'
                },
                label: {
                  color: '#fff'
                }
              },
              itemStyle: {
                areaColor: theme === Theme.DARK ? '#1e293b' : '#f1f5f9',
                borderColor: theme === Theme.DARK ? '#475569' : '#94a3b8',
                borderWidth: 1
              },
              regions: dataMap
            },
            series: []
          });

          window.addEventListener('resize', () => chart.resize());
        } catch (err) {
          console.error('Failed to load map', err);
          if (chartInstance.current) chartInstance.current.hideLoading();
        }
      };

      initChart();
    }

    // Cleanup function
    return () => {
      isMounted = false;
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [viewMode, stats, theme, language]);

  // --- Leaflet World Map Logic ---
  useEffect(() => {
    // Cleanup existing map if present to ensure clean slate
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }

    if (viewMode === 'WORLD' && leafletContainerRef.current) {
      const map = L.map(leafletContainerRef.current).setView([25, 10], 2);
      leafletMapRef.current = map;

      L.tileLayer(getTileLayer(), {
        attribution: '&copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      // Robust Resize Observer to prevent blank maps
      const resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(leafletContainerRef.current);

      // Add Markers
      footprints.forEach((fp) => {
        if (fp.location?.coordinates && fp.location.coordinates.length === 2) {
          const [lng, lat] = fp.location.coordinates;
          const marker = L.marker([lat, lng]).addTo(map);

          const popupContent = `
                    <div class="p-2 min-w-[200px]">
                        ${fp.images && fp.images.length > 0 ? `<img src="${fp.images[0]}" class="w-full h-32 object-cover rounded-lg mb-2" />` : ''}
                        <h4 class="font-bold text-sm text-slate-800">${fp.location.name}</h4>
                        <div class="text-xs text-slate-500 mb-1">${fp.location.city || fp.location.country || ''}</div>
                        <div class="text-[10px] text-slate-400 mb-1">${new Date(fp.visitDate).toLocaleDateString()}</div>
                        <p class="text-xs text-slate-600 italic">"${fp.content || fp.mood}"</p>
                    </div>
                `;

          marker.bindPopup(popupContent);
        }
      });

      return () => {
        resizeObserver.disconnect();
        if (leafletMapRef.current) {
          leafletMapRef.current.remove();
          leafletMapRef.current = null;
        }
      };
    }
  }, [viewMode, footprints, theme]);

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
        {viewMode === 'CHINA' && (
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }}></div>
        )}
        {viewMode === 'WORLD' && (
          <div
            ref={leafletContainerRef}
            style={{ width: '100%', height: '100%', isolation: 'isolate', zIndex: 0 }}
          ></div>
        )}

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
