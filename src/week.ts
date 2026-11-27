import type { Weekday, WorkSchedule } from './types';

export const weekdays: { key: Weekday; label: string }[] = [
  { key: 'monday', label: 'Thứ hai' },
  { key: 'tuesday', label: 'Thứ ba' },
  { key: 'wednesday', label: 'Thứ tư' },
  { key: 'thursday', label: 'Thứ năm' },
  { key: 'friday', label: 'Thứ sáu' },
];

export const shifts = [
  { value: 'fulltime', label: 'Cả ngày' },
  { value: 'halfmorning', label: 'Buổi sáng' },
  { value: 'halfafternoon', label: 'Buổi chiều' },
  { value: 'online', label: 'Online' },
] as const;

export const emptySchedule = (): WorkSchedule => ({
  monday: null,
  tuesday: null,
  wednesday: null,
  thursday: null,
  friday: null,
});

export function getWorkWeek(today = new Date()): { dates: Date[]; label: string; startDate: string } {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const weekday = monday.getDay();
  monday.setDate(monday.getDate() + (weekday === 0 ? 1 : weekday === 6 ? 2 : 1 - weekday));
  const dates = weekdays.map((_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
  const format = (date: Date) => date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  const startDate = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  return { dates, label: `${format(dates[0])} – ${format(dates[4])}`, startDate };
}
