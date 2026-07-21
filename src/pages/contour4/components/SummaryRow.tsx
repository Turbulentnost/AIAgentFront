import type { Contour4KpiSummary } from "@/types/contour4";
import styles from "../Contour4Workspace.module.css";

export default function SummaryRow({ sum }: { sum: Contour4KpiSummary }) {
  const cards = [
    {
      key: "ok",
      iconClass: styles.statusIconOk,
      valueClass: styles.statusValueOk,
      activeClass:
        sum.blocking === 0 && sum.below === 0 ? styles.statusCardActiveOk : undefined,
      icon: "✓",
      title: "Достигнуто",
      desc: `${sum.pct}% KPI в целевом диапазоне`,
      value: sum.ok
    },
    {
      key: "warn",
      iconClass: styles.statusIconWarn,
      valueClass: styles.statusValueWarn,
      activeClass:
        sum.border > 0 && sum.blocking === 0 ? styles.statusCardActiveWarn : undefined,
      icon: "!",
      title: "На границе",
      desc: "Показатель близко к целевому порогу",
      value: sum.border
    },
    {
      key: "bad",
      iconClass: styles.statusIconBad,
      valueClass: styles.statusValueBad,
      activeClass:
        sum.blocking > 0 || sum.below > 0 ? styles.statusCardActiveBad : undefined,
      icon: "!",
      title: "Критические",
      desc: "Ниже цели или блокирующие отклонения",
      value: sum.blocking + sum.below
    },
    {
      key: "total",
      iconClass: styles.statusIconNeutral,
      valueClass: styles.statusValueNeutral,
      activeClass: undefined,
      icon: "#",
      title: "Всего KPI",
      desc: "Специальные §12.2 и общие §12.1",
      value: sum.total
    },
    {
      key: "blocking",
      iconClass: styles.statusIconBad,
      valueClass: styles.statusValueBad,
      activeClass: undefined,
      icon: "×",
      title: "Блокирующих",
      desc: "Требуют внимания / остановки процесса",
      value: sum.blocking
    },
    {
      key: "guardrail",
      iconClass: styles.statusIconNeutral,
      valueClass: styles.statusValueNeutral,
      activeClass: undefined,
      icon: "◎",
      title: "Guardrail",
      desc: "Срабатывания защитных ограничений",
      value: sum.guardrail
    }
  ];

  return (
    <div className={styles.summaryRow}>
      {cards.map((card) => (
        <div
          key={card.key}
          className={`${styles.statusCard}${card.activeClass ? ` ${card.activeClass}` : ""}`}
        >
          <div className={card.iconClass} aria-hidden="true">
            {card.icon}
          </div>
          <div className={styles.statusBody}>
            <h3 className={styles.statusTitle}>{card.title}</h3>
            <p className={styles.statusDesc}>{card.desc}</p>
          </div>
          <div className={card.valueClass}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
