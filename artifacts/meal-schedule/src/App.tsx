import { useState, useEffect } from "react";
import Today from "@/pages/Today";
import TodayMenu from "@/pages/TodayMenu";
import Week from "@/pages/Week";
import Month from "@/pages/Month";
import Admin from "@/pages/Admin";

type Tab = "checkin" | "today" | "week" | "month" | "admin";

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "checkin", label: "식수체크", icon: "✅" },
  { id: "today", label: "오늘", icon: "☀️" },
  { id: "week", label: "이번주", icon: "📅" },
  { id: "month", label: "이번달", icon: "🗓️" },
  { id: "admin", label: "관리", icon: "⚙️" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("checkin");

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        background: "hsl(var(--background))",
        color: "hsl(var(--foreground))",
        position: "relative",
      }}
    >
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {activeTab === "checkin" && <Today />}
        {activeTab === "today" && <TodayMenu />}
        {activeTab === "week" && <Week />}
        {activeTab === "month" && <Month />}
        {activeTab === "admin" && <Admin />}
      </main>

      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "hsl(0 0% 8% / 0.95)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderTop: "1px solid hsl(var(--border))",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          display: "flex",
          zIndex: 100,
        }}
        data-testid="bottom-nav"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              data-testid={`nav-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "2px",
                paddingTop: "9px",
                paddingBottom: "9px",
                background: "none",
                border: "none",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                position: "relative",
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 28,
                    height: 2,
                    borderRadius: "0 0 2px 2px",
                    background: "hsl(160 84% 39%)",
                  }}
                />
              )}
              <span
                style={{
                  fontSize: "17px",
                  lineHeight: 1,
                  filter: isActive ? "none" : "grayscale(1) opacity(0.35)",
                }}
              >
                {tab.icon}
              </span>
              <span
                style={{
                  fontSize: "9.5px",
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? "hsl(160 84% 39%)" : "hsl(var(--muted-foreground))",
                  letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
