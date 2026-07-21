export function validateHitlClick(input: {
  action: string;
  comment: string;
  canViewSensitive: boolean;
  blockApproveRegistry: boolean;
  requiresComment: boolean;
}): string | null {
  if (input.requiresComment && !input.comment.trim()) {
    return "Для этого действия нужен комментарий (requires_comment).";
  }
  if (
    (input.action === "approve" || input.action === "approve_registry") &&
    input.blockApproveRegistry
  ) {
    return "Утверждение реестра запрещено: есть строки без согласования ЦФО.";
  }
  if (!input.canViewSensitive) {
    return "Недостаточно прав (user_role ≠ hitl_assignee_role).";
  }
  return null;
}
