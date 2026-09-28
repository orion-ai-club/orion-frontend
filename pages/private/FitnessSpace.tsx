import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import { apiService } from '../../services/api';
import { FitnessRecord, User } from '../../types';
import { toast } from '../../components/Toast';
import { createPortal } from 'react-dom';

// Import Sub Components from their correct location in components/private
import { FitnessCalendar } from '../../components/private/fitness/FitnessCalendar';
import { FitnessChart } from '../../components/private/fitness/FitnessChart';
import { FitnessInputForm } from '../../components/private/fitness/FitnessInputForm';
import { FitnessPhotoWall } from '../../components/private/fitness/FitnessPhotoWall';

// Priority Users to Pin (Secondary fallback if logic needs it, but Role logic takes precedence now)
const PRIORITY_EMAILS = ['moviegoer24@gmail.com', 'cenniferchen@gmail.com'];

const toLocalDateStr = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

interface FitnessSpaceProps {
  currentUser?: User | null;
}

export const FitnessSpace: React.FC<FitnessSpaceProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [monthRecords, setMonthRecords] = useState<Map<string, FitnessRecord[]>>(new Map());

  const [userList, setUserList] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userPage, setUserPage] = useState(1);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const [record, setRecord] = useState<FitnessRecord>({});
  const [stats, setStats] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Specific Loading State for Photo Upload
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Photo Wall State
  const [isPhotoWallOpen, setIsPhotoWallOpen] = useState(false);
  const [photoWallDate, setPhotoWallDate] = useState<Date>(new Date()); // Anchor date for 6-month window
  const [wallRecords, setWallRecords] = useState<FitnessRecord[]>([]);

  // Day Gallery State (Modal)
  const [dayPhotosData, setDayPhotosData] = useState<{ date: string; photos: string[] } | null>(
    null
  );

  // Daily Summary State (Modal)
  const [summaryDate, setSummaryDate] = useState<Date | null>(null);

  // --- Users Logic ---
  const fetchUsers = useCallback(
    async (page: number) => {
      setIsLoadingUsers(true);
      try {
        const { data, pagination } = await apiService.getUsers(page, 50, '', 'role', 'desc');

        setUserList((prev) => {
          const combined = page === 1 ? data : [...prev, ...data];
          return Array.from(new Map(combined.map((u) => [u._id, u])).values());
        });
        setHasMoreUsers(pagination.hasNextPage);

        if (page === 1) {
          setSelectedUser((previous) => {
            if (previous) return previous;
            if (currentUser) return currentUser;
            if (data.length === 0) return null;
            const priority = data.find((u) => PRIORITY_EMAILS.includes(u.email));
            return priority || data[0];
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoadingUsers(false);
      }
    },
    [currentUser]
  );

  useEffect(() => {
    void fetchUsers(1);
  }, [fetchUsers]);

  const handleLoadMoreUsers = () => {
    if (hasMoreUsers && !isLoadingUsers) {
      const next = userPage + 1;
      setUserPage(next);
      fetchUsers(next);
    }
  };

  const displayUserList = useMemo(() => {
    // 1. Start with the fetched list
    let list = [...userList];

    // 2. Remove current user from the list (deduplicate)
    if (currentUser) {
      list = list.filter((u) => u._id !== currentUser._id);
    }

    // 3. Sort the remaining users
    list.sort((a, b) => {
      // Helper to get role weight
      const getRoleWeight = (role?: string) => {
        if (role === 'super_admin') return 100;
        if (role === 'admin') return 90;
        // Newer users (User role) come next in the prompt logic logic implies standard role ordering
        return 1;
      };

      const weightA = getRoleWeight(a.role);
      const weightB = getRoleWeight(b.role);

      // 3.1 Sort by Role Weight
      if (weightA !== weightB) {
        return weightB - weightA; // Descending weight (Super Admin first)
      }

      // 3.2 Sort by Recency (Newer _id/createdDate first)
      // MongoDB _id contains timestamp, lex sorting works for recency
      if (a._id > b._id) return -1;
      if (a._id < b._id) return 1;

      return 0;
    });

    // 4. Prepend Current User to the top
    if (currentUser) {
      return [currentUser, ...list];
    }

    return list;
  }, [userList, currentUser]);

  // --- Calendar Logic ---
  const handlePrevMonth = () =>
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const handleNextMonth = () =>
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const handleDateClick = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    setCurrentDate(newDate);
  };

  useEffect(() => {
    const fetchMonthData = async () => {
      const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
      const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
      try {
        const records = await apiService.getFitnessRecords(
          toLocalDateStr(start),
          toLocalDateStr(end)
        );
        const map = new Map<string, FitnessRecord[]>();
        records.forEach((r) => {
          if (r.dateStr) {
            const existing = map.get(r.dateStr) || [];
            existing.push(r);
            map.set(r.dateStr, existing);
          }
        });
        setMonthRecords(map);
      } catch (e) {
        console.error(e);
      }
    };
    fetchMonthData();
  }, [viewDate, isSaving]); // Re-fetch on save to update dots

  // --- Photo Wall Logic (6 Month Window) ---
  useEffect(() => {
    if (isPhotoWallOpen) {
      const fetchWallData = async () => {
        // Default: Show previous 6 months from photoWallDate
        const end = new Date(photoWallDate);
        const start = new Date(photoWallDate);
        start.setMonth(start.getMonth() - 6);

        try {
          const records = await apiService.getFitnessPhotos(
            toLocalDateStr(start),
            toLocalDateStr(end)
          );
          setWallRecords(records);
        } catch (e) {
          console.error('Wall data fetch error', e);
        }
      };
      fetchWallData();
    }
  }, [isPhotoWallOpen, photoWallDate, isSaving]);

  const handleWallPrevRange = () => {
    const newDate = new Date(photoWallDate);
    newDate.setMonth(newDate.getMonth() - 6);
    setPhotoWallDate(newDate);
  };

  const handleWallNextRange = () => {
    const newDate = new Date(photoWallDate);
    newDate.setMonth(newDate.getMonth() + 6);
    setPhotoWallDate(newDate);
  };

  const getWallRangeLabel = () => {
    const end = new Date(photoWallDate);
    const start = new Date(photoWallDate);
    start.setMonth(start.getMonth() - 6);
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  };

  // --- Record Logic ---
  useEffect(() => {
    if (!selectedUser) return;
    const dateStr = toLocalDateStr(currentDate);
    const dayRecords = monthRecords.get(dateStr) || [];
    const foundRecord = dayRecords.find((r) => (r.user as User)?.email === selectedUser.email);
    setRecord(foundRecord || {});
  }, [currentDate, monthRecords, selectedUser]);

  // --- Stats Logic ---
  useEffect(() => {
    if (!selectedUser) return;
    const loadStats = async () => {
      try {
        const data = await apiService.getFitnessStats(30, selectedUser.email);
        const chartData = data.dates.map((dateStr, index) => ({
          date: dateStr.substring(5),
          weight: data.weights[index],
          bmi: data.bmis ? data.bmis[index] : null, // Add BMI from API
          duration: data.durations[index],
          water: data.water[index],
          sleep: data.sleep[index]
        }));
        setStats(chartData);
      } catch (e) {
        console.error(e);
      }
    };
    loadStats();
  }, [isSaving, selectedUser]);

  // --- Save / Update ---
  const handleSave = async () => {
    if (!selectedUser) {
      toast.error('Please select a user profile.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...record,
        date: toLocalDateStr(currentDate),
        targetUserEmail: selectedUser.email
      };
      await apiService.submitFitnessRecord(payload as any);
      toast.success(t.privateSpace.fitness.saved);
    } catch (e) {
      toast.error('Failed to save record');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Goal Change (Fixed) ---
  const handleGoalChange = async (goal: 'cut' | 'bulk' | 'maintain') => {
    if (!selectedUser) return;
    try {
      // Must pass userId so the backend knows which user to update
      const res = await apiService.updateFitnessGoal(goal, selectedUser._id);
      if (res.success) {
        setSelectedUser((prev) => (prev ? { ...prev, fitnessGoal: goal } : null));
        // Update list cache as well
        setUserList((prev) =>
          prev.map((u) => (u._id === selectedUser._id ? { ...u, fitnessGoal: goal } : u))
        );
        toast.success(`Goal switched to ${goal.toUpperCase()}`);
      }
    } catch (e) {
      toast.error('Failed to update goal');
    }
  };

  const processUploadFile = async (file: File) => {
    setIsUploadingPhoto(true);
    try {
      const url = await apiService.uploadImage(file, { folder: 'fitness' });
      setRecord((prev) => ({ ...prev, photos: [...(prev.photos || []), url] }));
      toast.success('Photo uploaded');
    } catch (e) {
      toast.error('Photo upload failed');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processUploadFile(file);
  };

  // Summary Data Logic
  const getSummaryData = () => {
    if (!summaryDate) return [];
    const dateStr = toLocalDateStr(summaryDate);
    return monthRecords.get(dateStr) || [];
  };

  return (
    <div className="flex flex-col gap-6 text-slate-900">
      {/* Lightbox Overlay */}
      {selectedPhoto &&
        createPortal(
          <div
            className="fixed inset-0 z-[2200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setSelectedPhoto(null)}
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 text-white text-3xl hover:text-rose-500 transition-colors"
            >
              <i className="fas fa-times"></i>
            </button>
            <img
              src={selectedPhoto}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              alt="Full View"
            />
          </div>,
          document.body
        )}

      {/* Day Photos Gallery Modal */}
      {dayPhotosData &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-rose-50/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner">
                    <i className="fas fa-star"></i>
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-bold text-slate-800">
                      {t.privateSpace.fitness.photoWall.title}
                    </h3>
                    <p className="text-xs font-mono text-rose-400 font-bold uppercase">
                      {dayPhotosData.date}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDayPhotosData(null)}
                  className="w-10 h-10 rounded-full bg-slate-50 text-slate-500 hover:text-rose-500 flex items-center justify-center transition-colors shadow-sm"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/30">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {dayPhotosData.photos.map((url, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-2xl overflow-hidden shadow-lg border border-white cursor-pointer group hover:ring-4 ring-rose-400 transition-all"
                      onClick={() => setSelectedPhoto(url)}
                    >
                      <img
                        src={url}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                        loading="lazy"
                        alt="Workout"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Daily Summary Modal */}
      {summaryDate &&
        createPortal(
          <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
                    <i className="fas fa-clipboard-list"></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold text-slate-800">
                      {t.privateSpace.fitness.calendar.summaryTitle}
                    </h3>
                    <p className="text-xs font-mono text-blue-400 font-bold uppercase">
                      {toLocalDateStr(summaryDate)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSummaryDate(null)}
                  className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 flex items-center justify-center transition-colors"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {getSummaryData().length === 0 ? (
                  <div className="text-center text-slate-400 py-10">
                    {t.privateSpace.fitness.calendar.noActivity}
                  </div>
                ) : (
                  getSummaryData().map((rec, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-sm"
                    >
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-white shadow-sm">
                          <img
                            src={
                              (rec.user as User)?.photoURL ||
                              `https://ui-avatars.com/api/?name=${(rec.user as User)?.displayName}`
                            }
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="font-bold text-slate-700">
                          {(rec.user as User)?.displayName}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-white p-3 rounded-xl border border-slate-100">
                          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                            Weight
                          </div>
                          <div className="text-lg font-bold text-slate-800">
                            {rec.body?.weight ? `${rec.body.weight} kg` : '-'}
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-100">
                          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                            Sleep
                          </div>
                          <div className="text-lg font-bold text-slate-800">
                            {rec.status?.sleepHours ? `${rec.status.sleepHours} h` : '-'}
                          </div>
                        </div>
                      </div>

                      {rec.workout?.types && rec.workout.types.length > 0 && (
                        <div className="mb-4">
                          <div className="text-[10px] uppercase font-bold text-slate-400 mb-2">
                            Workout ({rec.workout.duration} min)
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {rec.workout.types.map((t) => (
                              <span
                                key={t}
                                className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold uppercase text-slate-600 shadow-sm"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                          {rec.workout.note && (
                            <div className="mt-2 text-sm text-slate-600 bg-white p-2 rounded-lg italic">
                              &quot;{rec.workout.note}&quot;
                            </div>
                          )}
                        </div>
                      )}

                      {rec.diet?.content && (
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                            Diet
                          </div>
                          <p className="text-sm text-slate-700">{rec.diet.content}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 1. CALENDAR */}
      <FitnessCalendar
        viewDate={viewDate}
        currentDate={currentDate}
        monthRecords={monthRecords}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onDateClick={handleDateClick}
        onOpenGallery={(date, photos) => setDayPhotosData({ date, photos })}
        onShowSummary={(date) => setSummaryDate(date)}
      />

      {/* 2. PHOTO WALL (Collapsible, 6-Month Range) */}
      <FitnessPhotoWall
        isOpen={isPhotoWallOpen}
        onToggle={() => setIsPhotoWallOpen(!isPhotoWallOpen)}
        wallRecords={wallRecords}
        selectedUser={selectedUser}
        onSelectPhoto={setSelectedPhoto}
        onPrevRange={handleWallPrevRange}
        onNextRange={handleWallNextRange}
        rangeLabel={getWallRangeLabel()}
      />

      {/* 3. CHARTS & USER SELECTOR */}
      <FitnessChart
        stats={stats}
        selectedUser={selectedUser}
        userList={displayUserList}
        hasMoreUsers={hasMoreUsers}
        isLoadingUsers={isLoadingUsers}
        onSelectUser={setSelectedUser}
        onLoadMoreUsers={handleLoadMoreUsers}
      />

      {/* 4. INPUT FORM */}
      <FitnessInputForm
        currentDate={currentDate}
        selectedUser={selectedUser}
        currentUser={currentUser}
        record={record}
        updateRecord={(partial) => setRecord((prev) => ({ ...prev, ...partial }))}
        onGoalChange={handleGoalChange}
        onSave={handleSave}
        isSaving={isSaving}
        onPhotoUpload={handlePhotoUpload}
        onUploadFile={processUploadFile}
        onPhotoSelect={setSelectedPhoto}
        onPhotoDelete={(idx) => {
          const newPhotos = [...(record.photos || [])];
          newPhotos.splice(idx, 1);
          setRecord((prev) => ({ ...prev, photos: newPhotos }));
        }}
        // Pass loading state down
        isUploadingPhoto={isUploadingPhoto}
      />
    </div>
  );
};

export default FitnessSpace;
