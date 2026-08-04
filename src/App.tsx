import { Navigate, Route, Routes } from "react-router-dom";
import MeetingAgent from "@/pages/MeetingAgent";
import TasksAgent from "@/pages/TasksAgent";
import ProcurementAgent from "@/pages/ProcurementAgent";
import ProcurementDepartments from "@/pages/ProcurementDepartments";
import ProductionDispatcherAgent from "@/pages/ProductionDispatcherAgent";
import WarehousePickerAgent from "@/pages/WarehousePickerAgent";
import WarehouseComplexChiefAgent from "@/pages/WarehouseComplexChiefAgent";
import ProcurementManagerAgent from "@/pages/ProcurementManagerAgent";
import ProductionPreparationEngineerAgent from "@/pages/ProductionPreparationEngineerAgent";
import OmtoSupportManagerAgent from "@/pages/OmtoSupportManagerAgent";
import OtkHeadAgent from "@/pages/OtkHeadAgent";
import QualityDeputyDirectorAgent from "@/pages/QualityDeputyDirectorAgent";
import QualityEngineerAgent from "@/pages/QualityEngineerAgent";
import QualityKpiAgent from "@/pages/QualityKpiAgent";
import EskdAgent from "@/pages/EskdAgent";
import type { ReactNode } from "react";
import { useAuth } from "./auth/AuthContext";
import { isIncomingMailPublic } from "./auth/standaloneIncomingMail";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Agents from "./pages/Agents";
import NdControlAgent from "./pages/NdControlAgent";
import IncomingMail from "./pages/IncomingMail";
import AgentBuilder from "./pages/AgentBuilder";
import Tasks from "./pages/Tasks";
import KnowledgeBase from "./pages/KnowledgeBase";
import KnowledgeBaseCreate from "./pages/KnowledgeBaseCreate";
import Documents from "./pages/Documents";
import Monitoring from "./pages/Monitoring";
import Login from "./pages/Login";
import DevLogin from "./pages/DevLogin";
import Profile from "./pages/Profile";
import ProfileEdit from "./pages/ProfileEdit";
import Users from "./pages/Users";
import Departments from "./pages/Departments";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="auth-page"><div className="card">Проверяем сессию...</div></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function IncomingMailRoute({ viewMode }: { viewMode: "cards" | "table" | "table-secret" }) {
  const title =
    viewMode === "cards"
      ? "Входящая корреспонденция"
      : viewMode === "table-secret"
        ? "Вид 1С — входящая корреспонденция"
        : "Вид 1С — входящая корреспонденция";
  const page = (
    <Layout title={title}>
      <IncomingMail viewMode={viewMode} />
    </Layout>
  );
  if (isIncomingMailPublic()) return page;
  return <ProtectedRoute>{page}</ProtectedRoute>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/dev-login" element={<DevLogin />} />
      <Route path="/" element={<ProtectedRoute><Layout title="Дашборд"><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/agents" element={<ProtectedRoute><Layout title="Агенты"><Agents /></Layout></ProtectedRoute>} />
      <Route path="/agents/nd-control" element={<ProtectedRoute><Layout title="Контроль НД"><NdControlAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/meeting" element={<ProtectedRoute><Layout title="ИИ-агент: Планирование совещаний"><MeetingAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/tasks" element={<ProtectedRoute><Layout title="Агент контроля поручений"><TasksAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/incoming-mail" element={<IncomingMailRoute viewMode="cards" />} />
      <Route path="/agents/incoming-mail/1c" element={<IncomingMailRoute viewMode="table" />} />
      <Route path="/agents/incoming-mail/1c/secret" element={<IncomingMailRoute viewMode="table-secret" />} />
      <Route path="/agents/procurement" element={<ProtectedRoute><Layout title="ИИ-агент по закупкам"><ProcurementAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/procurement/departments" element={<ProtectedRoute><Layout title="ИИ-агенты по закупкам по должностям"><ProcurementDepartments /></Layout></ProtectedRoute>} />
      <Route path="/agents/production-dispatcher" element={<ProtectedRoute><Layout title="ИИ-агент диспетчера производства"><ProductionDispatcherAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/warehouse-picker" element={<ProtectedRoute><Layout title="ИИ-агент по закупке"><WarehousePickerAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/warehouse-complex-chief" element={<ProtectedRoute><Layout title="ИИ-агент по закупкам"><WarehouseComplexChiefAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/purchase-manager" element={<ProtectedRoute><Layout title="ИИ-агент менеджера по закупкам"><ProcurementManagerAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/procurement-manager" element={<Navigate to="/agents/purchase-manager" replace />} />
      <Route path="/agents/production-preparation-engineer" element={<ProtectedRoute><Layout title="Инженер по подготовке производства"><ProductionPreparationEngineerAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/omto-support-manager" element={<ProtectedRoute><Layout title="Менеджер по сопровождению ОМТО"><OmtoSupportManagerAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/otk-head" element={<ProtectedRoute><Layout title="Начальник ОТК"><OtkHeadAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/quality-engineer" element={<ProtectedRoute><Layout title="Работник ОТК"><QualityEngineerAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/quality-deputy-director" element={<ProtectedRoute><Layout title="ЗДК"><QualityDeputyDirectorAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/quality-kpi" element={<ProtectedRoute><Layout title="Агент качества (KPI)"><QualityKpiAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/eskd" element={<ProtectedRoute><Layout title="ESKD Agent"><EskdAgent /></Layout></ProtectedRoute>} />
      <Route path="/agent-builder" element={<ProtectedRoute><Layout title="Конструктор агентов"><AgentBuilder /></Layout></ProtectedRoute>} />
      <Route path="/tasks" element={<ProtectedRoute><Layout title="Задачи"><Tasks /></Layout></ProtectedRoute>} />
      <Route path="/knowledge-base" element={<ProtectedRoute><Layout title="База знаний"><KnowledgeBase /></Layout></ProtectedRoute>} />
      <Route path="/knowledge-base/create" element={<ProtectedRoute><Layout title="Создание базы знаний"><KnowledgeBaseCreate /></Layout></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><Layout title="Документы"><Documents /></Layout></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><Layout title="Пользователи"><Users /></Layout></ProtectedRoute>} />
      <Route path="/departments" element={<ProtectedRoute><Layout title="Подразделения"><Departments /></Layout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Layout title="Профиль"><Profile /></Layout></ProtectedRoute>} />
      <Route path="/profile/edit" element={<ProtectedRoute><Layout title="Редактирование профиля"><ProfileEdit /></Layout></ProtectedRoute>} />
      <Route path="/monitoring" element={<ProtectedRoute><Layout title="Мониторинг"><Monitoring /></Layout></ProtectedRoute>} />
    </Routes>
  );
}
