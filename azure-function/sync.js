const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const SYNC_SECRET = process.env.SYNC_SECRET;
const CONTAINER_NAME = process.env.CONTAINER_NAME || 'pra-sync';
const BLOB_NAME = process.env.BLOB_NAME || 'sync.json';

app.http('sync', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    if (!SYNC_SECRET || body.secret !== SYNC_SECRET) {
      return { status: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const action = (body.action || '').toString().trim();
    context.log('action received:', JSON.stringify(action));

    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
      const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
      await containerClient.createIfNotExists();
      const blobClient = containerClient.getBlockBlobClient(BLOB_NAME);

      // --- UPLOAD: store client data as-is ---
      if (action === 'upload') {
        if (!body.data) return { status: 400, body: JSON.stringify({ error: 'Missing data' }) };
        const str = JSON.stringify(body.data);
        await blobClient.upload(str, Buffer.byteLength(str), {
          blobHTTPHeaders: { blobContentType: 'application/json' },
          conditions: {},
          overwrite: true,
        });
        return { status: 200, body: JSON.stringify({ ok: true }) };
      }

      // --- DOWNLOAD: return stored data ---
      if (action === 'download') {
        const exists = await blobClient.exists();
        if (!exists) return { status: 404, body: JSON.stringify({ error: 'No data stored yet' }) };
        const download = await blobClient.download();
        const chunks = [];
        for await (const chunk of download.readableStreamBody) chunks.push(chunk);
        return { status: 200, body: Buffer.concat(chunks).toString('utf-8') };
      }

      return { status: 400, body: JSON.stringify({ error: `unknown action: ${action}` }) };
    } catch (e) {
      context.error('Sync error:', e);
      return { status: 500, body: JSON.stringify({ error: 'Internal error', detail: e.message }) };
    }
  },
});
