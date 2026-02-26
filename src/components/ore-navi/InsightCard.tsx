import { useCallback } from "react";
import type { Insight, SectionType } from "@/lib/ore-navi-types";

interface InsightCardProps {
  insight: Insight;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  isPlaying: boolean;
  isPaused?: boolean;
  currentSection: SectionType | null;
  onSectionClick: (section: SectionType) => void;
  setSectionRef: (section: string, el: HTMLDivElement | null) => void;
}

function getImpactIcon(impact: string) {
  if (impact === "+" || impact.includes("+") || impact.toLowerCase().includes("positive")) return "↑";
  if (impact === "-" || impact.includes("-") || impact.toLowerCase().includes("negative")) return "↓";
  return "→";
}

function getImpactColor(impact: string) {
  if (impact === "+" || impact.includes("+") || impact.toLowerCase().includes("positive")) return "text-emerald-600 dark:text-emerald-400";
  if (impact === "-" || impact.includes("-") || impact.toLowerCase().includes("negative")) return "text-red-600 dark:text-red-400";
  return "text-gray-500 dark:text-gray-400";
}

function getHighlightStyle(currentSection: SectionType | null, section: SectionType) {
  if (currentSection === section) {
    return "ring-2 ring-amber-400 bg-amber-900/30 shadow-lg shadow-amber-500/20 scale-[1.01]";
  }
  return "";
}

export function InsightCard({
  insight,
  index,
  isExpanded,
  onToggle,
  isPlaying,
  isPaused,
  currentSection,
  onSectionClick,
  setSectionRef,
}: InsightCardProps) {
  const audioActive = isPlaying || isPaused;
  const titleKey = `insight-${index}-title`;
  const contentKey = `insight-${index}-content`;
  const whyNowKey = `insight-${index}-why_now`;
  const whyYouKey = `insight-${index}-why_you`;
  const actionKey = `insight-${index}-action`;
  const riskKey = `insight-${index}-risk`;

  const highlight = useCallback(
    (section: SectionType) => getHighlightStyle(currentSection, section),
    [currentSection]
  );

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {/* タイトル部分 */}
      <div
        ref={(el) => setSectionRef(titleKey, el)}
        onClick={() => {
          if (audioActive) {
            onSectionClick(titleKey);
          } else {
            onToggle();
          }
        }}
        className={`p-4 cursor-pointer hover:bg-slate-800/50 transition-all duration-300 ${highlight(titleKey)}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="text-amber-400 font-bold text-lg">#{index + 1}</span>
            <div>
              <h3 className="font-semibold text-white">{insight.title}</h3>
              {!isExpanded && (
                <p className="text-slate-400 text-sm mt-1 line-clamp-2">{insight.content}</p>
              )}
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-800 pt-4 space-y-4">
          {/* 内容 */}
          <div
            ref={(el) => setSectionRef(contentKey, el)}
            onClick={() => audioActive && onSectionClick(contentKey)}
            className={`p-3 rounded-lg transition-all duration-300 ${highlight(contentKey)} ${audioActive ? "cursor-pointer hover:ring-1 hover:ring-amber-500/50" : ""}`}
          >
            <p className="text-slate-300">{insight.content}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            {/* なぜ今か */}
            <div
              ref={(el) => setSectionRef(whyNowKey, el)}
              onClick={() => audioActive && onSectionClick(whyNowKey)}
              className={`p-3 bg-slate-800/50 rounded-lg transition-all duration-300 ${highlight(whyNowKey)} ${audioActive ? "cursor-pointer hover:ring-1 hover:ring-amber-500/50" : ""}`}
            >
              <p className="text-slate-500 mb-1">なぜ今か</p>
              <p className="text-slate-300">{insight.why_now}</p>
            </div>
            {/* なぜ俺か */}
            <div
              ref={(el) => setSectionRef(whyYouKey, el)}
              onClick={() => audioActive && onSectionClick(whyYouKey)}
              className={`p-3 bg-slate-800/50 rounded-lg transition-all duration-300 ${highlight(whyYouKey)} ${audioActive ? "cursor-pointer hover:ring-1 hover:ring-amber-500/50" : ""}`}
            >
              <p className="text-slate-500 mb-1">なぜ俺か</p>
              <p className="text-slate-300">{insight.why_you}</p>
            </div>
          </div>

          {/* 次の一手 */}
          <div
            ref={(el) => setSectionRef(actionKey, el)}
            onClick={() => audioActive && onSectionClick(actionKey)}
            className={`p-3 bg-amber-900/20 border border-amber-800/50 rounded-lg transition-all duration-300 ${highlight(actionKey)} ${audioActive ? "cursor-pointer hover:ring-1 hover:ring-amber-500/50" : ""}`}
          >
            <p className="text-amber-400 text-sm mb-1">次の一手</p>
            <p className="text-white">{insight.action}</p>
          </div>

          {/* リスク */}
          {insight.risk && (
            <div
              ref={(el) => setSectionRef(riskKey, el)}
              onClick={() => audioActive && onSectionClick(riskKey)}
              className={`p-3 bg-red-900/20 border border-red-800/50 rounded-lg transition-all duration-300 ${highlight(riskKey)} ${audioActive ? "cursor-pointer hover:ring-1 hover:ring-amber-500/50" : ""}`}
            >
              <p className="text-red-400 text-sm mb-1">リスク・盲点</p>
              <p className="text-slate-300">{insight.risk}</p>
            </div>
          )}

          {/* LifeValue影響 */}
          <div className="flex flex-wrap gap-3 pt-2">
            <div className={`flex items-center gap-1 text-sm ${getImpactColor(insight.lifevalue_impact.reward)}`}>
              <span>{getImpactIcon(insight.lifevalue_impact.reward)}</span>
              <span>報酬系</span>
            </div>
            <div className={`flex items-center gap-1 text-sm ${getImpactColor(insight.lifevalue_impact.freedom)}`}>
              <span>{getImpactIcon(insight.lifevalue_impact.freedom)}</span>
              <span>Freedom</span>
            </div>
            <div className={`flex items-center gap-1 text-sm ${getImpactColor(insight.lifevalue_impact.stress)}`}>
              <span>{getImpactIcon(insight.lifevalue_impact.stress)}</span>
              <span>Stress</span>
            </div>
            <div className={`flex items-center gap-1 text-sm ${getImpactColor(insight.lifevalue_impact.meaning)}`}>
              <span>{getImpactIcon(insight.lifevalue_impact.meaning)}</span>
              <span>Meaning</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
