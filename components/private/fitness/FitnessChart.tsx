import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../../i18n/LanguageContext';
import { User } from '../../../types';
import {
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  Area
} from 'recharts';

type MetricType = 'WEIGHT' | 'DURATION' | 'WATER' | 'SLEEP' | 'BMI';

interface FitnessChartProps {
  stats: any[];
  selectedUser: User | null;
  userList: User[];
  hasMoreUsers: boolean;
  isLoadingUsers: boolean;
  onSelectUser: (u: User) => void;
  onLoadMoreUsers: () => void;
}

export const FitnessChart: React.FC<FitnessChartProps> = ({
  stats,
  selectedUser,
  userList,
  hasMoreUsers,
  isLoadingUsers,
  onSelectUser,
  onLoadMoreUsers
}) => {
  const { t } = useTranslation();
  const [activeMetric, setActiveMetric] = useState<MetricType>('WEIGHT');

  const chartConfig = useMemo(
    () => ({
      WEIGHT: {
        color: '#f43f5e',
        fill: '#fecdd3',
        unit: 'kg',
        name: t.privateSpace.fitness.charts.weight
      },
      BMI: { color: '#0ea5e9', fill: '#bae6fd', unit: '', name: t.privateSpace.fitness.charts.bmi },
      DURATION: {
        color: '#a855f7',
        fill: '#e9d5ff',
        unit: 'min',
        name: t.privateSpace.fitness.charts.duration
      },
      WATER: {
        color: '#3b82f6',
        fill: '#bfdbfe',
        unit: 'ml',
        name: t.privateSpace.fitness.diet.water.split(' ')[0]
      }, // Rough translation reuse
      SLEEP: {
        color: '#6366f1',
        fill: '#c7d2fe',
        unit: 'hr',
        name: t.privateSpace.fitness.status.sleep.split(' ')[0]
      }
    }),
    [t]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 bg-white/80 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white/50 flex flex-col h-[24rem]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 shrink-0">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
            <i className="fas fa-chart-area text-rose-400"></i>{' '}
            {selectedUser
              ? t.privateSpace.fitness.stats.userProgress.replace(
                  '{name}',
                  selectedUser.displayName
                )
              : t.privateSpace.fitness.stats.progress}
          </h3>
          <div className="flex flex-wrap gap-2 bg-slate-100/50 p-1 rounded-xl">
            {Object.keys(chartConfig).map((metric) => {
              const m = metric as MetricType;
              const config = chartConfig[m];
              const isActive = activeMetric === m;
              return (
                <button
                  key={m}
                  onClick={() => setActiveMetric(m)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                    isActive
                      ? 'bg-white shadow-sm scale-105'
                      : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                  style={{
                    color: isActive ? config.color : undefined,
                    borderColor: isActive ? config.color : 'transparent'
                  }}
                >
                  {config.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 w-full min-h-0 relative">
          {stats.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id={`color-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={chartConfig[activeMetric].color}
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor={chartConfig[activeMetric].color}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={30}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value: any) => [
                    `${value} ${chartConfig[activeMetric].unit}`,
                    chartConfig[activeMetric].name
                  ]}
                  labelStyle={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}
                />

                {activeMetric === 'WEIGHT' && (
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke={chartConfig.WEIGHT.color}
                    strokeWidth={3}
                    dot={{ r: 3, fill: chartConfig.WEIGHT.color, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                  />
                )}

                {activeMetric === 'BMI' && (
                  <Line
                    type="monotone"
                    dataKey="bmi"
                    stroke={chartConfig.BMI.color}
                    strokeWidth={3}
                    dot={{ r: 3, fill: chartConfig.BMI.color, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                  />
                )}

                {activeMetric === 'DURATION' && (
                  <Bar
                    dataKey="duration"
                    fill={chartConfig.DURATION.color}
                    radius={[4, 4, 0, 0]}
                    barSize={16}
                  />
                )}

                {activeMetric === 'WATER' && (
                  <Area
                    type="monotone"
                    dataKey="water"
                    stroke={chartConfig.WATER.color}
                    fill={`url(#color-${activeMetric})`}
                    strokeWidth={3}
                    connectNulls={true}
                  />
                )}

                {activeMetric === 'SLEEP' && (
                  <Area
                    type="step"
                    dataKey="sleep"
                    stroke={chartConfig.SLEEP.color}
                    fill={`url(#color-${activeMetric})`}
                    strokeWidth={3}
                    connectNulls={true}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
              <i className="fas fa-chart-line text-4xl mb-2 opacity-50"></i>
              <p className="text-xs font-mono uppercase tracking-widest">
                {t.privateSpace.fitness.stats.noData}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-3xl p-6 shadow-xl shadow-rose-200 flex flex-col text-white h-[24rem] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
        <h3 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-4 text-center z-10 shrink-0">
          {t.privateSpace.fitness.stats.activeProfile}
        </h3>
        <div className="flex-1 overflow-y-auto custom-scrollbar z-10 space-y-3 pr-1">
          {userList.map((user) => {
            const isActive = selectedUser?._id === user._id;
            return (
              <button
                key={user._id}
                onClick={() => onSelectUser(user)}
                className={`w-full flex items-center gap-3 p-2 rounded-2xl transition-all border-2 ${isActive ? 'bg-white text-rose-600 border-white shadow-lg' : 'bg-transparent border-white/20 hover:bg-white/10'}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold overflow-hidden border-2 shrink-0 ${isActive ? 'border-rose-100' : 'border-white/30'}`}
                >
                  <img
                    src={
                      user.photoURL ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=f43f5e&color=fff`
                    }
                    className="w-full h-full object-cover"
                    alt={user.displayName}
                  />
                </div>
                <div className="flex flex-col text-left min-w-0 flex-1">
                  <span className="font-bold text-sm leading-none truncate flex items-center gap-1">
                    {user.displayName}{' '}
                    {user.role === 'super_admin' && (
                      <i className="fas fa-star text-[8px] text-yellow-300"></i>
                    )}
                  </span>
                  <span className="text-[9px] opacity-70 font-mono truncate">{user.email}</span>
                </div>
                {isActive && <i className="fas fa-check-circle text-lg animate-pulse shrink-0"></i>}
              </button>
            );
          })}
          {hasMoreUsers && (
            <button
              onClick={onLoadMoreUsers}
              className="w-full py-2 text-[10px] font-bold uppercase border border-white/20 rounded-xl hover:bg-white/10 transition-colors"
            >
              {isLoadingUsers
                ? t.privateSpace.fitness.stats.loading
                : t.privateSpace.fitness.stats.loadMore}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
