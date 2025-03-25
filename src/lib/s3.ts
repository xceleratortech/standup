import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
export const s3Client = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
});

export const S3_BUCKET = process.env.S3_BUCKET || 'standup';

// Generate a signed URL for uploading a file to S3
export async function generateUploadUrl(key: string, contentType: string, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

// Generate a signed URL for downloading a file from S3
export async function generateDownloadUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

// Generate a unique key for a file in S3
export function generateFileKey(workspaceId: string, meetingId: string, fileName: string) {
  const timestamp = Date.now();
  const extension = fileName.split('.').pop();
  return `recordings/${workspaceId}/${meetingId}/${timestamp}.${extension}`;
}

// Add function to delete a single file from S3
export async function deleteFile(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  return s3Client.send(command);
}

// Add function to delete multiple files from S3
export async function deleteFiles(keys: string[]) {
  if (keys.length === 0) return;

  const command = new DeleteObjectsCommand({
    Bucket: S3_BUCKET,
    Delete: {
      Objects: keys.map((key) => ({ Key: key })),
      Quiet: false,
    },
  });

  return s3Client.send(command);
}

// Add function to list files with a specific prefix
export async function listFiles(prefix: string) {
  const command = new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: prefix,
  });

  const response = await s3Client.send(command);
  return response.Contents || [];
}
