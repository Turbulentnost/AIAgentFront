import { Navigate, Route, Routes } from "react-router-dom";
import MeetingAgent from "@/pages/MeetingAgent";
import TasksAgent from "@/pages/TasksAgent";
import ProcurementAgent from "@/pages/ProcurementAgent";
import ProductionPreparationEngineerAgent from "@/pages/ProductionPreparationEngineerAgent";
import OmtoSupportManagerAgent from "@/pages/OmtoSupportManagerAgent";
import type { ReactNode } from "react";
import { useAuth } from "./auth/AuthContext";
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout title="Дашборд"><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/agents" element={<ProtectedRoute><Layout title="Агенты"><Agents /></Layout></ProtectedRoute>} />
      <Route path="/agents/nd-control" element={<ProtectedRoute><Layout title="Контроль НД"><NdControlAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/meeting" element={<ProtectedRoute><Layout title="ИИ-агент: Планирование совещаний"><MeetingAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/tasks" element={<ProtectedRoute><Layout title="Агент контроля поручений"><TasksAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/incoming-mail" element={<ProtectedRoute><Layout title="Входящая корреспонденция"><IncomingMail /></Layout></ProtectedRoute>} />
      <Route path="/agents/procurement" element={<ProtectedRoute><Layout title="Оркестратор закупок"><ProcurementAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/production-preparation-engineer" element={<ProtectedRoute><Layout title="Инженер по подготовке производства"><ProductionPreparationEngineerAgent /></Layout></ProtectedRoute>} />
      <Route path="/agents/omto-support-manager" element={<ProtectedRoute><Layout title="Менеджер по сопровождению ОМТО"><OmtoSupportManagerAgent /></Layout></ProtectedRoute>} />
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
