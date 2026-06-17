import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, LayoutPanelLeft, AlertTriangle, Building2 } from "lucide-react";
import { knowledgeBasesApi, ndControlApi } from "@/api/endpoints";
import { FormSearchInput } from "@/components/form-controls";
import CreateDepartmentModal from "@/pages/CreateDepartmentModal";
import type { DepartmentStructuralDocumentCard, NdControlDepartment } from "@/types";
import DepartmentAnalysisProgress from "./nd-control/DepartmentAnalysisProgress";
import DepartmentAnalysisHistoryTab from "./nd-control/DepartmentAnalysisHistoryTab";
import DepartmentDocumentCardsTab from "./nd-control/DepartmentDocumentCardsTab";
import DepartmentOverviewTab from "./nd-control/DepartmentOverviewTab";
import DepartmentProcessesTab from "./nd-control/DepartmentProcessesTab";
import DepartmentRelationsTab from "./nd-control/DepartmentRelationsTab";
import DepartmentReviewTab from "./nd-control/DepartmentReviewTab";
import DepartmentSummaryHeader from "./nd-control/DepartmentSummaryHeader";
import DeptSidebarItem from "./nd-control/DeptSidebarItem";
import ReanalyzeConfirmDialog from "./nd-control/ReanalyzeConfirmDialog";
import { DEPARTMENT_TABS, isAnalysisRunning, type DepartmentTab } from "./nd-control/constants";
import styles from "./NdControlAgent.module.css";

function EmptyState({ icon: Icon, text }: { icon: typeof LayoutPanelLeft; text: string }) {
  return (
    <div className={styles.emptyState}>
      <Icon size={40} />
      <p>{text}</p>
    </div>
  );
}

export default function NdControlAgent() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DepartmentTab>("overview");
  const [search, setSearch] = useState("");
  const [showCreateDept, setShowCreateDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [deptPendingDelete, setDeptPendingDelete] = useState<NdControlDepartment | null>(null);
  const [showReanalyzeDialog, setShowReanalyzeDialog] = useState(false);
  const [selectedCard, setSelectedCard] = useState<DepartmentStructuralDocumentCard | null>(null);

  const permissions = useQuery({
    queryKey: ["nd-control", "permissions"],
    queryFn: () => ndControlApi.permissions()
  });

  const departments = useQuery({
    queryKey: ["nd-control", "departments"],
    queryFn: () => ndControlApi.listDepartments(),
    enabled: permissions.data?.can_access_agent ?? false
  });

  const knowledgeBases = useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: () => knowledgeBasesApi.list(),
    enabled: showCreateDept
  });

  const createDepartment = useMutation({
    mutationFn: () =>
      ndControlApi.createDepartment({
        name: newDeptName.trim(),
        knowledge_base_ids: selectedKbIds,
        auto_start_analysis: true
      }),
    onSuccess: async (response) => {
      setShowCreateDept(false);
      setNewDeptName("");
      setSelectedKbIds([]);
      setSelectedDeptId(response.department.id);
      await queryClient.invalidateQueries({ queryKey: ["nd-control"] });
    }
  });

  useEffect(() => {
    if (!selectedDeptId && departments.data?.length) {
      setSelectedDeptId(departments.data[0].id);
    }
  }, [departments.data, selectedDeptId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const deptFromUrl = params.get("department");
    if (deptFromUrl) setSelectedDeptId(deptFromUrl);
  }, [location.search]);

  const selectedDepartment = useMemo(
    () => departments.data?.find((dept) => dept.id === selectedDeptId) ?? null,
    [departments.data, selectedDeptId]
  );

  const analysisStatus = useQuery({
    queryKey: ["nd-control", "analysis-status", selectedDeptId],
    queryFn: () => ndControlApi.getDepartmentAnalysisStatus(selectedDeptId!),
    enabled: Boolean(selectedDeptId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return false;
      return isAnalysisRunning(status) ? 2500 : false;
    }
  });

  const departmentSummary = useQuery({
    queryKey: ["nd-control", "department-summary", selectedDeptId],
    queryFn: () => ndControlApi.getDepartmentSummary(selectedDeptId!),
    enabled: Boolean(selectedDeptId),
    refetchInterval: () => (isAnalysisRunning(analysisStatus.data?.status) ? 4000 : false)
  });

  const topProcesses = useQuery({
    queryKey: ["nd-control", "department-processes-top", selectedDeptId],
    queryFn: () => ndControlApi.listDepartmentProcesses(selectedDeptId!, { page: 1, size: 5 }),
    enabled: Boolean(selectedDeptId) && activeTab === "overview"
  });

  const showAnalysisScreen = Boolean(
    selectedDeptId &&
      (isAnalysisRunning(selectedDepartment?.analysis_status) || isAnalysisRunning(analysisStatus.data?.status))
  );

  const reanalyzeDepartment = useMutation({
    mutationFn: ({ departmentId, forceReextract }: { departmentId: string; forceReextract: boolean }) =>
      ndControlApi.startDepartmentAnalysis(departmentId, { force_reextract: forceReextract }),
    onSuccess: async () => {
      setShowReanalyzeDialog(false);
      await queryClient.invalidateQueries({ queryKey: ["nd-control"] });
    }
  });

  const deleteDepartment = useMutation({
    mutationFn: (departmentId: string) => ndControlApi.deleteDepartment(departmentId),
    onSuccess: async (_data, departmentId) => {
      setDeptPendingDelete(null);
      if (selectedDeptId === departmentId) {
        const remaining = (departments.data ?? []).filter((dept) => dept.id !== departmentId);
        setSelectedDeptId(remaining[0]?.id ?? null);
      }
      await queryClient.invalidateQueries({ queryKey: ["nd-control"] });
    }
  });

  const confirmOwner = useMutation({
    mutationFn: (processId: string) => ndControlApi.confirmProcessOwner(processId, {}),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["nd-control"] })
  });

  const searchVisible = activeTab !== "overview" && activeTab !== "history";

  if (permissions.isLoading) return <div className={styles.page}>Загрузка…</div>;
  if (!permissions.data?.can_access_agent) {
    return (
      <div className={styles.page}>
        <EmptyState icon={LayoutPanelLeft} text="Нет доступа к агенту контроля НД." />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Агент контроля НД и внесения изменений</h1>
          <p>Анализ нормативных документов отделов, процессов и связей между ними.</p>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2>Отделы агента</h2>
            {permissions.data.can_manage_departments ? (
              <button type="button" className={styles.iconBtn} onClick={() => setShowCreateDept(true)} aria-label="Создать отдел">
                <Plus size={18} />
              </button>
            ) : null}
          </div>
          {departments.isLoading ? (
            <p className={styles.emptyHint}>Загрузка отделов…</p>
          ) : !departments.data?.length ? (
            <EmptyState icon={Building2} text="Создайте первый отдел и прикрепите к нему базу знаний." />
          ) : (
            <div className={styles.deptList}>
              {departments.data.map((dept) => (
                <DeptSidebarItem
                  key={dept.id}
                  dept={dept}
                  selected={dept.id === selectedDeptId}
                  canManage={permissions.data.can_manage_departments}
                  onSelect={() => setSelectedDeptId(dept.id)}
                  onDelete={() => setDeptPendingDelete(dept)}
                />
              ))}
            </div>
          )}
        </aside>

        <main className={styles.main}>
          {!selectedDeptId ? (
            <EmptyState icon={LayoutPanelLeft} text="Выберите отдел слева." />
          ) : showAnalysisScreen ? (
            <DepartmentAnalysisProgress status={analysisStatus.data} isLoading={analysisStatus.isLoading} />
          ) : (
            <>
              {departmentSummary.data ? (
                <DepartmentSummaryHeader
                  summary={departmentSummary.data}
                  isReanalyzing={reanalyzeDepartment.isPending}
                  onReanalyze={() => setShowReanalyzeDialog(true)}
                  onOpenReview={() => setActiveTab("review")}
                />
              ) : null}

              {analysisStatus.data?.status === "failed" ? (
                <div className={styles.analysisError}>
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Ошибка анализа</strong>
                    <p>{analysisStatus.data.message ?? "Не удалось завершить анализ отдела."}</p>
                    <button type="button" className={styles.secondaryBtn} onClick={() => setShowReanalyzeDialog(true)}>
                      Повторить анализ
                    </button>
                  </div>
                </div>
              ) : null}

              <div className={styles.tabBar}>
                {DEPARTMENT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ""}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                    {tab.id === "review" && (departmentSummary.data?.pending_review_count ?? 0) > 0 ? (
                      <span className={styles.tabBadge}>{departmentSummary.data?.pending_review_count}</span>
                    ) : null}
                  </button>
                ))}
              </div>

              {searchVisible ? (
                <div className={styles.toolbar}>
                  <FormSearchInput value={search} onChange={setSearch} placeholder="Поиск по текущей вкладке…" />
                </div>
              ) : null}

              {activeTab === "overview" && departmentSummary.data ? (
                <DepartmentOverviewTab
                  summary={departmentSummary.data}
                  topProcesses={topProcesses.data?.items ?? []}
                  onShowAllProcesses={() => setActiveTab("processes")}
                  onOpenReview={() => setActiveTab("review")}
                />
              ) : null}
              {activeTab === "documents" ? (
                <DepartmentDocumentCardsTab
                  departmentId={selectedDeptId}
                  search={search}
                  onOpenCard={setSelectedCard}
                  onReextract={() => setShowReanalyzeDialog(true)}
                />
              ) : null}
              {activeTab === "processes" ? (
                <DepartmentProcessesTab
                  departmentId={selectedDeptId}
                  search={search}
                  onConfirmOwner={(processId) => confirmOwner.mutate(processId)}
                />
              ) : null}
              {activeTab === "relations" ? (
                <DepartmentRelationsTab departmentId={selectedDeptId} search={search} />
              ) : null}
              {activeTab === "review" ? (
                <DepartmentReviewTab departmentId={selectedDeptId} search={search} />
              ) : null}
              {activeTab === "history" ? (
                <DepartmentAnalysisHistoryTab
                  departmentId={selectedDeptId}
                  onReanalyze={() => setShowReanalyzeDialog(true)}
                />
              ) : null}
            </>
          )}
        </main>
      </div>

      {showCreateDept ? (
        <CreateDepartmentModal
          open={showCreateDept}
          name={newDeptName}
          selectedKbIds={selectedKbIds}
          knowledgeBases={knowledgeBases.data ?? []}
          isSubmitting={createDepartment.isPending}
          onNameChange={setNewDeptName}
          onSelectedKbIdsChange={setSelectedKbIds}
          onClose={() => setShowCreateDept(false)}
          onSubmit={() => createDepartment.mutate()}
        />
      ) : null}

      <ReanalyzeConfirmDialog
        open={showReanalyzeDialog}
        onClose={() => setShowReanalyzeDialog(false)}
        isPending={reanalyzeDepartment.isPending}
        onConfirm={({ forceReextract }) => {
          if (!selectedDeptId) return;
          reanalyzeDepartment.mutate({ departmentId: selectedDeptId, forceReextract });
        }}
      />

      {selectedCard ? (
        <div className={styles.modalOverlay} onClick={() => setSelectedCard(null)}>
          <div className={styles.modalCardWide} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{selectedCard.title ?? selectedCard.file_name ?? "Карточка документа"}</h2>
              <button type="button" className={styles.iconBtn} onClick={() => setSelectedCard(null)}>
                ×
              </button>
            </div>
            <div className={styles.cardDetailGrid}>
              <div><span>Код</span><strong>{selectedCard.document_code ?? "—"}</strong></div>
              <div><span>Тип</span><strong>{selectedCard.document_type ?? "—"}</strong></div>
              <div><span>Версия</span><strong>{selectedCard.version ?? "—"}</strong></div>
              <div><span>Статус извлечения</span><strong>{selectedCard.extraction_status}</strong></div>
              <div className={styles.cardDetailFull}>
                <span>Назначение</span>
                <p>{selectedCard.purpose ?? "—"}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deptPendingDelete ? (
        <div className={styles.modalOverlay} onClick={() => setDeptPendingDelete(null)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <h2>Удалить отдел «{deptPendingDelete.name}»?</h2>
            <p className={styles.modalText}>Отдел и связанные данные анализа будут удалены.</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setDeptPendingDelete(null)}>
                Отмена
              </button>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={() => deleteDepartment.mutate(deptPendingDelete.id)}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
