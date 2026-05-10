import { redirect } from 'next/navigation';

export default function ProductionIndex() {
  redirect('/production/board');
}
