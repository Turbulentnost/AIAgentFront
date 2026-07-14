import type {
  MeetingScheduleContext,
  MeetingScheduleSeriesDetail,
  MeetingScheduleSeriesItem
} from "@/types/meetings";

export const meetingScheduleItems: MeetingScheduleSeriesItem[] = [
  {
    id: "series-1",
    name: "Оперативное совещание дирекции",
    type: "planned",
    participant_roles: ["Операционный директор", "Финансовый директор"],
    extra_participants_count: 4,
    frequency_label: "еженедельно, понедельник 09:00",
    deadline_start: "2026-01-01",
    deadline_end: "2026-12-31",
    status: "scheduled",
    sort_order: 1
  },
  {
    id: "series-2",
    name: "Квартальный отчёт по KPI",
    type: "report",
    participant_roles: ["Генеральный директор", "Руководитель аналитики"],
    extra_participants_count: 2,
    frequency_label: "ежеквартально, 1-й четверг 14:00",
    deadline_start: "2026-01-01",
    deadline_end: "2026-12-31",
    status: "created",
    sort_order: 2
  },
  {
    id: "series-3",
    name: "Технический совет",
    type: "planned",
    participant_roles: ["Операционный директор", "Главный инженер"],
    extra_participants_count: 5,
    frequency_label: "еженедельно, вторник 10:00",
    deadline_start: "2026-01-01",
    deadline_end: "2026-12-31",
    status: "scheduled",
    sort_order: 3
  },
  {
    id: "series-4",
    name: "Селектор кандидатов на вакансию",
    type: "selector",
    participant_roles: ["HR-директор", "Руководитель подразделения"],
    extra_participants_count: 1,
    frequency_label: "по мере необходимости",
    deadline_start: "2026-03-01",
    deadline_end: "2026-06-30",
    status: "scheduled",
    sort_order: 4
  },
  {
    id: "series-5",
    name: "Срочное совещание по инциденту",
    type: "unplanned",
    participant_roles: ["Дежурный инженер", "Руководитель смены"],
    extra_participants_count: 0,
    frequency_label: "разово",
    deadline_start: "2026-07-10",
    deadline_end: "2026-07-10",
    status: "archive",
    sort_order: 5
  },
  {
    id: "series-6",
    name: "Еженедельный статус проектов",
    type: "planned",
    participant_roles: ["Руководитель проектного офиса"],
    extra_participants_count: 6,
    frequency_label: "еженедельно, среда 11:00",
    deadline_start: "2026-01-01",
    deadline_end: "2026-12-31",
    status: "scheduled",
    sort_order: 6
  },
  {
    id: "series-7",
    name: "Отчёт по безопасности",
    type: "report",
    participant_roles: ["Директор по безопасности"],
    extra_participants_count: 3,
    frequency_label: "ежемесячно, последняя пятница 16:00",
    deadline_start: "2026-01-01",
    deadline_end: "2026-12-31",
    status: "scheduled",
    sort_order: 7
  },
  {
    id: "series-8",
    name: "Стратегическая сессия",
    type: "planned",
    participant_roles: ["Генеральный директор", "Совет директоров"],
    extra_participants_count: 8,
    frequency_label: "ежеквартально, 3-й вторник 10:00",
    deadline_start: "2026-01-01",
    deadline_end: "2026-12-31",
    status: "created",
    sort_order: 8
  }
];

export const meetingScheduleTypeCounts = {
  total: 24,
  planned: 12,
  report: 6,
  selector: 3,
  unplanned: 3
};

export const meetingScheduleContext: MeetingScheduleContext = {
  type_counts: meetingScheduleTypeCounts,
  items: meetingScheduleItems,
  fetched_at: "2026-07-14T12:00:00+03:00"
};

export const meetingScheduleDetails: Record<string, MeetingScheduleSeriesDetail> = {
  "series-3": {
    series_id: "series-3",
    past_meetings: [
      {
        id: "past-1",
        date_label: "23.09.2026",
        time_label: "10:00–11:30",
        protocol_number: "ПР-2026-089",
        outcome_label: "проведено",
        outcome_tone: "success"
      },
      {
        id: "past-2",
        date_label: "16.09.2026",
        time_label: "10:00–11:00",
        protocol_number: "ПР-2026-082",
        outcome_label: "завершено",
        outcome_tone: "success"
      },
      {
        id: "past-3",
        date_label: "09.09.2026",
        time_label: "10:00–11:30",
        protocol_number: "ПР-2026-075",
        outcome_label: "проведено",
        outcome_tone: "success"
      },
      {
        id: "past-4",
        date_label: "02.09.2026",
        time_label: "10:00–10:45",
        protocol_number: null,
        outcome_label: "перенесено",
        outcome_tone: "warning"
      }
    ],
    next_meeting: {
      date_label: "30.09.2026",
      time_range_label: "10:00–11:30",
      format_label: "очно + ВКС"
    }
  }
};

export function getMeetingScheduleDetail(seriesId: string): MeetingScheduleSeriesDetail {
  return meetingScheduleDetails[seriesId] ?? {
    series_id: seriesId,
    past_meetings: [],
    next_meeting: null
  };
}
