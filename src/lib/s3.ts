import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
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
export async function generateUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
) {
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
export function generateFileKey(
  workspaceId: string,
  meetingId: string,
  fileName: string
) {
  const timestamp = Date.now();
  const extension = fileName.split('.').pop();
  return `recordings/${workspaceId}/${meetingId}/${timestamp}.${extension}`;
}
