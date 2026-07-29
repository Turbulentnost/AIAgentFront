import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { syncEskdAuthFromPlatformUser } from "@/features/eskd/api/client";
import styles from "@/features/eskd/App.module.css";
import EskdAgentPage from "@/features/eskd/pages/EskdAgentPage";
import HistoryPage from "@/features/eskd/pages/HistoryPage";
import IntegrationLogPage from "@/features/eskd/pages/IntegrationLogPage";
import KnowledgeBasePage from "@/features/eskd/pages/KnowledgeBasePage";
import MarkingPage from "@/features/eskd/pages/MarkingPage";
import StatsPage from "@/features/eskd/pages/StatsPage";
import type { AppTab } from "@/features/eskd/navigation";
import { APP_TABS } from "@/features/eskd/navigation";
import type { MarkingOpenIntent } from "@/features/eskd/types/markingOpen";
import ModelStatusIndicator from "@/features/eskd/components/ModelStatusIndicator";
import subNavStyles from "@/features/eskd/components/EskdSubNav.module.css";

export default function EskdAgent() {
  const { user } = useAuth();
  const [tab, setTab] = useState<AppTab>("check");
  const [markingIntent, setMarkingIntent] = useState<MarkingOpenIntent | null>(null);
  const [checkRunId, setCheckRunId] = useState<string | null>(null);

  useEffect(() => {
    if (user) syncEskdAuthFromPlatformUser(user);
  }, [user]);

  const openMarkingDocument = useCallback((documentId: string) => {
    setMarkingIntent({ type: "document", documentId });
    setTab("marking");
  }, []);

  const openMarkingFromCheck = useCallback((checkRunId: string, filename: string) => {
    setMarkingIntent({ type: "checkRun", checkRunId, filename });
    setTab("marking");
  }, []);

  const clearMarkingIntent = useCallback(() => {
    setMarkingIntent(null);
  }, []);

  const clearCheckRunIntent = useCallback(() => {
    setCheckRunId(null);
  }, []);

  return (
    <div className={subNavStyles.workspace}>
      <div className={subNavStyles.tabsBar}>
        <nav className={subNavStyles.tabs} aria-label="Разделы ESKD Agent">
          {APP_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${subNavStyles.tab} ${tab === item.id ? subNavStyles.tabActive : ""}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <ModelStatusIndicator />
      </div>

      <div className={tab === "check" ? styles.panel : styles.panelHidden}>
        <EskdAgentPage openCheckRunId={checkRunId} onOpenCheckHandled={clearCheckRunIntent} />
      </div>
      <div className={tab === "history" ? styles.panel : styles.panelHidden}>
        <HistoryPage />
      </div>
      <div className={tab === "marking" ? styles.panel : styles.panelHidden}>
        <MarkingPage openIntent={markingIntent} onOpenIntentHandled={clearMarkingIntent} />
      </div>
      <div className={tab === "knowledge" ? styles.panel : styles.panelHidden}>
        <KnowledgeBasePage
          onOpenMarking={openMarkingDocument}
          onOpenMarkingFromCheck={openMarkingFromCheck}
        />
      </div>
      <div className={tab === "stats" ? styles.panel : styles.panelHidden}>
        <StatsPage />
      </div>
      <div className={tab === "integration" ? styles.panel : styles.panelHidden}>
        <IntegrationLogPage />
      </div>
    </div>
  );
}
