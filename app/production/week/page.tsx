'use client';

// /production/week — Farmer J week plan. Monday afternoon sets Wednesday to
// Sunday, Friday sets Monday to Wednesday. Products down, days across,
// batches in the cells, flex per day, approve the window in one go.

import WeekPlan from '@/components/Production/farmerj/WeekPlan';

export default function FjWeekPlanPage() {
  return <WeekPlan />;
}
