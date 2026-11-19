import { EXPORT_ERROR_PARAM, type ExportError } from '~/export-errors';
import { exportImport, type ExportedFile } from '~/server/export-import';

/**
 * Downloads the saved answers of a processed import as a Word file. When there is no file to
 * give, it sends the user back to the import page, which explains why.
 */
export async function GET(request: Request, { params }: RouteContext<'/imports/[id]/export'>) {
  const { id } = await params;
  const backToImport = (error: ExportError) => {
    const url = new URL(`/imports/${encodeURIComponent(id)}`, request.url);
    url.searchParams.set(EXPORT_ERROR_PARAM, error);
    return Response.redirect(url, 303);
  };

  let file: ExportedFile | null;
  try {
    file = await exportImport(id);
  } catch (error) {
    console.error(`Exporting import ${id} failed`, error);
    return backToImport('failed');
  }
  if (!file) return backToImport('unavailable');

  return new Response(file.content, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': file.disposition,
      'Cache-Control': 'no-store',
    },
  });
}
