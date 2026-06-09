import { Bot, Building2, Network, ShieldCheck, UserRound } from "lucide-react";

type AccessModeIconProps = {
  className?: string;
};

const lucideProps = {
  size: 28,
  strokeWidth: 1.75,
  "aria-hidden": true as const
};

/** Организационная структура — доступ по подразделениям */
export function AccessDepartmentsIcon({ className }: AccessModeIconProps) {
  return <Building2 className={className} {...lucideProps} />;
}

/** Конкретный пользователь — доступ по списку людей */
export function AccessUsersIcon({ className }: AccessModeIconProps) {
  return <UserRound className={className} {...lucideProps} />;
}

/** Комбинация подразделений и пользователей — смешанная модель доступа */
export function AccessMixedIcon({ className }: AccessModeIconProps) {
  return <Network className={className} {...lucideProps} />;
}

/** Щит — доступ только администраторам */
export function AccessAdminsIcon({ className }: AccessModeIconProps) {
  return <ShieldCheck className={className} {...lucideProps} />;
}

/** ИИ-агент — доступ только выбранным агентам */
export function AccessAgentsIcon({ className }: AccessModeIconProps) {
  return <Bot className={className} {...lucideProps} />;
}
