import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../../i18n/LanguageContext';
import { apiService } from '../../../services/api';
import { Menu, SmartMenuResponse } from '../../../types';
import { toast } from '../../Toast';
import { DeleteModal } from '../../DeleteModal';
import { sanitizeUntrustedHtml } from '../../../utils/security';

// Wheel Colors
const WHEEL_COLORS = [
  '#fca5a5', // red-300
  '#fdba74', // orange-300
  '#fcd34d', // amber-300
  '#86efac', // green-300
  '#93c5fd', // blue-300
  '#c4b5fd', // violet-300
  '#f0abfc', // fuchsia-300
  '#cbd5e1' // slate-300
];

// AI Response (Legacy/Wheel)
interface AIRecipeResponse {
  recipe: {
    title: string;
    description: string;
    difficulty: string;
    time: string;
    ingredients: string[];
    steps: string[];
    tips: string;
  };
  side_dishes: {
    name: string;
    reason: string;
  }[];
}

// External API Response (New Search)
interface ExternalRecipe {
  id?: string;
  title: string;
  image?: string;
  description?: string;
  ingredients?: string;
  steps?: string; // HTML content
  source?: string;
}

export const AIChef: React.FC = () => {
  const { t } = useTranslation();

  // Selection States
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('');
  const [filterCalories, setFilterCalories] = useState<string>('');
  const [isCooldown, setIsCooldown] = useState(false);
  const [isHealthy, setIsHealthy] = useState(false);

  // Wheel & Result States
  const [pool, setPool] = useState<Menu[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [winner, setWinner] = useState<Menu | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Recipe Data State
  const [activeRecipe, setActiveRecipe] = useState<AIRecipeResponse | null>(null); // AI format
  const [activeExternalRecipe, setActiveExternalRecipe] = useState<ExternalRecipe | null>(null); // External/DB format

  // Smart Recommendation State
  const [smartRecommendation, setSmartRecommendation] = useState<SmartMenuResponse | null>(null);

  // Search State
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ExternalRecipe[]>([]);

  // Menu Management Modal State
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [menuList, setMenuList] = useState<Menu[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editMenu, setEditMenu] = useState<Partial<Menu>>({});

  // Delete State
  const [menuToDelete, setMenuToDelete] = useState<string | null>(null);

  // View Mode
  const [viewMode, setViewMode] = useState<
    'WHEEL' | 'RECIPE_AI' | 'RECIPE_EXT' | 'SEARCH' | 'SMART_RECOMMEND'
  >('WHEEL');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMenuList = async () => {
    try {
      const list = await apiService.getMenus();
      setMenuList(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isManageModalOpen) fetchMenuList();
  }, [isManageModalOpen]);

  // --- Confirm Dish Logic (New) ---
  const handleConfirmDish = async (dishName: string) => {
    try {
      // Backend handles dishName as ID in this route as per requirements
      const res = await apiService.confirmMenu(dishName, filterCategory || 'Meal');
      toast.success(res.msg || `Selected ${dishName} for your meal!`);
    } catch (e) {
      toast.error('Failed to confirm selection.');
    }
  };

  // --- Wheel Logic ---
  const handleDraw = async () => {
    if (isSpinning) return;

    // Reset States
    setWinner(null);
    setShowResult(false);
    setPool([]);
    setWheelRotation(0);
    setActiveRecipe(null);
    setActiveExternalRecipe(null);

    try {
      const res = await apiService.drawMenu(filterCategory, isCooldown, isHealthy);

      const newPool = res.pool && res.pool.length > 0 ? res.pool : [res.winner];
      setPool(newPool);
      setWinner(res.winner);

      const sliceAngle = 360 / newPool.length;
      const winnerIndex = newPool.findIndex((m) => m._id === res.winner._id);
      const centerAngle = (winnerIndex + 0.5) * sliceAngle;
      const targetRotation = 360 * 5 - centerAngle;

      setTimeout(() => {
        setIsSpinning(true);
        setWheelRotation(targetRotation);
      }, 50);

      setTimeout(() => {
        setIsSpinning(false);
        setShowResult(true);
      }, 3500);
    } catch (e) {
      toast.error('No dishes available with current filters!');
      setIsSpinning(false);
    }
  };

  const handleConfirm = async () => {
    if (!winner) return;
    try {
      const res = await apiService.confirmMenu(winner._id, filterCategory || 'Meal');
      toast.success(res.msg || 'Enjoy your meal!');
    } catch (e) {
      toast.error('Confirmation failed.');
    }
  };

  const handleReset = () => {
    setWinner(null);
    setPool([]);
    setShowResult(false);
    setWheelRotation(0);
    setActiveRecipe(null);
    setActiveExternalRecipe(null);
  };

  // --- AI Recipe Fetch Logic (From Wheel Winner) ---
  const handleViewRecipeAI = async () => {
    if (!winner) return;
    setLoadingRecipe(true);

    try {
      // 1. Try AI Recommendation first for Wheel (custom dishes might not be in ext DB)
      const data = await apiService.getRecipeRecommendation(winner.name);
      if (data) {
        setActiveRecipe(data);
        setViewMode('RECIPE_AI');
      } else {
        toast.error('Could not generate recipe.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load recipe.');
    } finally {
      setLoadingRecipe(false);
    }
  };

  // --- AI Recipe Fetch Logic (From Smart Plan Click) ---
  const handleAIDishClick = async (dishName: string) => {
    setLoadingRecipe(true);
    try {
      // Direct call to AI endpoint
      const data = await apiService.getRecipeRecommendation(dishName);
      if (data) {
        setActiveRecipe(data);
        setViewMode('RECIPE_AI');
      } else {
        toast.error('Could not generate recipe.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load recipe.');
    } finally {
      setLoadingRecipe(false);
    }
  };

  // --- Smart Recommendation Logic ---
  const handleSmartRecommend = async () => {
    setLoadingRecipe(true);
    // Optional: Toast for better feedback since this can take 5-10s
    toast.info('AI Chef is analyzing your dietary data...');

    try {
      const res = await apiService.getSmartMenuRecommendation();
      setSmartRecommendation(res);
      setViewMode('SMART_RECOMMEND');
    } catch (e) {
      console.error(e);
      toast.error(t.privateSpace.leisure.chefWheel.smartPlan.error);
    } finally {
      setLoadingRecipe(false);
    }
  };

  // --- New Manual Search Logic (Using getRecipeDetails) ---
  const handleSearchRecipe = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = customQuery || searchQuery;
    if (!query.trim()) return;

    // Switch view only if coming from another view (like Smart Recommend)
    if (viewMode !== 'SEARCH') setViewMode('SEARCH');
    setSearchQuery(query);

    setLoadingRecipe(true);
    setActiveRecipe(null);
    setActiveExternalRecipe(null);
    setSearchResults([]);

    try {
      // Calls the aggregator endpoint (Local DB -> External API)
      const list = await apiService.getRecipeDetails(query);

      if (list && list.length > 0) {
        setSearchResults(list);
      } else {
        toast.error('No recipes found.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Search failed.');
    } finally {
      setLoadingRecipe(false);
    }
  };

  const handleSelectExternalRecipe = (item: ExternalRecipe) => {
    setActiveExternalRecipe(item);
    setViewMode('RECIPE_EXT');
  };

  // --- Helpers for SVG Wheel ---
  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  // CRUD Handlers
  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMenu.name) return;
    try {
      if (editMenu._id) await apiService.updateMenu(editMenu._id, editMenu);
      else await apiService.createMenu(editMenu);
      setIsEditing(false);
      fetchMenuList();
      toast.success('Menu updated.');
    } catch (e) {
      toast.error('Failed to save menu.');
    }
  };

  const confirmDeleteMenu = async () => {
    if (!menuToDelete) return;
    try {
      await apiService.deleteMenu(menuToDelete);
      fetchMenuList();
      setMenuToDelete(null);
    } catch (e) {
      toast.error('Delete failed.');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await apiService.uploadImage(file, { folder: 'menu' });
      setEditMenu((prev) => ({ ...prev, image: url }));
    } catch (e) {
      toast.error('Upload failed');
    }
  };

  const openEdit = (m?: Menu) => {
    setEditMenu(
      m
        ? { ...m }
        : {
            name: '',
            category: '晚餐',
            tags: [],
            weight: 1, // Default weight
            caloriesLevel: 'medium', // Default cal level
            isActive: true, // Default active
            image: ''
          }
    );
    setIsEditing(true);
  };

  // --- RENDER HELPERS ---

  // 1. Render AI Generated Recipe (JSON Structure)
  const renderAIRecipeContent = () => {
    if (!activeRecipe) return null;
    return (
      <div className="flex flex-col h-full animate-fade-in overflow-y-auto custom-scrollbar pr-2 pb-10">
        {/* Recipe Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-display font-bold text-slate-800 mb-2">
            {activeRecipe.recipe.title}
          </h2>
          <p className="text-xs text-slate-500 italic mb-3">{activeRecipe.recipe.description}</p>
          <div className="flex gap-2">
            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded">
              {activeRecipe.recipe.difficulty}
            </span>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded">
              {activeRecipe.recipe.time}
            </span>
          </div>
        </div>

        {/* Ingredients */}
        <div className="mb-6">
          <h4 className="text-[10px] font-bold uppercase text-slate-400 mb-2">Ingredients</h4>
          <div className="bg-white p-4 rounded-xl border border-slate-100 text-xs text-slate-700 grid grid-cols-2 gap-2">
            {activeRecipe.recipe.ingredients.map((ing, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
                <span>{ing}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="mb-6">
          <h4 className="text-[10px] font-bold uppercase text-slate-400 mb-2">Instructions</h4>
          <div className="space-y-3">
            {activeRecipe.recipe.steps.map((step, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-5 h-5 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">
                  {i + 1}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pt-0.5">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="mb-6 bg-yellow-50 border border-yellow-100 p-3 rounded-xl flex items-start gap-3">
          <i className="fas fa-lightbulb text-yellow-500 mt-0.5"></i>
          <div>
            <span className="text-[10px] font-bold text-yellow-600 uppercase block mb-1">
              Chef&apos;s Tip
            </span>
            <p className="text-xs text-yellow-700 leading-relaxed">{activeRecipe.recipe.tips}</p>
          </div>
        </div>

        {/* Selection Button */}
        <button
          onClick={() => handleConfirmDish(activeRecipe.recipe.title)}
          className="w-full py-3 mt-2 bg-emerald-500 text-white rounded-xl font-bold uppercase shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
        >
          <i className="fas fa-check"></i> Select This Dish
        </button>
      </div>
    );
  };

  // 2. Render External API Recipe (HTML Structure)
  const renderExternalRecipeContent = () => {
    if (!activeExternalRecipe) return null;
    return (
      <div className="flex flex-col h-full animate-fade-in overflow-y-auto custom-scrollbar pr-2 pb-10">
        {/* Header */}
        <div className="mb-6">
          {activeExternalRecipe.image && (
            <div className="w-full h-48 rounded-xl overflow-hidden mb-4 shadow-sm">
              <img
                src={activeExternalRecipe.image}
                className="w-full h-full object-cover"
                alt={activeExternalRecipe.title}
              />
            </div>
          )}
          <h2 className="text-2xl font-display font-bold text-slate-800 mb-2">
            {activeExternalRecipe.title}
          </h2>
          {activeExternalRecipe.description && (
            <p className="text-xs text-slate-500 italic mb-3">{activeExternalRecipe.description}</p>
          )}
        </div>

        {/* Ingredients (Usually a string) */}
        <div className="mb-6">
          <h4 className="text-[10px] font-bold uppercase text-slate-400 mb-2">Ingredients</h4>
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-xs text-slate-700 leading-relaxed">
            {activeExternalRecipe.ingredients}
          </div>
        </div>

        {/* Steps (HTML Content) */}
        <div className="mb-6">
          <h4 className="text-[10px] font-bold uppercase text-slate-400 mb-2">Instructions</h4>
          <div
            className="space-y-2 text-sm text-slate-700 leading-loose [&>p]:mb-2 [&>img]:rounded-lg [&>img]:my-2 [&>img]:max-h-60 [&>img]:object-contain"
            dangerouslySetInnerHTML={{
              __html: sanitizeUntrustedHtml(activeExternalRecipe.steps || 'No steps provided.')
            }}
          />
        </div>

        {/* Selection Button */}
        <button
          onClick={() => handleConfirmDish(activeExternalRecipe.title)}
          className="w-full py-3 mt-2 bg-emerald-500 text-white rounded-xl font-bold uppercase shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
        >
          <i className="fas fa-check"></i> Select This Dish
        </button>
      </div>
    );
  };

  // 3. Render Smart Recommendation Content
  const renderSmartRecommendContent = () => {
    if (loadingRecipe) {
      return (
        <div className="flex flex-col h-full items-center justify-center text-indigo-400 animate-pulse">
          <i className="fas fa-brain fa-spin text-3xl mb-3"></i>
          <p className="text-xs font-bold uppercase tracking-widest">Generating Recipe...</p>
        </div>
      );
    }

    if (!smartRecommendation) return null;
    const { based_on, recommendation } = smartRecommendation;
    const goalColors = {
      cut: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      bulk: 'text-orange-600 bg-orange-50 border-orange-200',
      maintain: 'text-blue-600 bg-blue-50 border-blue-200'
    };
    const goalKey = (based_on.goal as 'cut' | 'bulk' | 'maintain') || 'maintain';

    return (
      <div className="flex flex-col h-full animate-fade-in overflow-y-auto custom-scrollbar pr-2 pb-10">
        {/* AI Context Card */}
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 p-4 rounded-2xl mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-md">
              <i className="fas fa-user-md"></i>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                {t.privateSpace.leisure.chefWheel.smartPlan.nutritionist}
              </h3>
              <p className="text-[10px] text-slate-500">
                {t.privateSpace.leisure.chefWheel.smartPlan.personalized}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {based_on.weight && (
              <span className="text-[10px] font-bold uppercase px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-600">
                <i className="fas fa-weight mr-1"></i> {based_on.weight}kg
              </span>
            )}
            <span
              className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg border ${goalColors[goalKey]}`}
            >
              {t.privateSpace.leisure.chefWheel.smartPlan.target}: {based_on.goal.toUpperCase()}
            </span>
          </div>

          <div className="bg-white/60 p-3 rounded-xl text-xs text-indigo-900 italic relative">
            <i className="fas fa-quote-left absolute -top-1 -left-1 text-indigo-200 text-xl"></i>
            <span className="relative z-10">{recommendation.nutrition_advice}</span>
          </div>
        </div>

        {/* Dish Recommendations - Select Button Removed Here */}
        <div className="space-y-4 mb-8">
          {recommendation.dishes.map((dish, i) => (
            <div
              key={i}
              className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-2 relative group hover:border-indigo-200 transition-colors"
            >
              <div className="absolute top-4 right-4 bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded">
                {dish.calories_estimate}
              </div>
              <h4
                className="font-bold text-slate-800 text-lg group-hover:text-indigo-600 cursor-pointer transition-colors"
                // Updated: Call AI Recommend Dish instead of General Search
                onClick={() => handleAIDishClick(dish.name)}
              >
                {dish.name} <i className="fas fa-magic text-xs opacity-50 ml-1 text-indigo-400"></i>
              </h4>
              <div className="flex gap-2">
                {dish.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded border border-slate-100"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <div className="flex justify-between items-start gap-3 border-t border-slate-50 pt-2 mt-1">
                <p className="text-xs text-slate-500 leading-relaxed">{dish.reason}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Fallback Logic Explanation */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500">
          <h5 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
            <i className="fas fa-info-circle"></i>{' '}
            {t.privateSpace.leisure.chefWheel.smartPlan.fallbackTitle}
          </h5>
          <ul className="space-y-2 list-disc list-inside opacity-80 leading-relaxed">
            <li>{t.privateSpace.leisure.chefWheel.smartPlan.fallback1}</li>
            <li>{t.privateSpace.leisure.chefWheel.smartPlan.fallback2}</li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white/90 backdrop-blur rounded-[2rem] p-5 border border-white shadow-xl flex flex-col h-full relative overflow-hidden transition-all text-left text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 z-10 shrink-0">
        <div className="flex items-center gap-2">
          {viewMode !== 'WHEEL' ? (
            <button
              onClick={() => {
                // Navigation Back Logic
                if (viewMode === 'RECIPE_EXT') {
                  setViewMode('SEARCH');
                  setActiveExternalRecipe(null);
                } else {
                  setViewMode('WHEEL');
                  setActiveRecipe(null);
                  setSearchResults([]);
                }
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-500 hover:text-amber-500 hover:bg-amber-50 transition-colors"
            >
              <i className="fas fa-arrow-left"></i>
            </button>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-md">
              <i className="fas fa-utensils"></i>
            </div>
          )}
          <div>
            <h3 className="font-bold text-slate-800 text-sm truncate">
              {viewMode === 'SEARCH'
                ? t.privateSpace.leisure.chefWheel.searchMode
                : viewMode === 'RECIPE_EXT' || viewMode === 'RECIPE_AI'
                  ? 'Recipe Details'
                  : viewMode === 'SMART_RECOMMEND'
                    ? t.privateSpace.leisure.chefWheel.smartPlan.title
                    : t.privateSpace.leisure.chefWheel.title}
            </h3>
          </div>
        </div>
        <button
          onClick={() => setIsManageModalOpen(true)}
          className="text-[10px] font-bold text-slate-500 hover:text-amber-600 bg-slate-100 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
        >
          <i className="fas fa-cog"></i> {t.privateSpace.leisure.chefWheel.manage}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 rounded-2xl border border-slate-100 p-4 relative overflow-hidden">
        {/* VIEW MODE: SEARCH */}
        {viewMode === 'SEARCH' && (
          <div className="flex flex-col h-full">
            {/* Search Bar */}
            <form onSubmit={(e) => handleSearchRecipe(e)} className="flex gap-2 mb-4 shrink-0">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                placeholder={t.privateSpace.leisure.chefWheel.searchPlaceholder}
                autoFocus
              />
              <button
                type="submit"
                disabled={loadingRecipe || !searchQuery.trim()}
                className="px-4 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors shadow-lg shadow-amber-200 disabled:opacity-50"
              >
                {loadingRecipe ? (
                  <i className="fas fa-circle-notch fa-spin"></i>
                ) : (
                  <i className="fas fa-search"></i>
                )}
              </button>
            </form>

            {/* Search Results List */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              {loadingRecipe ? (
                <div className="h-full flex flex-col items-center justify-center text-amber-400">
                  <i className="fas fa-robot fa-spin text-3xl mb-2"></i>
                  <span className="text-xs uppercase font-bold tracking-widest">
                    {t.privateSpace.leisure.chefWheel.searching}
                  </span>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {searchResults.map((result, idx) => (
                    <button
                      key={result.id || idx}
                      onClick={() => handleSelectExternalRecipe(result)}
                      className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200 hover:border-amber-400 transition-all text-left group shadow-sm hover:shadow-md"
                    >
                      <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                        {result.image ? (
                          <img
                            src={result.image}
                            alt={result.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <i className="fas fa-utensils"></i>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-800 group-hover:text-amber-600 truncate">
                          {result.title}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate">
                          {result.ingredients || 'Tap to view details'}
                        </p>
                      </div>
                      <i className="fas fa-chevron-right text-slate-300 ml-auto group-hover:text-amber-500"></i>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
                  <i className="fas fa-book-open text-4xl"></i>
                  <p className="text-xs">Enter a dish name to find a recipe.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW MODE: RECIPE (AI Generated) */}
        {viewMode === 'RECIPE_AI' && renderAIRecipeContent()}

        {/* VIEW MODE: RECIPE (External API) */}
        {viewMode === 'RECIPE_EXT' && renderExternalRecipeContent()}

        {/* VIEW MODE: SMART RECOMMENDATION */}
        {viewMode === 'SMART_RECOMMEND' && renderSmartRecommendContent()}

        {/* VIEW MODE: WHEEL */}
        {viewMode === 'WHEEL' && (
          <>
            {/* FILTERS */}
            {!isSpinning && !showResult && (
              <div className="flex flex-col h-full gap-3 animate-fade-in">
                {/* Search & AI Buttons */}
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setViewMode('SEARCH')}
                    className="flex-1 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-500 flex items-center justify-center gap-2 hover:border-amber-300 hover:text-amber-500 transition-colors"
                  >
                    <i className="fas fa-search"></i> {t.privateSpace.leisure.chefWheel.searchMode}
                  </button>
                  <button
                    onClick={handleSmartRecommend}
                    disabled={loadingRecipe}
                    className="flex-1 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:shadow-lg shadow-indigo-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loadingRecipe ? (
                      <i className="fas fa-circle-notch fa-spin"></i>
                    ) : (
                      <i className="fas fa-brain"></i>
                    )}
                    {loadingRecipe
                      ? 'Thinking...'
                      : t.privateSpace.leisure.chefWheel.smartPlan.button}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 shrink-0">
                  <div className="col-span-2">
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                      {t.privateSpace.leisure.chefWheel.filters.category}
                    </label>
                    <select
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 uppercase outline-none"
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                    >
                      <option value="">
                        {t.privateSpace.leisure.chefWheel.filters.options.any}
                      </option>
                      <option value="午餐">
                        {t.privateSpace.leisure.chefWheel.filters.options.lunch}
                      </option>
                      <option value="晚餐">
                        {t.privateSpace.leisure.chefWheel.filters.options.dinner}
                      </option>
                      <option value="夜宵">
                        {t.privateSpace.leisure.chefWheel.filters.options.supper}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                      {t.privateSpace.leisure.chefWheel.filters.calories}
                    </label>
                    <select
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-600 outline-none"
                      value={filterCalories}
                      onChange={(e) => {
                        setFilterCalories(e.target.value);
                        if (e.target.value === 'low') setIsHealthy(true);
                        else setIsHealthy(false);
                      }}
                    >
                      <option value="">
                        {t.privateSpace.leisure.chefWheel.filters.options.any}
                      </option>
                      <option value="low">
                        {t.privateSpace.leisure.chefWheel.filters.options.low}
                      </option>
                      <option value="medium">
                        {t.privateSpace.leisure.chefWheel.filters.options.medium}
                      </option>
                      <option value="high">
                        {t.privateSpace.leisure.chefWheel.filters.options.high}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                      {t.privateSpace.leisure.chefWheel.filters.tags}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Spicy"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-600 outline-none placeholder:text-slate-300"
                      value={filterTag}
                      onChange={(e) => setFilterTag(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setIsHealthy(!isHealthy)}
                    className={`flex-1 py-2 px-1 rounded-lg border text-[10px] font-bold uppercase transition-all flex flex-col items-center justify-center gap-0.5 ${isHealthy ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-400'}`}
                  >
                    <div className="flex items-center gap-1">
                      {isHealthy && <i className="fas fa-check"></i>}
                      <span>{t.privateSpace.leisure.chefWheel.filters.healthy}</span>
                    </div>
                    <span className="text-[8px] font-normal normal-case opacity-70 text-center leading-tight">
                      {t.privateSpace.leisure.chefWheel.filters.tooltips.healthy}
                    </span>
                  </button>
                  <button
                    onClick={() => setIsCooldown(!isCooldown)}
                    className={`flex-1 py-2 px-1 rounded-lg border text-[10px] font-bold uppercase transition-all flex flex-col items-center justify-center gap-0.5 ${isCooldown ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-200 text-slate-400'}`}
                  >
                    <div className="flex items-center gap-1">
                      {isCooldown && <i className="fas fa-check"></i>}
                      <span>{t.privateSpace.leisure.chefWheel.filters.cooldown}</span>
                    </div>
                    <span className="text-[8px] font-normal normal-case opacity-70 text-center leading-tight">
                      {t.privateSpace.leisure.chefWheel.filters.tooltips.variety}
                    </span>
                  </button>
                </div>

                <div className="flex-1 flex items-center justify-center">
                  <div className="relative group cursor-pointer" onClick={handleDraw}>
                    <div className="absolute inset-0 bg-amber-400 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity animate-pulse"></div>
                    <button className="relative w-24 h-24 bg-gradient-to-tr from-amber-500 to-orange-400 rounded-full text-white shadow-xl flex flex-col items-center justify-center transform group-hover:scale-105 transition-all border-4 border-white/20">
                      <i className="fas fa-random text-3xl mb-1"></i>
                      <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                        {t.privateSpace.leisure.chefWheel.spin}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* WHEEL ANIMATION */}
            {(isSpinning || (pool.length > 0 && !showResult)) && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm animate-fade-in">
                <div className="relative w-64 h-64">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30 text-rose-500 text-4xl drop-shadow-md">
                    ▼
                  </div>
                  <div
                    className="w-full h-full rounded-full border-4 border-white shadow-2xl relative overflow-hidden"
                    style={{
                      transform: `rotate(${wheelRotation}deg)`,
                      transition: isSpinning
                        ? 'transform 3.5s cubic-bezier(0.1, 0, 0.2, 1)'
                        : 'none'
                    }}
                  >
                    <svg
                      viewBox="-1 -1 2 2"
                      style={{ transform: 'rotate(-90deg)' }}
                      className="w-full h-full"
                    >
                      {pool.map((item, index) => {
                        const count = pool.length;
                        const startAngle = index / count;
                        const endAngle = (index + 1) / count;
                        const [x1, y1] = getCoordinatesForPercent(startAngle);
                        const [x2, y2] = getCoordinatesForPercent(endAngle);
                        const largeArcFlag = 1 / count > 0.5 ? 1 : 0;
                        const pathData = `M 0 0 L ${x1} ${y1} A 1 1 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
                        return (
                          <g key={item._id}>
                            <path
                              d={pathData}
                              fill={WHEEL_COLORS[index % WHEEL_COLORS.length]}
                              stroke="white"
                              strokeWidth="0.01"
                            />
                          </g>
                        );
                      })}
                    </svg>
                    {pool.map((item, index) => {
                      const count = pool.length;
                      const rotation = (index + 0.5) * (360 / count);
                      return (
                        <div
                          key={item._id}
                          className="absolute top-0 left-0 w-full h-full pointer-events-none flex justify-center pt-2"
                          style={{ transform: `rotate(${rotation}deg)` }}
                        >
                          <span
                            className="text-[10px] font-bold text-slate-800 uppercase tracking-tight truncate max-w-[80px] bg-white/30 px-1 rounded backdrop-blur-[1px]"
                            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                          >
                            {item.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-inner flex items-center justify-center border-2 border-slate-100 z-20">
                    <i className="fas fa-utensils text-amber-500"></i>
                  </div>
                </div>
              </div>
            )}

            {/* WHEEL RESULT */}
            {showResult && winner && (
              <div className="absolute inset-0 z-30 flex flex-col bg-white animate-fade-in h-full overflow-y-auto custom-scrollbar p-4">
                <div className="text-center mb-4">
                  <div className="inline-block p-4 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 text-white shadow-lg animate-bounce">
                    <i className="fas fa-trophy text-3xl"></i>
                  </div>
                  <h2 className="text-2xl font-display font-bold text-slate-800 mt-2">
                    {winner.name}
                  </h2>
                  <div className="flex justify-center gap-2 mt-2">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold uppercase text-slate-500">
                      {winner.category}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase text-white ${winner.caloriesLevel === 'high' ? 'bg-red-400' : winner.caloriesLevel === 'low' ? 'bg-green-400' : 'bg-amber-400'}`}
                    >
                      {winner.caloriesLevel} Cal
                    </span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-4 items-center">
                  {winner.image && (
                    <div className="w-full h-40 rounded-xl overflow-hidden shadow-sm shrink-0">
                      <img
                        src={winner.image}
                        className="w-full h-full object-cover"
                        alt={winner.name}
                      />
                    </div>
                  )}

                  <button
                    onClick={handleViewRecipeAI}
                    disabled={loadingRecipe}
                    className="w-full py-4 border-2 border-amber-400 bg-amber-50 text-amber-600 rounded-xl font-bold text-sm uppercase hover:bg-amber-100 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    {loadingRecipe ? (
                      <i className="fas fa-circle-notch fa-spin"></i>
                    ) : (
                      <i className="fas fa-book-open"></i>
                    )}
                    {t.privateSpace.leisure.chefWheel.viewRecipe}
                  </button>
                </div>

                <div className="mt-auto pt-4 flex gap-3 shrink-0">
                  <button
                    onClick={handleReset}
                    className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs uppercase hover:bg-slate-200 transition-colors"
                  >
                    {t.privateSpace.leisure.chefWheel.retry}
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-colors"
                  >
                    {t.privateSpace.leisure.chefWheel.confirm}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MANAGE MODAL (Portal) */}
      {isManageModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in text-left text-slate-900">
            <div className="bg-white w-full max-w-lg max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <i className="fas fa-list-ul text-amber-500"></i>{' '}
                  {t.privateSpace.leisure.chefWheel.library}
                </h3>
                <div className="flex gap-2">
                  {!isEditing && (
                    <button
                      onClick={() => openEdit()}
                      className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white flex items-center justify-center transition-colors"
                    >
                      <i className="fas fa-plus"></i>
                    </button>
                  )}
                  <button
                    onClick={() => setIsManageModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 bg-white text-slate-900">
                <DeleteModal
                  isOpen={!!menuToDelete}
                  onClose={() => setMenuToDelete(null)}
                  onConfirm={confirmDeleteMenu}
                  title="Remove Dish?"
                  message="Are you sure you want to remove this dish from the menu?"
                  requireInput={false}
                  buttonText="Delete"
                  zIndexClass="z-[10000]"
                />

                {isEditing ? (
                  <form onSubmit={handleSaveMenu}>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                          {t.privateSpace.leisure.chefWheel.form.name}
                        </label>
                        <input
                          required
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                          value={editMenu.name || ''}
                          onChange={(e) => setEditMenu({ ...editMenu, name: e.target.value })}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                            {t.privateSpace.leisure.chefWheel.filters.category}
                          </label>
                          <select
                            className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none bg-white"
                            value={editMenu.category || '晚餐'}
                            onChange={(e) => setEditMenu({ ...editMenu, category: e.target.value })}
                          >
                            <option value="午餐">
                              {t.privateSpace.leisure.chefWheel.filters.options.lunch}
                            </option>
                            <option value="晚餐">
                              {t.privateSpace.leisure.chefWheel.filters.options.dinner}
                            </option>
                            <option value="夜宵">
                              {t.privateSpace.leisure.chefWheel.filters.options.supper}
                            </option>
                            <option value="随机">随机 (Random)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                            {t.privateSpace.leisure.chefWheel.filters.tags}
                          </label>
                          <input
                            className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none"
                            value={editMenu.tags?.join(', ') || ''}
                            onChange={(e) =>
                              setEditMenu({
                                ...editMenu,
                                tags: e.target.value.split(',').map((s) => s.trim())
                              })
                            }
                            placeholder="spicy, meat..."
                          />
                        </div>
                      </div>

                      {/* Added Weight (Priority) & Calories & Active Status */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                            {t.privateSpace.leisure.chefWheel.menu.weight}
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                            value={editMenu.weight || 1}
                            onChange={(e) =>
                              setEditMenu({ ...editMenu, weight: parseInt(e.target.value) })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                            {t.privateSpace.leisure.chefWheel.menu.calories}
                          </label>
                          <select
                            className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none bg-white"
                            value={editMenu.caloriesLevel || 'medium'}
                            onChange={(e) =>
                              setEditMenu({ ...editMenu, caloriesLevel: e.target.value as any })
                            }
                          >
                            <option value="low">
                              {t.privateSpace.leisure.chefWheel.filters.options.low}
                            </option>
                            <option value="medium">
                              {t.privateSpace.leisure.chefWheel.filters.options.medium}
                            </option>
                            <option value="high">
                              {t.privateSpace.leisure.chefWheel.filters.options.high}
                            </option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors w-full border border-slate-100">
                          <input
                            type="checkbox"
                            className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                            checked={editMenu.isActive ?? true}
                            onChange={(e) =>
                              setEditMenu({ ...editMenu, isActive: e.target.checked })
                            }
                          />
                          <span className="text-sm font-bold text-slate-700">
                            Active (Visible in Wheel)
                          </span>
                        </label>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                          {t.privateSpace.leisure.chefWheel.form.image}
                        </label>
                        <div className="flex gap-2">
                          <input
                            className="flex-1 border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none"
                            value={editMenu.image || ''}
                            onChange={(e) => setEditMenu({ ...editMenu, image: e.target.value })}
                            placeholder="https://..."
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors"
                          >
                            <i className="fas fa-upload"></i>
                          </button>
                          <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageUpload}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-500 font-bold text-sm hover:bg-slate-200 transition-colors"
                      >
                        {t.privateSpace.leisure.chefWheel.form.cancel}
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 shadow-lg shadow-amber-200 transition-colors"
                      >
                        {t.privateSpace.leisure.chefWheel.form.save}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3">
                    {menuList.length === 0 && (
                      <div className="text-center text-slate-400 py-10">No dishes yet.</div>
                    )}
                    {menuList.map((m) => (
                      <div
                        key={m._id}
                        className={`bg-white border border-slate-100 p-3 rounded-xl flex gap-3 items-center group shadow-sm hover:shadow-md transition-all ${!m.isActive ? 'opacity-60 grayscale' : ''}`}
                      >
                        <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden shrink-0 relative">
                          <img
                            src={m.image || 'https://via.placeholder.com/150'}
                            className="w-full h-full object-cover"
                            alt={m.name}
                            onError={(e) =>
                              ((e.target as HTMLImageElement).src =
                                'https://via.placeholder.com/150?text=Food')
                            }
                          />
                          {!m.isActive && (
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                              <i className="fas fa-ban text-white"></i>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-800 truncate">
                              {m.name}
                            </span>
                            {!m.isActive && (
                              <span className="text-[8px] bg-slate-200 text-slate-500 px-1.5 rounded uppercase font-bold">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                              {m.category}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-mono">
                              W:{m.weight}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded text-white ${m.caloriesLevel === 'high' ? 'bg-red-400' : m.caloriesLevel === 'low' ? 'bg-green-400' : 'bg-amber-400'}`}
                            >
                              {m.caloriesLevel}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(m)}
                            className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 hover:bg-blue-100 flex items-center justify-center transition-colors"
                          >
                            <i className="fas fa-pencil-alt text-xs"></i>
                          </button>
                          <button
                            onClick={() => setMenuToDelete(m._id)}
                            className="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors"
                          >
                            <i className="fas fa-trash text-xs"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
