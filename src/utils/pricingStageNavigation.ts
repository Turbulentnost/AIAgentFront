import type { RouteStageId } from "@/mock-data/pricingAgent";

export type PricingStageRouteId = RouteStageId | "completed";

export const PRICING_STAGE_ROUTE_ORDER: PricingStageRouteId[] = [
  "invoice",
  "project_price",
  "monitoring",
  "contract",
  "payment_request",
  "payment",
  "settlement",
  "completed"
];

/**
 * Возвращает id следующего этапа маршрута или null для финального экрана.
 */
export function getNextPricingStageRouteId(current: PricingStageRouteId): PricingStageRouteId | null {
  const index = PRICING_STAGE_ROUTE_ORDER.indexOf(current);
  if (index === -1 || index >= PRICING_STAGE_ROUTE_ORDER.length - 1) {
    return null;
  }
  return PRICING_STAGE_ROUTE_ORDER[index + 1];
}

/**
 * State для анимации connector stepper при переходе на следующий этап.
 */
export function getPricingStageNavigationState(currentStep: number) {
  return { animateConnectorIndex: currentStep - 1 };
}
