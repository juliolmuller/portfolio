import { notFound } from 'next/navigation';

import { AREA_CONFIG } from '@/components/admin/area-config';
import { findArea, idToSegment } from '@/components/admin/areas';
import { CollectionList } from '@/components/admin/collection-list';
import { DocumentEditor } from '@/components/admin/editor/form';
import { loadFormOptions } from '@/components/admin/form-options';
import { requireAdmin } from '@/lib/auth/session';
import { getAdminStore } from '@/lib/content/admin';

export default async function AreaPage({
  params,
}: PageProps<'/admin/[area]'>): Promise<React.JSX.Element> {
  await requireAdmin();

  const { area: slug } = await params;
  const area = findArea(slug);
  const config = AREA_CONFIG[slug];

  if (!area || !config) notFound();

  const store = getAdminStore();

  if (area.singleton) {
    const doc = await store.get(area.type, area.type);
    const options = await loadFormOptions(store, config);

    return (
      <DocumentEditor
        type={area.type}
        id={null}
        initial={doc ?? config.defaults()}
        rev={doc?.rev}
        readOnlyReason={store.readOnlyReason}
        basePath={`/admin/${slug}`}
        title={area.label}
        singleton
      >
        <config.Form {...options} />
      </DocumentEditor>
    );
  }

  const docs = await store.list(area.type);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-h2">{area.label}</h1>
      <div className="mt-6">
        <CollectionList
          type={area.type}
          singular={area.singular}
          plural={area.label.toLowerCase()}
          columns={config.columns}
          filterColumns={config.filterColumns ?? []}
          hasFeatured={config.hasFeatured === true}
          readOnly={store.readOnlyReason !== null}
          newHref={`/admin/${slug}/new`}
          rows={docs.map((doc) => ({
            id: doc.id,
            rev: doc.rev,
            href: `/admin/${slug}/${idToSegment(area.type, doc.id)}`,
            visible: doc['visible'] !== false,
            ...(config.hasFeatured ? { featured: doc['featured'] === true } : {}),
            cells: config.cells(doc),
          }))}
        />
      </div>
    </div>
  );
}
