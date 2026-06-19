import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, LayoutPanelLeft, AlertTriangle, Building2, FileStack, History } from "lucide-react";
import { knowledgeBasesApi, ndControlApi } from "@/api/endpoints";
import { FormSearchInput } from "@/components/form-controls";
import CreateDepartmentModal from "@/pages/CreateDepartmentModal";
import type { DepartmentStructuralDocumentCard, DepartmentProcessItem, NdControlDepartment } from "@/types";
import DepartmentAnalysisProgress from "./nd-control/DepartmentAnalysisProgress";
import DepartmentAnalysisHistoryTab from "./nd-control/DepartmentAnalysisHistoryTab";
import DepartmentDocumentCardsTab from "./nd-control/DepartmentDocumentCardsTab";
import DepartmentOverviewTab from "./nd-control/DepartmentOverviewTab";
import DepartmentProcessesTab from "./nd-control/DepartmentProcessesTab";
import DepartmentRelationsTab from "./nd-control/DepartmentRelationsTab";
import DepartmentReviewTab from "./nd-control/DepartmentReviewTab";
import DepartmentSummaryHeader from "./nd-control/DepartmentSummaryHeader";
import DeptSidebarItem from "./nd-control/DeptSidebarItem";
import NdChangeJournalPanel from "./nd-control/NdChangeJournalPanel";
import TemplateSidebarItem from "./nd-control/TemplateSidebarItem";
import TemplatesPanel from "./nd-control/TemplatesPanel";
import ConfirmProcessOwnerDialog from "./nd-control/ConfirmProcessOwnerDialog";
import ProcessDetailsDrawer from "./nd-control/ProcessDetailsDrawer";
import ReanalyzeConfirmDialog from "./nd-control/ReanalyzeConfirmDialog";
import { DEPARTMENT_TABS, isAnalysisRunning, type DepartmentTab } from "./nd-control/constants";
import { cleanupMermaidDomArtifacts } from "@/utils/renderMermaid";
import styles from "./NdControlAgent.module.css";

function EmptyState({ icon: Icon, text }: { icon: typeof LayoutPanelLeft; text: string }) {
  return (
    <div className={styles.emptyState}>
      <Icon size={40} />
      <p>{text}</p>
    </div>
  );
}

type AgentMode = "departments" | "templates";

export default function NdControlAgent() {
  const location = useLocation();
  const navigate = useNavigate();
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
  const [relationsProcessId, setRelationsProcessId] = useState<string | undefined>();
  const [relationsProcessName, setRelationsProcessName] = useState<string | undefined>();
  const [selectedProcess, setSelectedProcess] = useState<DepartmentProcessItem | null>(null);
  const [confirmProcess, setConfirmProcess] = useState<DepartmentProcessItem | null>(null);
  const [activeMode, setActiveMode] = useState<AgentMode>("departments");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showChangeJournal, setShowChangeJournal] = useState(false);

  const permissions = useQuery({
    queryKey: ["nd-control", "permissions"],
    queryFn: () => ndControlApi.permissions()
  });

  const departments = useQuery({
    queryKey: ["nd-control", "departments"],
    queryFn: () => ndControlApi.listDepartments(),
    enabled: permissions.data?.can_access_agent ?? false
  });

  const canViewTemplates = Boolean(
    permissions.data?.can_access_agent ||
      permissions.data?.can_manage_templates ||
      permissions.data?.can_upload_template_documents
  );

  const templates = useQuery({
    queryKey: ["nd-control", "templates", "sidebar"],
    queryFn: () => ndControlApi.templates.list({ page: 1, size: 100 }),
    enabled: (activeMode === "templates" || showChangeJournal) && canViewTemplates
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
    cleanupMermaidDomArtifacts();
  }, []);

  useEffect(() => {
    if (!selectedDeptId && departments.data?.length) {
      setSelectedDeptId(departments.data[0].id);
    }
  }, [departments.data, selectedDeptId]);

  useEffect(() => {
    if (!permissions.data) return;
    const params = new URLSearchParams(location.search);
    const modeFromUrl = params.get("mode");
    if ((modeFromUrl === "templates" || modeFromUrl === "departments") && modeFromUrl !== activeMode) {
      setActiveMode(modeFromUrl);
      return;
    }
    if (!modeFromUrl && !permissions.data.can_manage_departments && permissions.data.can_manage_templates) {
      switchMode("templates", true);
    }
  }, [activeMode, location.search, permissions.data]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const deptFromUrl = params.get("department");
    if (deptFromUrl) setSelectedDeptId(deptFromUrl);
  }, [location.search]);

  useEffect(() => {
    if (!selectedTemplateId && templates.data?.items.length) {
      setSelectedTemplateId(templates.data.items[0].id);
    }
  }, [selectedTemplateId, templates.data?.items]);

  function switchMode(mode: AgentMode, replace = false) {
    setActiveMode(mode);
    const params = new URLSearchParams(location.search);
    params.set("mode", mode);
    navigate(`${location.pathname}?${params.toString()}`, { replace });
  }

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

  const cancelAnalysis = useMutation({
    mutationFn: (departmentId: string) => ndControlApi.cancelDepartmentAnalysis(departmentId),
    onSuccess: async () => {
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

  const confirmProcessOwner = useMutation({
    mutationFn: (processId: string) => ndControlApi.confirmProcessOwner(processId, {}),
    onSuccess: async () => {
      setConfirmProcess(null);
      await queryClient.invalidateQueries({ queryKey: ["nd-control"] });
    }
  });

  const showProcessPanel = activeMode === "departments" && activeTab === "processes" && Boolean(selectedDeptId) && !showAnalysisScreen;

  useEffect(() => {
    setSelectedProcess(null);
  }, [selectedDeptId]);

  useEffect(() => {
    if (activeTab !== "processes") {
      setSelectedProcess(null);
    }
  }, [activeTab]);

  const searchVisible = activeTab !== "overview" && activeTab !== "history";

  if (permissions.isLoading) return <div className={styles.page}>Загрузка…</div>;
  const permissionData = permissions.data;
  if (!permissionData || (!permissionData.can_access_agent && !canViewTemplates)) {
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
          <p>
            {activeMode === "departments"
              ? "Анализ нормативных документов отделов, процессов и связей между ними."
              : "Реестр шаблонов нормативных документов для процессного управления."}
          </p>
        </div>
        {permissionData.can_view_change_journal ? (
          <button type="button" className={styles.secondaryBtn} onClick={() => setShowChangeJournal(true)}>
            <History size={16} />
            Журнал изменений
          </button>
        ) : null}
      </header>

      <div className={`${styles.layout} ${showProcessPanel ? styles.layoutWithProcessPanel : ""}`}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2>{activeMode === "departments" ? "Отделы агента" : "Шаблоны"}</h2>
            <div className={styles.sidebarHeaderActions}>
              <button
                type="button"
                className={styles.iconBtn}
                title={activeMode === "departments" ? "Шаблоны" : "Отделы"}
                aria-label={activeMode === "departments" ? "Шаблоны" : "Отделы"}
                onClick={() => switchMode(activeMode === "departments" ? "templates" : "departments")}
              >
                {activeMode === "departments" ? <FileStack size={20} /> : <Building2 size={20} />}
              </button>
              {activeMode === "departments" && permissionData.can_manage_departments ? (
              <button type="button" className={styles.addBtn} onClick={() => setShowCreateDept(true)} aria-label="Создать отдел">
                <Plus size={22} strokeWidth={2.5} aria-hidden="true" />
              </button>
              ) : null}
            </div>
          </div>
          {activeMode === "templates" ? (
            templates.isLoading ? (
              <p className={styles.emptyHint}>Загрузка шаблонов…</p>
            ) : !templates.data?.items.length ? (
              <EmptyState icon={FileStack} text="Шаблоны не найдены." />
            ) : (
              <div className={styles.deptList}>
                {templates.data.items.map((template) => (
                  <TemplateSidebarItem
                    key={template.id}
                    template={template}
                    selected={template.id === selectedTemplateId}
                    onSelect={() => setSelectedTemplateId(template.id)}
                  />
                ))}
              </div>
            )
          ) : departments.isLoading ? (
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
                  canManage={permissionData.can_manage_departments}
                  onSelect={() => setSelectedDeptId(dept.id)}
                  onDelete={() => setDeptPendingDelete(dept)}
                />
              ))}
            </div>
          )}
        </aside>

        <main className={styles.main}>
          {activeMode === "templates" ? (
            <TemplatesPanel
              permissions={permissionData}
              selectedTemplateId={selectedTemplateId}
              onSelectTemplate={setSelectedTemplateId}
            />
          ) : !selectedDeptId ? (
            <EmptyState icon={LayoutPanelLeft} text="Выберите отдел слева." />
          ) : showAnalysisScreen ? (
            <DepartmentAnalysisProgress
              status={analysisStatus.data}
              isLoading={analysisStatus.isLoading}
              onCancel={
                selectedDeptId && permissionData.can_reanalyze_departments
                  ? () => cancelAnalysis.mutate(selectedDeptId)
                  : undefined
              }
              isCancelling={cancelAnalysis.isPending}
            />
          ) : (
            <>
              {departmentSummary.data ? (
                <DepartmentSummaryHeader
                  summary={departmentSummary.data}
                  canReanalyze={permissionData.can_reanalyze_departments}
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
                    {permissionData.can_reanalyze_departments ? (
                      <button type="button" className={styles.secondaryBtn} onClick={() => setShowReanalyzeDialog(true)}>
                        Повторить анализ
                      </button>
                    ) : null}
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
                  <FormSearchInput compact value={search} onChange={setSearch} placeholder="Поиск по текущей вкладке…" />
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
                  onReextract={permissionData.can_reanalyze_departments ? () => setShowReanalyzeDialog(true) : undefined}
                />
              ) : null}
              {activeTab === "processes" ? (
                <DepartmentProcessesTab
                  departmentId={selectedDeptId}
                  search={search}
                  isAnalysisRunning={showAnalysisScreen}
                  analysisProcessed={analysisStatus.data?.processed_documents}
                  analysisTotal={analysisStatus.data?.total_documents}
                  selectedProcessId={selectedProcess?.process_id ?? null}
                  onSelectProcess={setSelectedProcess}
                  canManageDepartments={permissionData.can_manage_departments}
                  onStartAnalysis={
                    permissionData.can_reanalyze_departments ? () => setShowReanalyzeDialog(true) : undefined
                  }
                  onOpenDocuments={() => setActiveTab("documents")}
                  onOpenRelations={(processId, processName) => {
                    setRelationsProcessId(processId);
                    setRelationsProcessName(processName);
                    setActiveTab("relations");
                  }}
                  onConfirmProcessOwner={permissionData.can_manage_departments ? setConfirmProcess : undefined}
                />
              ) : null}
              {activeTab === "relations" ? (
                <DepartmentRelationsTab
                  departmentId={selectedDeptId}
                  search={search}
                  processId={relationsProcessId}
                  processName={relationsProcessName}
                  canManageDepartments={permissionData.can_manage_departments}
                  onClearProcessFilter={() => {
                    setRelationsProcessId(undefined);
                    setRelationsProcessName(undefined);
                  }}
                />
              ) : null}
              {activeTab === "review" ? (
                <DepartmentReviewTab
                  departmentId={selectedDeptId}
                  search={search}
                  canManageDepartments={permissionData.can_manage_departments}
                />
              ) : null}
              {activeTab === "history" ? (
                <DepartmentAnalysisHistoryTab
                  departmentId={selectedDeptId}
                  onReanalyze={permissionData.can_reanalyze_departments ? () => setShowReanalyzeDialog(true) : undefined}
                />
              ) : null}
            </>
          )}
        </main>

        {showProcessPanel ? (
          <aside className={`${styles.sidebar} ${styles.processSidebar}`}>
            <ProcessDetailsDrawer
              process={selectedProcess}
              onDismiss={() => setSelectedProcess(null)}
              canManageDepartments={permissionData.can_manage_departments}
              onConfirmOwner={permissionData.can_manage_departments ? setConfirmProcess : undefined}
              onOpenRelations={(processId, processName) => {
                setRelationsProcessId(processId);
                setRelationsProcessName(processName);
                setActiveTab("relations");
              }}
            />
          </aside>
        ) : null}
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
          if (!selectedDeptId || !permissions.data?.can_reanalyze_departments) return;
          reanalyzeDepartment.mutate({ departmentId: selectedDeptId, forceReextract });
        }}
      />

      <ConfirmProcessOwnerDialog
        process={confirmProcess}
        onClose={() => setConfirmProcess(null)}
        onConfirm={() => {
          if (confirmProcess) confirmProcessOwner.mutate(confirmProcess.process_id);
        }}
        isPending={confirmProcessOwner.isPending}
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
              <div><span>Тип документа</span><strong>{selectedCard.document_type_label ?? "—"}</strong></div>
              <div><span>Уровень СМК</span><strong>{selectedCard.document_level_label ?? "—"}</strong></div>
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

      <NdChangeJournalPanel
        open={showChangeJournal}
        departments={departments.data ?? []}
        templates={templates.data?.items ?? []}
        onClose={() => setShowChangeJournal(false)}
      />
    </div>
  );
}
