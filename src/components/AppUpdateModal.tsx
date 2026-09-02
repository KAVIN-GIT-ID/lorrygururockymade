import { createSignal, onMount, onCleanup } from 'solid-js';

import { Download, Sparkles, X, ChevronRight, Info, ChevronLeft, Wrench, RefreshCw, CheckCircle2 } from 'lucide-solid';

interface AppUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
}

const parseChangelogLine = (line: string) => {
  let clean = line.replace(/^[\s\-*•+>]+/g, '').trim();
  const tags = [
    '[new]', '[added]', '[feature]', 'new:', 'added:', 'feature:',
    '[changed]', '[removed]', '[updated]', '[improved]', 'changed:', 'removed:', 'updated:', 'improved:',
    '[fixed]', '[bugfix]', '[fix]', 'fixed:', 'bugfix:', 'fix:'
  ];
  
  const lower = clean.toLowerCase();
  for (const tag of tags) {
    if (lower.startsWith(tag)) {
      clean = clean.slice(tag.length).trim();
      break;
    }
  }

  const colonIdx = clean.indexOf(':');
  if (colonIdx > 0 && colonIdx < 30) {
    return {
      title: clean.substring(0, colonIdx).trim(),
      description: clean.substring(colonIdx + 1).trim()
    };
  }

  const words = clean.split(/\s+/);
  if (words.length > 3) {
    return {
      title: words.slice(0, 3).join(' '),
      description: words.slice(3).join(' ')
    };
  }

  return { title: clean, description: '' };
};

export default function AppUpdateModal({
  isOpen,
  onClose,
  currentVersion,
  latestVersion,
  releaseNotes,
  downloadUrl
}: AppUpdateModalProps) {
  const [currentSlide, setCurrentSlide] = createSignal(0);
  let scrollContainerRef: HTMLDivElement | undefined;
  let isProgrammaticScroll: any;
  let scrollTimeoutRef: NodeJS.Timeout | null | undefined;

  if (!isOpen) return null;

  const handleScroll = () => {
    if (isProgrammaticScroll) return;
    
    if (scrollContainerRef) {
      const { scrollLeft, clientWidth } = scrollContainerRef;
      if (clientWidth > 0) {
        const index = Math.round(scrollLeft / clientWidth);
        if (index !== currentSlide() && index >= 0) {
          setCurrentSlide(index);
        }
      }
    }
  };

  const scrollToSlide = (idx: number) => {
    if (scrollContainerRef) {
      isProgrammaticScroll = true;
      if (scrollTimeoutRef) clearTimeout(scrollTimeoutRef);
      
      scrollContainerRef.scrollTo({
        left: idx * scrollContainerRef.clientWidth,
        behavior: 'smooth'
      });
      setCurrentSlide(idx);

      scrollTimeoutRef = setTimeout(() => {
        isProgrammaticScroll = false;
      }, 500);
    }
  };

  const handleDownload = () => {
    if (!downloadUrl) {
      alert("Download link is not configured.");
      return;
    }
    window.open(downloadUrl, '_system');
  };

  const isDowngrade = () => {
    if (!currentVersion || !latestVersion) return false;
    const currParts = currentVersion.split('.').map(Number);
    const lateParts = latestVersion.split('.').map(Number);
    for (let i = 0; i < Math.max(currParts.length, lateParts.length); i++) {
      const curr = currParts[i] || 0;
      const late = lateParts[i] || 0;
      if (curr > late) return true;
      if (late > curr) return false;
    }
    return false;
  };

  const downgrade = isDowngrade();

  // Parse notes
  const lines = releaseNotes
    ? releaseNotes
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0)
    : [];

  const newItems: { title: string; description: string }[] = [];
  const changedItems: { title: string; description: string }[] = [];
  const fixedItems: { title: string; description: string }[] = [];
  const otherItems: { title: string; description: string }[] = [];

  lines.forEach(line => {
    const parsed = parseChangelogLine(line);
    if (!parsed.title) return;

    const lower = line.toLowerCase();
    let matched = false;

    const newTags = ['[new]', '[added]', '[feature]', 'new:', 'added:', 'feature:'];
    const changedTags = ['[changed]', '[removed]', '[updated]', '[improved]', 'changed:', 'removed:', 'updated:', 'improved:'];
    const fixedTags = ['[fixed]', '[bugfix]', '[fix]', 'fixed:', 'bugfix:', 'fix:'];

    for (const tag of newTags) {
      if (lower.startsWith(tag)) {
        newItems.push(parsed);
        matched = true;
        break;
      }
    }
    if (matched) return;

    for (const tag of changedTags) {
      if (lower.startsWith(tag)) {
        changedItems.push(parsed);
        matched = true;
        break;
      }
    }
    if (matched) return;

    for (const tag of fixedTags) {
      if (lower.startsWith(tag)) {
        fixedItems.push(parsed);
        matched = true;
        break;
      }
    }
    if (matched) return;

    // Fallback based on keywords
    if (lower.includes('fix') || lower.includes('bug') || lower.includes('issue') || lower.includes('error') || lower.includes('resolve')) {
      fixedItems.push(parsed);
    } else if (lower.includes('change') || lower.includes('remove') || lower.includes('update') || lower.includes('improv') || lower.includes('replace') || lower.includes('delete') || lower.includes('refactor')) {
      changedItems.push(parsed);
    } else if (lower.includes('add') || lower.includes('new') || lower.includes('create') || lower.includes('introduc')) {
      newItems.push(parsed);
    } else {
      otherItems.push(parsed);
    }
  });

  // Consolidate slides
  const slides: {
    title: string;
    subtitle: string;
    themeColor: string;
    textColor: string;
    icon: any;
    items: { title: string; description: string }[];
  }[] = [];

  // Slide 1: What's New / Added
  const combinedNew = [...newItems, ...(changedItems.length === 0 && fixedItems.length === 0 ? otherItems : [])];
  if (combinedNew.length > 0 || lines.length === 0) {
    slides.push({
      title: "What's New",
      subtitle: downgrade ? "System Revert & Downgrade Features" : "Exciting new features and updates",
      themeColor: "emerald",
      textColor: "text-emerald-600 dark:text-emerald-400",
      icon: <Sparkles class="w-6 h-6 text-emerald-500" />,
      items: combinedNew.length > 0 ? combinedNew : [{ title: "Lorry Guru Update", description: `Version v${latestVersion} release notes update details.` }]
    });
  }

  // Slide 2: Changes
  if (changedItems.length > 0) {
    slides.push({
      title: "Improvements",
      subtitle: "System enhancements & interface tweaks",
      themeColor: "blue",
      textColor: "text-blue-600 dark:text-blue-400",
      icon: <RefreshCw class="w-5 h-5 text-blue-500" />,
      items: changedItems
    });
  }

  // Slide 3: Bug Fixes
  if (fixedItems.length > 0) {
    slides.push({
      title: "Bug Fixes",
      subtitle: "Resolved issues & performance stability",
      themeColor: "amber",
      textColor: "text-amber-600 dark:text-amber-400",
      icon: <Wrench class="w-5 h-5 text-amber-500" />,
      items: fixedItems
    });
  }

  // Slide 4: Other (if not merged)
  if (otherItems.length > 0 && (changedItems.length > 0 || fixedItems.length > 0)) {
    slides.push({
      title: "Other Details",
      subtitle: "General release notes and system configuration",
      themeColor: "slate",
      textColor: "text-slate-600 dark:text-slate-400",
      icon: <CheckCircle2 class="w-5 h-5 text-slate-500" />,
      items: otherItems
    });
  }

  const activeSlide = slides[currentSlide()] || slides[0];
  const totalSlides = slides.length;
  const isFinalSlide = currentSlide() === totalSlides - 1;

  const handleNext = () => {
    if (isFinalSlide) {
      handleDownload();
    } else {
      setCurrentSlide(prev => Math.min(prev + 1, totalSlides - 1));
    }
  };

  return (
    <div class="fixed inset-0 z-250 flex items-start justify-center p-4 bg-slate-955/65 backdrop-blur-md animate-fade-in overflow-y-auto py-8">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden flex flex-col gap-6 text-left font-sans animate-scale-up my-auto min-h-[500px]">
        
        {/* Decorative background glows */}
        <div class="absolute -top-12 -right-12 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl"></div>
        <div class="absolute -bottom-12 -left-12 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl"></div>

        {/* Header navigation bar */}
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-3 relative z-10">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-400 font-mono">
              Lorry Guru v{latestVersion}
            </span>
          </div>
          <button
            onClick={onClose}
            class="text-slate-400 hover:text-slate-655 dark:hover:text-slate-200 p-1 rounded-xl transition cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        {/* Carousel Screen - Scrollable container */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          class="flex-1 flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar relative z-10 w-full"
        >
          {slides.map((slide, slideIdx) => (
            <div  class="w-full shrink-0 snap-center px-1 flex flex-col gap-5 justify-between">
              <div class="space-y-5">
                {/* Title Section */}
                <div class="text-center space-y-1">
                  <h2 class="text-xl font-black text-slate-850 dark:text-white flex items-center justify-center gap-2">
                    {slide.icon}
                    <span>{slide.title}</span>
                  </h2>
                  <p class="text-[11px] text-slate-450 dark:text-slate-550 font-semibold">{slide.subtitle}</p>
                </div>

                {/* List Section: iOS Styled Row Layout */}
                <div class="space-y-4 max-h-[250px] overflow-y-auto pr-1">
                  {slide.items.map((item, idx) => (
                    <div  class="flex gap-3.5 items-start">
                      <div class="flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-850/50 border border-slate-100 dark:border-slate-800 shrink-0 text-slate-500 dark:text-slate-400 font-bold text-xs shadow-xs mt-0.5">
                        {idx + 1}
                      </div>
                      <div class="space-y-0.5">
                        <h4 class="text-xs font-bold text-slate-850 dark:text-slate-200 leading-tight">
                          {item.title}
                        </h4>
                        {item.description && (
                          <p class="text-[11px] text-slate-450 dark:text-slate-400 leading-relaxed font-medium">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dot Indicators */}
        {totalSlides > 1 && (
          <div class="flex justify-center items-center gap-2 mt-2 relative z-10">
            {slides.map((_, idx) => (
              <button
                
                onClick={() => scrollToSlide(idx)}
                class={`h-1.5 rounded-full transition-all duration-300 ${
                  currentSlide() === idx 
                    ? 'w-4 bg-blue-600 dark:bg-blue-500' 
                    : 'w-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-350'
                }`}
              />
            ))}
          </div>
        )}

        {/* Warning Banner */}
        <div class="flex gap-2 items-start text-[9px] text-slate-500 leading-relaxed border-t border-slate-100 dark:border-slate-850 pt-3 relative z-10">
          <Info class="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
          <p>
            {downgrade
              ? 'The downgrade package will download directly. Click Continue to final slide to install the revert package.'
              : 'The update package will download directly in the background. Complete the carousel to trigger the installation.'}
          </p>
        </div>

        {/* Action button */}
        <div class="flex gap-3 items-center relative z-10">
          {currentSlide() > 0 && (
            <button
              onClick={() => scrollToSlide(Math.max(0, currentSlide() - 1))}
              class="h-11 px-4 border border-slate-250 dark:border-slate-800 text-slate-655 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-2xl flex items-center justify-center font-bold text-xs transition cursor-pointer"
            >
              <ChevronLeft class="w-4 h-4" />
            </button>
          )}
          
          <button
            onClick={handleNext}
            class="flex-1 h-11 text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/10 rounded-2xl flex items-center justify-center gap-1.5 font-bold text-xs transition active:scale-98 cursor-pointer"
          >
            {isFinalSlide ? <Download class="w-4 h-4" /> : null}
            <span>{isFinalSlide ? (downgrade ? "Downgrade & Revert Now" : "Download & Install Now") : "Continue"}</span>
            {!isFinalSlide ? <ChevronRight class="w-4 h-4" /> : null}
          </button>
        </div>

      </div>
    </div>
  );
}
