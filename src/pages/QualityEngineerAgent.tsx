import QualityRoleAgentWorkspace from "./QualityRoleAgentWorkspace";

export default function QualityEngineerAgent() {
  return (
    <QualityRoleAgentWorkspace
      agentId="quality_engineer_agent"
      description="Документарный контроль, программа/выборка, протоколы и акты. Физический осмотр — только человек."
      forbiddenText="Рабочее место инженера по качеству недоступно для вашей учётной записи."
      title="Инженер по качеству"
    />
  );
}
