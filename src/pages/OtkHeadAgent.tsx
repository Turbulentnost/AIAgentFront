import QualityRoleAgentWorkspace from "./QualityRoleAgentWorkspace";

export default function OtkHeadAgent() {
  return (
    <QualityRoleAgentWorkspace
      agentId="otk_head_agent"
      description="Распределение предъявлений, проверка актов и контроль сроков входного контроля (СТО-10-095)."
      forbiddenText="Рабочее место начальника ОТК недоступно для вашей учётной записи."
      title="Начальник ОТК"
    />
  );
}
