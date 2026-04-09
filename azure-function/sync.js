const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const SYNC_SECRET = process.env.SYNC_SECRET;
const CONTAINER_NAME = process.env.CONTAINER_NAME || 'pra-sync';
const BLOB_NAME = process.env.BLOB_NAME || 'sync.json';

function getBlob() {
  return BlobServiceClient
    .fromConnectionString(CONNECTION_STRING)
    .getContainerClient(CONTAINER_NAME)
    .getBlockBlobClient(BLOB_NAME);
}

function checkSecret(secret) {
  return SYNC_SECRET && secret === SYNC_SECRET;
}

// POST /api/sync  — upload: body { secret, data }
app.http('syncUpload', {
  methods: ['POST'],
  route: 'sync',
  authLevel: 'anonymous',
  handler: async (request, context) => {
    let body;
    try { body = await request.json(); } catch {
      return { status: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
    if (!checkSecret(body.secret)) {
      return { status: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    if (!body.data) {
      return { status: 400, body: JSON.stringify({ error: 'Missing data' }) };
    }
    try {
      const container = BlobServiceClient
        .fromConnectionString(CONNECTION_STRING)
        .getContainerClient(CONTAINER_NAME);
      await container.createIfNotExists();
      const blob = container.getBlockBlobClient(BLOB_NAME);
      const str = JSON.stringify(body.data);
      await blob.upload(str, Buffer.byteLength(str), {
        blobHTTPHeaders: { blobContentType: 'application/json' },
        overwrite: true,
      });
      context.log('Uploaded', Buffer.byteLength(str), 'bytes');
      return { status: 200, body: JSON.stringify({ ok: true }) };
    } catch (e) {
      context.error('Upload error:', e);
      return { status: 500, body: JSON.stringify({ error: e.message }) };
    }
  },
});

// GET /api/sync?secret=...  — download
app.http('syncDownload', {
  methods: ['GET'],
  route: 'sync',
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const secret = new URL(request.url).searchParams.get('secret');
    if (!checkSecret(secret)) {
      return { status: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    try {
      const container = BlobServiceClient
        .fromConnectionString(CONNECTION_STRING)
        .getContainerClient(CONTAINER_NAME);
      await container.createIfNotExists();
      const blob = container.getBlockBlobClient(BLOB_NAME);
      const exists = await blob.exists();
      context.log(`Download check: container=${CONTAINER_NAME} blob=${BLOB_NAME} exists=${exists}`);
      if (!exists) {
        return { status: 404, body: JSON.stringify({ error: 'No data stored yet', container: CONTAINER_NAME, blob: BLOB_NAME }) };
      }
      const dl = await blob.download();
      const chunks = [];
      for await (const chunk of dl.readableStreamBody) chunks.push(chunk);
      const responseBody = Buffer.concat(chunks).toString('utf-8');
      context.log('Downloaded', responseBody.length, 'bytes');
      return { status: 200, body: responseBody };
    } catch (e) {
      context.error('Download error:', e);
      return { status: 500, body: JSON.stringify({ error: e.message }) };
    }
  },
});
