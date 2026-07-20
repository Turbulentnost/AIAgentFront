import type { Contour4AgentId, Contour4AgentMock, Contour4Kpi } from "@/types/contour4";
import { CONTOUR4_WIDGETS } from "@/mock-data/contour4Widgets";

function finalizeAgent(
  agent: Omit<Contour4AgentMock, "widgets" | "requires_human_review">
): Contour4AgentMock {
  return {
    ...agent,
    requires_human_review: true,
    widgets: CONTOUR4_WIDGETS[agent.id],
    hitl: {
      ...agent.hitl,
      hitl_assignee_role: agent.hitl.hitl_assignee_role ?? agent.hitl.assignee_role,
      recommendation:
        agent.hitl.recommendation ??
        `${agent.hitl.summary} Рекомендуемое действие: ${agent.hitl.suggested_action}.`
    }
  };
}

/** Общие KPI §12.1 — из ui_mocks/shared/mock-data.js */
export const CONTOUR4_COMMON_KPIS: Contour4Kpi[] = [
  {
    id: "G1",
    name: "Точность результата",
    target: "≥ 95%",
    targetNum: 95,
    direction: "gte",
    value: 96.2,
    unit: "%",
    blocking: false
  },
  {
    id: "G2",
    name: "Полнота результата",
    target: "≥ 98%",
    targetNum: 98,
    direction: "gte",
    value: 98.5,
    unit: "%",
    blocking: false
  },
  {
    id: "G3",
    name: "Своевременность",
    target: "≥ 95%",
    targetNum: 95,
    direction: "gte",
    value: 94.1,
    unit: "%",
    blocking: false
  },
  {
    id: "G4",
    name: "Доля существенных исправлений человеком",
    target: "≤ 10% (пилот)",
    targetNum: 10,
    direction: "lte",
    value: 7.2,
    unit: "%",
    blocking: false
  },
  {
    id: "G5",
    name: "Прослеживаемость",
    target: "100%",
    targetNum: 100,
    direction: "gte",
    value: 100,
    unit: "%",
    blocking: false
  },
  {
    id: "G6",
    name: "Критические и несанкционированные действия",
    target: "0",
    targetNum: 0,
    direction: "eq",
    value: 0,
    unit: "",
    blocking: true
  }
];

const CONTOUR4_AGENTS_RAW: Record<
  Contour4AgentId,
  Omit<Contour4AgentMock, "widgets" | "requires_human_review">
> = {
  cfo_head: {
    id: "cfo_head" as const,
    title: "Агент руководителя ЦФО",
    role: "Руководитель ЦФО",
    tz: "ТЗ-АГТ-ЦФО-001",
    sysNo: "№14",
    reportsTo: "Финансовый директор",
    autonomy: "У1",
    port: 8101,
    cfo_code: "CFO-12",
    specialKpis: [
      {
        id: "K1",
        name: "Точность определения ЦФО и статьи расходов",
        target: "100%",
        targetNum: 100,
        direction: "gte",
        value: 100,
        unit: "%",
        blocking: false
      },
      {
        id: "K2",
        name: "Доля решений с обоснованием приоритета",
        target: "100%",
        targetNum: 100,
        direction: "gte",
        value: 100,
        unit: "%",
        blocking: false
      },
      {
        id: "K3",
        name: "Своевременность проекта согласования",
        target: "≥ 95%",
        targetNum: 95,
        direction: "gte",
        value: 97.4,
        unit: "%",
        blocking: false
      },
      {
        id: "K4",
        name: "Решения, противоречащие утверждённому бюджету",
        target: "0",
        targetNum: 0,
        direction: "eq",
        value: 1,
        unit: "",
        blocking: true
      }
    ],
    hitl: {
      title: "Согласование заявки по ЦФО",
      summary:
        "Заявка на оплату превышает лимит ДС по статье. Требуется решение руководителя ЦФО.",
      assignee_role: "cfo_head",
      fields: [
        { key: "amount", label: "Сумма", value: "245 000 ₽", format: "money" },
        { key: "cfo", label: "ЦФО", value: "ЦФО-12 Закупки", format: "text" },
        { key: "article", label: "Статья", value: "26.01 Материалы", format: "text" },
        { key: "limit", label: "Лимит ДС", value: "200 000 ₽", format: "money" },
        { key: "delta", label: "Превышение", value: "45 000 ₽", format: "money" }
      ],
      buttons: [
        {
          id: "btn_approve",
          label: "Утвердить",
          action: "approve",
          style: "primary",
          requires_comment: false
        },
        {
          id: "btn_return",
          label: "Вернуть",
          action: "return",
          style: "secondary",
          requires_comment: true
        },
        {
          id: "btn_reject",
          label: "Отклонить",
          action: "reject",
          style: "danger",
          requires_comment: true
        }
      ],
      suggested_action: "return",
      risks: ["Превышение лимита ДС на 22,5%", "Нет обоснования приоритета в заявке"],
      norm_refs: ["СТО §4.2 Лимиты ДС", "СТО §5.1 Согласование ЦФО"]
    },
    notifications: [
      {
        id: "n1",
        type: "hitl",
        title: "Ожидает решения",
        text: "Заявка ЗН-1042 — превышение лимита ДС",
        time: "09:12",
        unread: true
      },
      {
        id: "n2",
        type: "escalation",
        title: "Эскалация",
        text: "Маршрутизация к агенту рисков №7",
        time: "08:55",
        unread: true
      },
      {
        id: "n3",
        type: "info",
        title: "Контур",
        text: "notify_contours: contour5 после оплаты",
        time: "вчера",
        unread: false
      }
    ]
  },

  finance_director: {
    id: "finance_director" as const,
    title: "Агент финансового директора",
    role: "Финансовый директор",
    tz: "ТЗ-АГТ-ФИН-001",
    sysNo: "№20",
    reportsTo: "Исполнительный директор",
    autonomy: "У1",
    port: 8102,
    specialKpis: [
      {
        id: "K1",
        name: "Точность проверки бюджета, лимита и финансовой дельты",
        target: "100%",
        targetNum: 100,
        direction: "gte",
        value: 100,
        unit: "%",
        blocking: false
      },
      {
        id: "K2",
        name: "Доля исключений с полным финансовым обоснованием",
        target: "100%",
        targetNum: 100,
        direction: "gte",
        value: 92,
        unit: "%",
        blocking: true
      },
      {
        id: "K3",
        name: "Своевременность проекта финансового решения",
        target: "≥ 95%",
        targetNum: 95,
        direction: "gte",
        value: 96.8,
        unit: "%",
        blocking: false
      },
      {
        id: "K4",
        name: "Согласования за пределами полномочий или лимитов",
        target: "0",
        targetNum: 0,
        direction: "eq",
        value: 0,
        unit: "",
        blocking: true
      }
    ],
    hitl: {
      title: "Финансовое решение по исключению",
      summary: "Исключение S10: сумма вне лимита полномочий. Нужно allow / defer / deny.",
      assignee_role: "finance_director",
      fields: [
        { key: "amount", label: "Сумма", value: "1 280 000 ₽", format: "money" },
        { key: "s10", label: "Правило S10", value: "Вне лимита", format: "text" },
        { key: "budget", label: "Бюджет остаток", value: "890 000 ₽", format: "money" },
        { key: "priority", label: "Приоритет", value: "Высокий", format: "text" }
      ],
      buttons: [
        {
          id: "btn_allow",
          label: "Разрешить",
          action: "allow",
          style: "primary",
          requires_comment: true
        },
        {
          id: "btn_defer",
          label: "Отложить",
          action: "defer",
          style: "secondary",
          requires_comment: false
        },
        {
          id: "btn_deny",
          label: "Запретить",
          action: "deny",
          style: "danger",
          requires_comment: true
        }
      ],
      suggested_action: "defer",
      risks: ["Неполное финансовое обоснование исключения"],
      norm_refs: ["СТО §6.2 Исключения S10"]
    },
    notifications: [
      {
        id: "n1",
        type: "hitl",
        title: "Ожидает решения",
        text: "Исключение S10 по ЗН-1099",
        time: "10:01",
        unread: true
      },
      {
        id: "n2",
        type: "info",
        title: "HITL",
        text: "ЦФО вернул заявку на доработку",
        time: "09:40",
        unread: false
      }
    ]
  },

  executive_director: {
    id: "executive_director" as const,
    title: "Агент исполнительного директора",
    role: "Исполнительный директор",
    tz: "ТЗ-АГТ-ИСП-001",
    sysNo: "№21",
    reportsTo: "Генеральный директор",
    autonomy: "У1",
    port: 8103,
    specialKpis: [
      {
        id: "K1",
        name: "Полнота проверки основания и приоритета платежа",
        target: "100%",
        targetNum: 100,
        direction: "gte",
        value: 100,
        unit: "%",
        blocking: false
      },
      {
        id: "K2",
        name: "Своевременность проекта резолюции",
        target: "≥ 95%",
        targetNum: 95,
        direction: "gte",
        value: 93.2,
        unit: "%",
        blocking: false
      },
      {
        id: "K3",
        name: "Доля резолюций, возвращённых из-за отсутствия основания",
        target: "≤ 5%",
        targetNum: 5,
        direction: "lte",
        value: 3.1,
        unit: "%",
        blocking: false
      },
      {
        id: "K4",
        name: "Предложенные неразрешённые исключения",
        target: "0",
        targetNum: 0,
        direction: "eq",
        value: 0,
        unit: "",
        blocking: true
      }
    ],
    hitl: {
      title: "Резолюция по реестру оплат (W-ID-04)",
      summary:
        "Пакет платежей без ЦФО по 2 строкам. Требуется утвердить реестр / вернуть ОМТО / задать приоритет.",
      assignee_role: "executive_director",
      fields: [
        { key: "rows", label: "Строк", value: "14", format: "number" },
        { key: "no_cfo", label: "Без ЦФО", value: "2", format: "number" },
        { key: "deadline", label: "Дедлайн", value: "12:00", format: "text" },
        { key: "need_date", label: "production_need_date", value: "2026-08-20", format: "text" },
        { key: "total", label: "Сумма пакета", value: "3 450 000 ₽", format: "money" }
      ],
      buttons: [
        {
          id: "btn_approve",
          label: "Утвердить реестр",
          action: "approve_registry",
          style: "primary",
          requires_comment: false
        },
        {
          id: "btn_priority",
          label: "Задать приоритет",
          action: "set_priority",
          style: "secondary",
          requires_comment: false
        },
        {
          id: "btn_return",
          label: "Вернуть ОМТО",
          action: "return",
          style: "secondary",
          requires_comment: true
        }
      ],
      suggested_action: "return",
      risks: ["ROUTE_EXCEPTION: 2 строки без ЦФО", "Дедлайн сегодня 12:00"],
      norm_refs: ["СТО-28-020 §6.2", "СТО-28-020 §6.6"]
    },
    notifications: [
      {
        id: "n1",
        type: "hitl",
        title: "Ожидает решения",
        text: "Пакет платежей — 2 строки без ЦФО",
        time: "11:05",
        unread: true
      },
      {
        id: "n2",
        type: "escalation",
        title: "Эскалация",
        text: "Просрочен дедлайн резолюции вчера",
        time: "вчера",
        unread: true
      },
      {
        id: "n3",
        type: "info",
        title: "Контур",
        text: "Следующая роль: chief_accountant",
        time: "вчера",
        unread: false
      }
    ]
  },

  chief_accountant: {
    id: "chief_accountant" as const,
    title: "Агент главного бухгалтера",
    role: "Главный бухгалтер",
    tz: "ТЗ-АГТ-ГБ-001",
    sysNo: "№22",
    reportsTo: "Финансовый директор",
    autonomy: "У1",
    port: 8104,
    specialKpis: [
      {
        id: "K1",
        name: "Пропущенные критические бухгалтерские ошибки",
        target: "0",
        targetNum: 0,
        direction: "eq",
        value: 0,
        unit: "",
        blocking: true
      },
      {
        id: "K2",
        name: "Полнота проверки реквизитов и первичных документов",
        target: "≥ 99%",
        targetNum: 99,
        direction: "gte",
        value: 99.4,
        unit: "%",
        blocking: false
      },
      {
        id: "K3",
        name: "Своевременность бухгалтерского заключения",
        target: "≥ 95%",
        targetNum: 95,
        direction: "gte",
        value: 95.0,
        unit: "%",
        blocking: false
      },
      {
        id: "K4",
        name: "Доля заключений, исправленных после контроля",
        target: "≤ 2%",
        targetNum: 2,
        direction: "lte",
        value: 2.8,
        unit: "%",
        blocking: false
      }
    ],
    hitl: {
      title: "Бухгалтерское заключение",
      summary: "Неполные реквизиты контрагента. Требуется approve / return.",
      assignee_role: "chief_accountant",
      fields: [
        { key: "requisites", label: "Реквизиты", value: "Неполные", format: "text" },
        { key: "remarks", label: "Замечаний", value: "3", format: "number" },
        { key: "doc", label: "Документ", value: "Счёт №4412", format: "text" },
        { key: "inn", label: "ИНН", value: "отсутствует КПП", format: "text" }
      ],
      buttons: [
        {
          id: "btn_approve",
          label: "Утвердить",
          action: "approve",
          style: "primary",
          requires_comment: false
        },
        {
          id: "btn_return",
          label: "Вернуть",
          action: "return",
          style: "secondary",
          requires_comment: true
        }
      ],
      suggested_action: "return",
      risks: ["Отсутствует КПП", "3 замечания по первичке"],
      norm_refs: ["СТО §7.1 Реквизиты", "ФЗ-402"]
    },
    notifications: [
      {
        id: "n1",
        type: "hitl",
        title: "Ожидает решения",
        text: "Счёт №4412 — неполные реквизиты",
        time: "08:20",
        unread: true
      },
      {
        id: "n2",
        type: "info",
        title: "Контроль",
        text: "Исправление после контрольной проверки",
        time: "пн",
        unread: false
      }
    ]
  },

  accountant: {
    id: "accountant" as const,
    title: "Агент сотрудника бухгалтерии",
    role: "Сотрудник бухгалтерии",
    tz: "ТЗ-АГТ-БУХ-001",
    sysNo: "№23",
    reportsTo: "Главный бухгалтер",
    autonomy: "У1",
    port: 8105,
    specialKpis: [
      {
        id: "K1",
        name: "Точность статуса платежа и взаиморасчётов",
        target: "100%",
        targetNum: 100,
        direction: "gte",
        value: 100,
        unit: "%",
        blocking: false
      },
      {
        id: "K2",
        name: "Платежи, предложенные без полного согласования",
        target: "0",
        targetNum: 0,
        direction: "eq",
        value: 0,
        unit: "",
        blocking: true
      },
      {
        id: "K3",
        name: "Полнота регистрации первичных документов",
        target: "≥ 99%",
        targetNum: 99,
        direction: "gte",
        value: 98.1,
        unit: "%",
        blocking: false
      },
      {
        id: "K4",
        name: "Доля расхождений, обработанных в срок",
        target: "≥ 95%",
        targetNum: 95,
        direction: "gte",
        value: 96.5,
        unit: "%",
        blocking: false
      }
    ],
    hitl: {
      title: "Статус оплаты",
      summary: "Платёж полностью согласован. Подтвердите mark_paid или отложите.",
      assignee_role: "accountant",
      fields: [
        { key: "status", label: "Статус", value: "К оплате", format: "text" },
        { key: "overdue", label: "Просрочка", value: "нет", format: "text" },
        { key: "approved", label: "fully_approved", value: "да", format: "bool" },
        { key: "amount", label: "Сумма", value: "156 700 ₽", format: "money" }
      ],
      buttons: [
        {
          id: "btn_paid",
          label: "Отметить оплаченным",
          action: "mark_paid",
          style: "primary",
          requires_comment: false
        },
        {
          id: "btn_defer",
          label: "Отложить",
          action: "defer",
          style: "secondary",
          requires_comment: false
        },
        {
          id: "btn_cancel",
          label: "Аннулировать",
          action: "cancel",
          style: "danger",
          requires_comment: true
        },
        {
          id: "btn_escalate",
          label: "Эскалация просрочки",
          action: "escalate_overdue",
          style: "secondary",
          requires_comment: false
        }
      ],
      suggested_action: "mark_paid",
      risks: [],
      norm_refs: ["СТО-28-020 §6.11", "СТО §8.3 Регистрация оплаты"]
    },
    notifications: [
      {
        id: "n1",
        type: "hitl",
        title: "Ожидает решения",
        text: "Платёж ПЛ-778 — к отметке paid",
        time: "12:30",
        unread: true
      },
      {
        id: "n2",
        type: "info",
        title: "Контур",
        text: "notify_contours: contour5",
        time: "12:00",
        unread: true
      },
      {
        id: "n3",
        type: "info",
        title: "Расхождение",
        text: "Закрыто расхождение по акту А-12",
        time: "пн",
        unread: false
      }
    ]
  },

  legal_specialist: {
    id: "legal_specialist" as const,
    title: "Агент юридического специалиста",
    role: "Юридический специалист",
    tz: "ТЗ-АГТ-ЮР-001",
    sysNo: "№24",
    reportsTo: "Исполнительный директор",
    autonomy: "У1",
    port: 8106,
    specialKpis: [
      {
        id: "K1",
        name: "Полнота проверки существенных условий договора",
        target: "100%",
        targetNum: 100,
        direction: "gte",
        value: 100,
        unit: "%",
        blocking: false
      },
      {
        id: "K2",
        name: "Пропущенные критические юридические риски",
        target: "0",
        targetNum: 0,
        direction: "eq",
        value: 1,
        unit: "",
        blocking: true
      },
      {
        id: "K3",
        name: "Доля редакций, принятых без существенной переработки",
        target: "≥ 90%",
        targetNum: 90,
        direction: "gte",
        value: 88,
        unit: "%",
        blocking: false
      },
      {
        id: "K4",
        name: "Своевременность юридического заключения",
        target: "≥ 95%",
        targetNum: 95,
        direction: "gte",
        value: 97.1,
        unit: "%",
        blocking: false
      }
    ],
    hitl: {
      title: "Юридическое заключение по претензии",
      summary: "Открыты авансы, риск по претензии. Выберите действие.",
      assignee_role: "legal_specialist",
      fields: [
        { key: "advances", label: "Открытых авансов", value: "2", format: "number" },
        { key: "claim", label: "Статус претензии", value: "Черновик", format: "text" },
        { key: "risk", label: "Риск", value: "Высокий — неустойка", format: "text" },
        { key: "contract", label: "Договор", value: "Д-2024/881", format: "text" }
      ],
      buttons: [
        {
          id: "btn_claim",
          label: "Утвердить претензию",
          action: "approve_claim_draft",
          style: "primary",
          requires_comment: false
        },
        {
          id: "btn_lawsuit",
          label: "Готовить иск",
          action: "prepare_lawsuit",
          style: "danger",
          requires_comment: true
        },
        {
          id: "btn_return",
          label: "Вернуть",
          action: "return",
          style: "secondary",
          requires_comment: true
        },
        {
          id: "btn_contract",
          label: "Резолюция по договору",
          action: "review_contract_remarks",
          style: "secondary",
          requires_comment: false
        }
      ],
      suggested_action: "approve_claim_draft",
      risks: ["Критический риск неустойки не отражён в черновике", "2 открытых аванса"],
      norm_refs: ["СТО-28-020 претензии", "ПЛ-34-048", "ГК РФ ст. 330"]
    },
    notifications: [
      {
        id: "n1",
        type: "hitl",
        title: "Ожидает решения",
        text: "Претензия по Д-2024/881",
        time: "09:48",
        unread: true
      },
      {
        id: "n2",
        type: "escalation",
        title: "Эскалация",
        text: "Критический юр. риск — неустойка",
        time: "09:48",
        unread: true
      },
      {
        id: "n3",
        type: "info",
        title: "Редакция",
        text: "Контрагент принял правки без переработки",
        time: "пт",
        unread: false
      }
    ]
  }
};

export const CONTOUR4_AGENTS: Record<Contour4AgentId, Contour4AgentMock> = {
  cfo_head: finalizeAgent(CONTOUR4_AGENTS_RAW.cfo_head),
  finance_director: finalizeAgent(CONTOUR4_AGENTS_RAW.finance_director),
  executive_director: finalizeAgent(CONTOUR4_AGENTS_RAW.executive_director),
  chief_accountant: finalizeAgent(CONTOUR4_AGENTS_RAW.chief_accountant),
  accountant: finalizeAgent(CONTOUR4_AGENTS_RAW.accountant),
  legal_specialist: finalizeAgent(CONTOUR4_AGENTS_RAW.legal_specialist)
};

export const CONTOUR4_AGENT_LIST: Contour4AgentId[] = [
  "cfo_head",
  "finance_director",
  "executive_director",
  "chief_accountant",
  "accountant",
  "legal_specialist"
];

export function isContour4AgentId(value: string): value is Contour4AgentId {
  return CONTOUR4_AGENT_LIST.includes(value as Contour4AgentId);
}
