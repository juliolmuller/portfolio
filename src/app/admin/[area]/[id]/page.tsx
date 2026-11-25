import { notFound } from 'next/navigation';

import { AREA_CONFIG } from '@/components/admin/area-config';
import { findArea, segmentToId } from '@/components/admin/areas';
import { DocumentEditor } from '@/components/admin/editor/form';
import { loadFormOptions } from '@/components/admin/form-options';
import { requireAdmin } from '@/lib/auth/session';
import { getAdminStore } from '@/lib/content/admin';

export default async function EditPage({
  params,
}: PageProps<'/admin/[area]/[id]'>): Promise<React.JSX.Element> {
  await requireAdmin();

  const { area: slug, id } = await params;
  const area = findArea(slug);
  const config = AREA_CONFIG[slug];

  if (!area || !config || area.singleton) notFound();

  const store = getAdminStore();
  const doc = await store.get(area.type, segmentToId(area.type, decodeURIComponent(id)));

  if (!doc) notFound();

  const options = await loadFormOptions(store, config);

  return (
    <DocumentEditor
      type={area.type}
      id={doc.id}
      initial={doc}
      rev={doc.rev}
      readOnlyReason={store.readOnlyReason}
      basePath={`/admin/${slug}`}
      title={`Edit ${config.name(doc) || area.singular}`}
      deleteConfirm={config.name(doc) || doc.id}
    >
      <config.Form {...options} />
    </DocumentEditor>
  );
}
