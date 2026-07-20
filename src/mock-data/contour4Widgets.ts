import type { Contour4AgentId, Contour4Widget } from "@/types/contour4";

/** Mock MVP widgets aligned with agents_contour4/app/widgets/catalog.py */

export const CONTOUR4_WIDGETS: Record<Contour4AgentId, Contour4Widget[]> = {
  cfo_head: [
    {
      id: "W-CFO-KPI",
      type: "kpi_cards",
      title: "Лимит ДС / сумма / остаток",
      priority: 10,
      data: {
        cards: [
          { key: "amount", label: "Сумма заявки", value: "245000", format: "money" },
          { key: "ds_limit", label: "Лимит ДС", value: "200000", format: "money" },
          { key: "remain", label: "Остаток лимита", value: "-45000", format: "money" }
        ]
      }
    },
    {
      id: "W-CFO-LIMIT-BAR",
      type: "chart_bar",
      title: "Сумма vs лимит ДС",
      priority: 20,
      data: {
        labels: ["Сумма заявки", "Лимит ДС"],
        series: [{ name: "RUB", values: [245000, 200000] }]
      }
    },
    {
      id: "W-CFO-QUEUE",
      type: "table",
      title: "Очередь заявок ЦФО",
      priority: 25,
      data: {
        columns: [
          { key: "payment_request_id", label: "Заявка" },
          { key: "amount", label: "Сумма" },
          { key: "cfo_code", label: "ЦФО" },
          { key: "article", label: "Статья" },
          { key: "status", label: "Статус" }
        ],
        rows: [
          {
            payment_request_id: "PR-101",
            amount: "245000",
            cfo_code: "CFO-12",
            article: "Материалы",
            status: "HITL"
          },
          {
            payment_request_id: "PR-102",
            amount: "90000",
            cfo_code: "CFO-12",
            article: "Услуги",
            status: "очередь"
          },
          {
            payment_request_id: "PR-205",
            amount: "310000",
            cfo_code: "CFO-07",
            article: "Оборудование",
            status: "чужой ЦФО"
          }
        ]
      }
    },
    {
      id: "W-CFO-STAGES",
      type: "table",
      title: "Этапы staged оплаты",
      priority: 30,
      data: {
        columns: [
          { key: "stage", label: "Этап" },
          { key: "pct", label: "%" },
          { key: "date", label: "Дата" }
        ],
        rows: [
          { stage: "Аванс", pct: "30", date: "2026-07-22" },
          { stage: "Постоплата", pct: "70", date: "2026-08-15" }
        ]
      }
    },
    {
      id: "W-CFO-UPSTREAM",
      type: "note",
      title: "Проверки upstream (контур №3)",
      priority: 40,
      data: {
        text: "invoice_verified=true; price_match=true; contract_status=active; cfo_code=CFO-12"
      }
    }
  ],

  finance_director: [
    {
      id: "W-FIN-KPI",
      type: "kpi_cards",
      title: "S10 / сумма / статус",
      priority: 10,
      data: {
        cards: [
          { key: "amount", label: "Сумма", value: "9000", format: "money" },
          { key: "s10", label: "S10 остаток недели", value: "1000", format: "money" },
          { key: "s10_ok", label: "В пределах S10", value: "нет", format: "bool" }
        ]
      }
    },
    {
      id: "W-FIN-S10-LINE",
      type: "chart_line",
      title: "Остаток S10 (неделя)",
      priority: 20,
      data: {
        labels: ["Пн", "Вт", "Ср", "Чт", "Пт"],
        series: [{ name: "S10", values: [12000, 8000, 4500, 2000, 1000] }]
      }
    },
    {
      id: "W-FIN-ESC-PACK",
      type: "table",
      title: "Пакет эскалации §6.9",
      priority: 30,
      data: {
        columns: [
          { key: "item", label: "Документ" },
          { key: "status", label: "Статус" }
        ],
        rows: [
          { item: "Обоснование срочности", status: "есть" },
          { item: "Мониторинг цен (≥2)", status: "неполный" },
          { item: "СЗ на ПЦ", status: "требуется" }
        ]
      }
    },
    {
      id: "W-FIN-REASON",
      type: "note",
      title: "Причина исключения",
      priority: 40,
      data: { text: "escalation_reason_code=S10_EXCEEDED; trigger=s10_exception" }
    }
  ],

  executive_director: [
    {
      id: "W-EXEC-KPI",
      type: "kpi_cards",
      title: "Реестр / дедлайн 12:00",
      priority: 10,
      data: {
        cards: [
          { key: "lines", label: "Строк", value: 14, format: "number" },
          { key: "missing_cfo", label: "Без ЦФО", value: 2, format: "number" },
          { key: "deadline", label: "Дедлайн", value: "12:00", format: "text" },
          {
            key: "need_date",
            label: "production_need_date",
            value: "2026-08-20",
            format: "text"
          }
        ]
      }
    },
    {
      id: "W-EXEC-LINES",
      type: "table",
      title: "Строки реестра оплат (W-ID-01)",
      priority: 20,
      data: {
        columns: [
          { key: "payment_request_id", label: "Заявка" },
          { key: "amount", label: "Сумма" },
          { key: "cfo_code", label: "ЦФО" },
          { key: "cfo_approved", label: "ЦФО утв." },
          { key: "urgency", label: "Срочность" },
          { key: "priority", label: "Приоритет" }
        ],
        rows: [
          {
            payment_request_id: "PR-1",
            amount: "120000",
            cfo_code: "CFO-12",
            cfo_approved: true,
            urgency: "high",
            priority: 1
          },
          {
            payment_request_id: "PR-2",
            amount: "80000",
            cfo_code: "CFO-12",
            cfo_approved: true,
            urgency: "normal",
            priority: 2
          },
          {
            payment_request_id: "PR-9",
            amount: "45000",
            cfo_code: "CFO-07",
            cfo_approved: false,
            urgency: "high",
            priority: 1
          },
          {
            payment_request_id: "PR-11",
            amount: "30000",
            cfo_code: "CFO-03",
            cfo_approved: false,
            urgency: "normal",
            priority: 2
          }
        ]
      }
    },
    {
      id: "W-EXEC-PRIO-BAR",
      type: "chart_bar",
      title: "Приоритеты строк (W-ID-02)",
      priority: 30,
      data: {
        labels: ["PR-1", "PR-2", "PR-9", "PR-11"],
        series: [{ name: "priority", values: [1, 2, 1, 2] }]
      }
    },
    {
      id: "W-EXEC-DEADLINE",
      type: "note",
      title: "Исключения маршрута / дедлайн (W-ID-03)",
      priority: 40,
      data: {
        text: "ROUTE_EXCEPTION: PR-9, PR-11 без cfo_approved. registry_id=REG-1; дедлайн 12:00 (СТО-28-020 §6.2)."
      }
    }
  ],

  chief_accountant: [
    {
      id: "W-GB-KPI",
      type: "kpi_cards",
      title: "Реквизиты / замечания",
      priority: 10,
      data: {
        cards: [
          { key: "complete", label: "Реквизиты", value: "неполные", format: "text" },
          { key: "issues", label: "Замечаний", value: 2, format: "number" },
          { key: "advances", label: "Открытых авансов", value: 1, format: "number" }
        ]
      }
    },
    {
      id: "W-GB-REQS",
      type: "table",
      title: "Реквизиты счёта",
      priority: 20,
      data: {
        columns: [
          { key: "field", label: "Поле" },
          { key: "value", label: "Значение" }
        ],
        rows: [
          { field: "ИНН", value: "7701234567" },
          { field: "КПП", value: "—" },
          { field: "Банк", value: "не указан" }
        ]
      }
    },
    {
      id: "W-GB-ISSUES",
      type: "table",
      title: "Замечания главбуха",
      priority: 30,
      data: {
        columns: [
          { key: "code", label: "Код" },
          { key: "text", label: "Описание" }
        ],
        rows: [
          { code: "incomplete_requisites", text: "Неполный пакет реквизитов" },
          { code: "open_advances", text: "Есть незакрытый аванс поставщика" }
        ]
      }
    },
    {
      id: "W-GB-CHAIN",
      type: "note",
      title: "Цепочка согласований",
      priority: 40,
      data: {
        text: "cfo_approved=true; executive_registry=pending; fully_approved=false"
      }
    }
  ],

  accountant: [
    {
      id: "W-ACC-KPI",
      type: "kpi_cards",
      title: "Оплата / просрочка",
      priority: 10,
      data: {
        cards: [
          { key: "status", label: "Статус", value: "К оплате", format: "text" },
          { key: "overdue", label: "Просрочка", value: "нет", format: "text" },
          { key: "amount", label: "Сумма", value: "156700", format: "money" }
        ]
      }
    },
    {
      id: "W-ACC-QUEUE",
      type: "table",
      title: "Очередь к оплате (fully_approved)",
      priority: 20,
      data: {
        columns: [
          { key: "payment_request_id", label: "Заявка" },
          { key: "amount", label: "Сумма" },
          { key: "fully_approved", label: "Согласовано" },
          { key: "planned", label: "План оплаты" }
        ],
        rows: [
          {
            payment_request_id: "PR-778",
            amount: "156700",
            fully_approved: true,
            planned: "2026-07-22"
          },
          {
            payment_request_id: "PR-780",
            amount: "42000",
            fully_approved: true,
            planned: "2026-07-23"
          },
          {
            payment_request_id: "PR-701",
            amount: "99000",
            fully_approved: false,
            planned: "2026-07-21"
          }
        ]
      }
    },
    {
      id: "W-ACC-OVERDUE-BAR",
      type: "chart_bar",
      title: "Просрочки (дни)",
      priority: 30,
      data: {
        labels: ["PR-650", "PR-661", "PR-670"],
        series: [{ name: "days", values: [2, 5, 1] }]
      }
    },
    {
      id: "W-ACC-TIMELINE",
      type: "timeline",
      title: "Статусы оплаты",
      priority: 40,
      data: {
        items: [
          { label: "Согласовано", value: "2026-07-18", status: "ok" },
          { label: "В очереди", value: "сейчас", status: "pending" },
          { label: "Оплачено", value: "—", status: "pending" }
        ]
      }
    }
  ],

  legal_specialist: [
    {
      id: "W-LEG-KPI",
      type: "kpi_cards",
      title: "Авансы / претензии",
      priority: 10,
      data: {
        cards: [
          { key: "advances", label: "Открытых авансов", value: 2, format: "number" },
          { key: "claim", label: "Претензия", value: "черновик", format: "text" },
          { key: "sla", label: "SLA возврата", value: "10 р.д.", format: "text" }
        ]
      }
    },
    {
      id: "W-LEG-ADVANCES",
      type: "table",
      title: "Открытые авансы",
      priority: 20,
      data: {
        columns: [
          { key: "supplier_id", label: "Поставщик" },
          { key: "amount", label: "Сумма" },
          { key: "advance_date", label: "Дата аванса" }
        ],
        rows: [
          { supplier_id: "SUP-1", amount: "15000", advance_date: "2026-05-01" },
          { supplier_id: "SUP-1", amount: "8000", advance_date: "2026-06-10" }
        ]
      }
    },
    {
      id: "W-LEG-SLA",
      type: "timeline",
      title: "SLA претензии 2/3/10",
      priority: 30,
      data: {
        items: [
          { label: "Подготовка (2 р.д.)", value: "до 2026-07-22", status: "pending" },
          { label: "Отправка (3 р.д.)", value: "до 2026-07-23", status: "pending" },
          { label: "Возврат в тексте (10 р.д.)", value: "до 2026-08-01", status: "ok" }
        ]
      }
    },
    {
      id: "W-LEG-NOTE",
      type: "note",
      title: "Контекст CLAIM_REQUIRED / договор",
      priority: 40,
      data: {
        text: "supplier_id=SUP-1; contract=Д-2024/881; CLAIM_REQUIRED; ПЛ-34-048: штраф >10%"
      }
    }
  ]
};
