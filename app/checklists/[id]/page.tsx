import { MOCK_TEMPLATES } from '../mockData';
import ChecklistTemplateEditor from '../ChecklistTemplateEditor';

export function generateStaticParams() {
  return MOCK_TEMPLATES.map((t) => ({ id: t.id }));
}

export default async function EditChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChecklistTemplateEditor mode="edit" templateId={id} />;
}
