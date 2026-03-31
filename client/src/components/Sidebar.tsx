/**
 * TTP2026 战略看板 - 侧边栏导航
 * 深墨色底 + 朱红高亮 + 部门平铺列表
 */
import type { Committee } from "@/data/kanbanData";

interface SidebarProps {
  committees: Committee[];
  activeId: string;
  onSelect: (id: string) => void;
  showOverview?: boolean;
}

export default function Sidebar({
  committees,
  activeId,
  onSelect,
  showOverview = true,
}: SidebarProps) {
  const isOverviewActive = activeId === "overview";

  return (
    <aside className="w-52 min-h-screen flex flex-col border-r border-[#2d2d4e]" style={{ background: 'oklch(0.14 0.012 60)' }}>
      {/* Logo 区域 */}
      <div className="px-4 py-5 border-b border-[#2d2d4e]">
        <div className="font-bold text-lg tracking-wider" style={{ color: 'oklch(0.62 0.22 22)' }}>TTP2026</div>
        <div className="text-xs mt-0.5" style={{ color: 'oklch(0.55 0.01 60)' }}>战略看板系统</div>
      </div>

      {/* 导航列表 */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {/* 战略总览（仅管理员可见） */}
        {showOverview && (
          <button
            onClick={() => onSelect("overview")}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
            style={{
              background: isOverviewActive ? 'oklch(0.62 0.22 22 / 0.15)' : 'transparent',
              color: isOverviewActive ? 'oklch(0.62 0.22 22)' : 'oklch(0.65 0.01 60)',
              borderRight: isOverviewActive ? '2px solid oklch(0.62 0.22 22)' : '2px solid transparent',
            }}
            onMouseEnter={e => {
              if (!isOverviewActive) {
                (e.currentTarget as HTMLButtonElement).style.background = 'oklch(0.20 0.012 60)';
                (e.currentTarget as HTMLButtonElement).style.color = 'oklch(0.92 0.004 60)';
              }
            }}
            onMouseLeave={e => {
              if (!isOverviewActive) {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color = 'oklch(0.65 0.01 60)';
              }
            }}
          >
            <span className="text-base">🎯</span>
            <span className="font-medium">战略总览</span>
          </button>
        )}

        {/* 分隔线 */}
        {showOverview && <div className="mx-4 my-2 border-t border-[#2d2d4e]" />}

        {/* 平铺所有部门 */}
        {committees.map((dept: Committee) => {
          const isActive = activeId === dept.id && !isOverviewActive;
          return (
            <button
              key={dept.id}
              onClick={() => onSelect(dept.id)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
              style={{
                background: isActive ? 'oklch(0.62 0.22 22 / 0.15)' : 'transparent',
                color: isActive ? 'oklch(0.62 0.22 22)' : 'oklch(0.65 0.01 60)',
                borderRight: isActive ? '2px solid oklch(0.62 0.22 22)' : '2px solid transparent',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'oklch(0.20 0.012 60)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'oklch(0.92 0.004 60)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = 'oklch(0.65 0.01 60)';
                }
              }}
            >
              <span className="text-base">{dept.icon || "🏢"}</span>
              <span className="truncate">{dept.shortName}</span>
            </button>
          );
        })}
      </nav>

      {/* 底部版本信息 */}
      <div className="px-4 py-3 border-t border-[#2d2d4e]">
        <div className="text-xs" style={{ color: 'oklch(0.40 0.008 60)' }}>v2.0 Python+MySQL</div>
      </div>
    </aside>
  );
}
