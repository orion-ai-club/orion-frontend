import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { GeoComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsType } from 'echarts/core';
import L from 'leaflet';
import { Footprint, FootprintStats, Theme } from '../../types';

echarts.use([GeoComponent, TooltipComponent, CanvasRenderer]);

const CHINA_GEOJSON_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';

export const PROVINCES_CN = [
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

interface FootprintMapProps {
  mode: 'CHINA' | 'WORLD';
  stats: FootprintStats;
  footprints: Footprint[];
  theme?: Theme;
  language: string;
}

const tileLayerForTheme = (theme?: Theme) =>
  theme === Theme.DARK
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

export const FootprintMap: React.FC<FootprintMapProps> = ({
  mode,
  stats,
  footprints,
  theme,
  language
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const leafletRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (mode !== 'CHINA' || !containerRef.current) return;

    let isMounted = true;
    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;
    chart.showLoading({ color: '#f59e0b', maskColor: 'rgba(0,0,0,0)' });

    const init = async () => {
      try {
        const response = await fetch(CHINA_GEOJSON_URL, { referrerPolicy: 'no-referrer' });
        if (!response.ok) throw new Error('Network response was not ok');
        const chinaJson = await response.json();
        if (!isMounted) return;

        echarts.registerMap('china', chinaJson);
        chart.hideLoading();

        const regions = PROVINCES_CN.map((province) => {
          const visited = stats.provinces.some((item) => {
            if (!item) return false;
            const clean = (value: string) =>
              value.replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔)/g, '');
            return clean(province).includes(clean(item)) || clean(item).includes(clean(province));
          });

          return {
            name: language === 'en' && NAME_MAP_EN[province] ? NAME_MAP_EN[province] : province,
            value: visited ? 1 : 0,
            itemStyle: {
              areaColor: visited ? '#f59e0b' : theme === Theme.DARK ? '#1e293b' : '#e2e8f0',
              borderColor: theme === Theme.DARK ? '#475569' : '#cbd5e1',
              shadowColor: visited ? 'rgba(245, 158, 11, 0.6)' : undefined,
              shadowBlur: visited ? 15 : 0,
              opacity: 1
            }
          };
        });

        chart.setOption({
          backgroundColor: 'transparent',
          tooltip: { trigger: 'item', formatter: (params: any) => params.name },
          geo: {
            map: 'china',
            roam: true,
            layoutCenter: ['50%', '50%'],
            layoutSize: '100%',
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
              label: { show: true, color: '#fff' }
            },
            select: {
              itemStyle: { areaColor: '#f59e0b' },
              label: { color: '#fff' }
            },
            itemStyle: {
              areaColor: theme === Theme.DARK ? '#1e293b' : '#f1f5f9',
              borderColor: theme === Theme.DARK ? '#475569' : '#94a3b8',
              borderWidth: 1
            },
            regions
          },
          series: []
        });
      } catch (error) {
        console.error('Failed to load map', error);
        chart.hideLoading();
      }
    };

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    void init();

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, [mode, stats.provinces, theme, language]);

  useEffect(() => {
    if (mode !== 'WORLD' || !containerRef.current) return;

    const map = L.map(containerRef.current).setView([25, 10], 2);
    leafletRef.current = map;
    L.tileLayer(tileLayerForTheme(theme), {
      attribution: '&copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(containerRef.current);

    footprints.forEach((footprint) => {
      if (!footprint.location?.coordinates || footprint.location.coordinates.length !== 2) return;
      const [lng, lat] = footprint.location.coordinates;
      const marker = L.marker([lat, lng]).addTo(map);
      marker.bindPopup(`
        <div class="p-2 min-w-[200px]">
          ${footprint.images?.[0] ? `<img src="${footprint.images[0]}" class="w-full h-32 object-cover rounded-lg mb-2" />` : ''}
          <h4 class="font-bold text-sm text-slate-800">${footprint.location.name}</h4>
          <div class="text-xs text-slate-500 mb-1">${footprint.location.city || footprint.location.country || ''}</div>
          <div class="text-[10px] text-slate-400 mb-1">${new Date(footprint.visitDate).toLocaleDateString()}</div>
          <p class="text-xs text-slate-600 italic">"${footprint.content || footprint.mood}"</p>
        </div>
      `);
    });

    return () => {
      resizeObserver.disconnect();
      map.remove();
      leafletRef.current = null;
    };
  }, [mode, footprints, theme]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', isolation: 'isolate', zIndex: 0 }}
    />
  );
};
