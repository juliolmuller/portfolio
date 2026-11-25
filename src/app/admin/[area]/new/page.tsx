import { notFound } from 'next/navigation';

import { AREA_CONFIG } from '@/components/admin/area-config';
import { findArea } from '@/components/admin/areas';
import { DocumentEditor } from '@/components/admin/editor/form';
import { loadFormOptions } from '@/components/admin/form-options';
import { requireAdmin } from '@/lib/auth/session';
import { getAdminStore } from '@/lib/content/admin';

export default async function NewPage({
  params,
}: PageProps<'/admin/[area]/new'>): Promise<React.JSX.Element> {
  await requireAdmin();

  const { area: slug } = await params;
  const area = findArea(slug);
  const config = AREA_CONFIG[slug];

  if (!area || !config || area.singleton) notFound();

  const store = getAdminStore();
  const options = await loadFormOptions(store, config);

  return (
    <DocumentEditor
      type={area.type}
      id={null}
      initial={config.defaults()}
      readOnlyReason={store.readOnlyReason}
      basePath={`/admin/${slug}`}
      title={`New ${area.singular}`}
    >
      <config.Form {...options} />
    </DocumentEditor>
  );
}
