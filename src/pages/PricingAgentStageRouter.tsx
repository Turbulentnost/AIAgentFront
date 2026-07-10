import { Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  getPricingCompletionStageDetail,
  getPricingContractStageDetail,
  getPricingInvoiceStageDetail,
  getPricingMonitoringStageDetail,
  getPricingPaymentRequestStageDetail,
  getPricingPaymentStageDetail,
  getPricingProjectPriceStageDetail,
  getPricingSettlementStageDetail,
  PRICING_DEFAULT_INVOICE_ID
} from "@/mock-data/pricingAgent";
import { getPricingStageIdBySlug, PRICING_AGENT_PATH } from "@/utils/agentLaunch";
import PricingAgentCompletionStage from "@/pages/PricingAgentCompletionStage";
import PricingAgentContractStage from "@/pages/PricingAgentContractStage";
import PricingAgentInvoiceStage from "@/pages/PricingAgentInvoiceStage";
import PricingAgentMonitoringStage from "@/pages/PricingAgentMonitoringStage";
import PricingAgentPaymentRequestStage from "@/pages/PricingAgentPaymentRequestStage";
import PricingAgentPaymentStage from "@/pages/PricingAgentPaymentStage";
import PricingAgentProjectPriceStage from "@/pages/PricingAgentProjectPriceStage";
import PricingAgentSettlementStage from "@/pages/PricingAgentSettlementStage";

export interface PricingStageNavigationState {
  animateConnectorIndex?: number;
}

/**
 * Маршрутизатор этапов агента цен по URL-сегменту этапа.
 */
export default function PricingAgentStageRouter() {
  const { stageSlug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const stageId = getPricingStageIdBySlug(stageSlug);
  const invoiceId = searchParams.get("invoice") ?? PRICING_DEFAULT_INVOICE_ID;
  const navigationState = location.state as PricingStageNavigationState | null;
  const animateConnectorIndex = navigationState?.animateConnectorIndex ?? null;

  if (!stageId) {
    return <Navigate to={PRICING_AGENT_PATH} replace />;
  }

  if (stageId === "invoice") {
    const detail = getPricingInvoiceStageDetail(invoiceId);
    if (!detail) return <Navigate to={PRICING_AGENT_PATH} replace />;
    return (
      <PricingAgentInvoiceStage detail={detail} animateConnectorIndex={animateConnectorIndex} />
    );
  }

  if (stageId === "project_price") {
    const detail = getPricingProjectPriceStageDetail(invoiceId);
    if (!detail) return <Navigate to={PRICING_AGENT_PATH} replace />;
    return (
      <PricingAgentProjectPriceStage detail={detail} animateConnectorIndex={animateConnectorIndex} />
    );
  }

  if (stageId === "monitoring") {
    const detail = getPricingMonitoringStageDetail(invoiceId);
    if (!detail) return <Navigate to={PRICING_AGENT_PATH} replace />;
    return (
      <PricingAgentMonitoringStage detail={detail} animateConnectorIndex={animateConnectorIndex} />
    );
  }

  if (stageId === "contract") {
    const detail = getPricingContractStageDetail(invoiceId);
    if (!detail) return <Navigate to={PRICING_AGENT_PATH} replace />;
    return (
      <PricingAgentContractStage detail={detail} animateConnectorIndex={animateConnectorIndex} />
    );
  }

  if (stageId === "payment_request") {
    const detail = getPricingPaymentRequestStageDetail(invoiceId);
    if (!detail) return <Navigate to={PRICING_AGENT_PATH} replace />;
    return (
      <PricingAgentPaymentRequestStage
        detail={detail}
        animateConnectorIndex={animateConnectorIndex}
      />
    );
  }

  if (stageId === "payment") {
    const detail = getPricingPaymentStageDetail(invoiceId);
    if (!detail) return <Navigate to={PRICING_AGENT_PATH} replace />;
    return (
      <PricingAgentPaymentStage detail={detail} animateConnectorIndex={animateConnectorIndex} />
    );
  }

  if (stageId === "settlement") {
    const detail = getPricingSettlementStageDetail(invoiceId);
    if (!detail) return <Navigate to={PRICING_AGENT_PATH} replace />;
    return (
      <PricingAgentSettlementStage detail={detail} animateConnectorIndex={animateConnectorIndex} />
    );
  }

  if (stageId === "completed") {
    const detail = getPricingCompletionStageDetail(invoiceId);
    if (!detail) return <Navigate to={PRICING_AGENT_PATH} replace />;
    return (
      <PricingAgentCompletionStage detail={detail} animateConnectorIndex={animateConnectorIndex} />
    );
  }

  return <Navigate to={PRICING_AGENT_PATH} replace />;
}
