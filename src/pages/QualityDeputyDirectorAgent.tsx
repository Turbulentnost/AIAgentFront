import QualityRoleAgentWorkspace from "./QualityRoleAgentWorkspace";

export default function QualityDeputyDirectorAgent() {
  return (
    <QualityRoleAgentWorkspace
      agentId="quality_deputy_director_agent"
      description="Проект резолюции по акту Ф-10-15 из допустимого перечня и контроль маршрута исполнения."
      forbiddenText="Рабочее место ЗДК недоступно для вашей учётной записи."
      title="Заместитель директора по качеству"
    />
  );
}
