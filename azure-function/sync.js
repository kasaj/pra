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
    try { body = await request.json(); } catch {
      return { status: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    if (!SYNC_SECRET || body.secret !== SYNC_SECRET) {
      return { status: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    try {
      const container = BlobServiceClient
        .fromConnectionString(CONNECTION_STRING)
        .getContainerClient(CONTAINER_NAME);
      await container.createIfNotExists();
      const blob = container.getBlockBlobClient(BLOB_NAME);

      // Download: body has no "data" field
      if (!body.data) {
        const exists = await blob.exists();
        if (!exists) return { status: 404, body: JSON.stringify({ error: 'No data stored yet' }) };
        const dl = await blob.download();
        const chunks = [];
        for await (const chunk of dl.readableStreamBody) chunks.push(chunk);
        context.log('Downloaded', chunks.reduce((s, c) => s + c.length, 0), 'bytes');
        return { status: 200, body: Buffer.concat(chunks).toString('utf-8') };
      }

      // Upload: body has "data" field
      const str = JSON.stringify(body.data);
      await blob.upload(str, Buffer.byteLength(str), {
        blobHTTPHeaders: { blobContentType: 'application/json' },
        overwrite: true,
      });
      context.log('Uploaded', Buffer.byteLength(str), 'bytes');
      return { status: 200, body: JSON.stringify({ ok: true }) };

    } catch (e) {
      context.error('Sync error:', e);
      return { status: 500, body: JSON.stringify({ error: e.message }) };
    }
  },
});
