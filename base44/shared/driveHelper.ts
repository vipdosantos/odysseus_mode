// Helpers para Google Drive: encontrar/criar pasta por cliente e subir PDFs.
// Usa o token do conector googledrive (modo compartilhado).

const ROOT_FOLDER_NAME = "Modelajes - Documentos";

export async function ensureClientFolder(accessToken: string, clientName: string): Promise<string> {
  // 1. pasta raiz do app
  const rootId = await findOrCreateFolder(accessToken, ROOT_FOLDER_NAME, null);
  // 2. subpasta do cliente
  const safeName = (clientName || "Cliente").trim() || "Cliente";
  return await findOrCreateFolder(accessToken, safeName, rootId);
}

async function findOrCreateFolder(accessToken: string, name: string, parentFolderId: string | null): Promise<string> {
  const escName = name.replace(/'/g, "\\'");
  let q = `mimeType='application/vnd.google-apps.folder' and name='${escName}' and trashed=false`;
  if (parentFolderId) q += ` and '${parentFolderId}' in parents`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (data.files && data.files.length > 0) return data.files[0].id;

  const body: any = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentFolderId) body.parents = [parentFolderId];
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const created = await createRes.json();
  if (!created.id) throw new Error("Falha ao criar pasta no Google Drive");
  return created.id;
}

export async function uploadPdfToFolder(
  accessToken: string,
  folderId: string,
  fileName: string,
  pdfBytes: ArrayBuffer
): Promise<{ id: string; webViewLink: string }> {
  const metadata = { name: fileName, parents: [folderId] };
  const boundary = "base44_" + Math.random().toString(36).slice(2);
  const head =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) + "\r\n" +
    `--${boundary}\r\n` +
    "Content-Type: application/pdf\r\n\r\n";
  const tail = `\r\n--${boundary}--\r\n`;

  const blob = new Blob(
    [
      new TextEncoder().encode(head),
      new Uint8Array(pdfBytes),
      new TextEncoder().encode(tail),
    ],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: blob,
    }
  );
  const j = await res.json();
  if (!j.id) throw new Error("Falha ao enviar arquivo para o Google Drive");
  return { id: j.id, webViewLink: j.webViewLink };
}