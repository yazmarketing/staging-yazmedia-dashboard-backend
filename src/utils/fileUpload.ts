import multer from 'multer';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs/promises';

// Configure S3 client for DigitalOcean Spaces
function getS3Client() {
  return new S3Client({
    endpoint: process.env.SPACES_ENDPOINT,
    region: 'nyc3', // DigitalOcean region
    credentials: {
      accessKeyId: process.env.SPACES_ACCESS_KEY_ID!,
      secretAccessKey: process.env.SPACES_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: false, // DigitalOcean Spaces uses virtual host style
  });
}

const BUCKET_NAME = process.env.SPACES_BUCKET_NAME || 'doc';

// Multer configuration for file uploads
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Allow images and PDFs
    const allowedTypes = /jpeg|jpg|png|gif|pdf|pdf/i;
    const extname = allowedTypes.test(path.extname(file.originalname));
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (jpeg, jpg, png, gif) and PDF files are allowed'));
    }
  },
});

/**
 * Upload file to local storage (fallback for development)
 */
async function uploadFileToLocal(
  file: Express.Multer.File,
  folder: string
): Promise<string> {
  const uploadsDir = path.join(process.cwd(), 'uploads', folder);
  
  // Create directory if it doesn't exist
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (error) {
    console.error('Error creating uploads directory:', error);
    throw new Error('Failed to create uploads directory');
  }

  const fileExtension = path.extname(file.originalname);
  const fileName = `${uuidv4()}${fileExtension}`;
  const filePath = path.join(uploadsDir, fileName);

  try {
    await fs.writeFile(filePath, file.buffer);
    
    // Return URL that will be served by Express static middleware
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const fileUrl = `${baseUrl}/uploads/${folder}/${fileName}`;
    
    console.log('✅ File saved locally:', fileUrl);
    return fileUrl;
  } catch (error: any) {
    console.error('❌ Error saving file locally:', error);
    throw new Error(`Failed to save file: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Upload file to DigitalOcean Spaces or fallback to local storage
 */
export async function uploadFileToSpaces(
  file: Express.Multer.File,
  folder: string
): Promise<string> {
  // Check if DigitalOcean Spaces is configured
  const isSpacesConfigured = 
    process.env.SPACES_ENDPOINT &&
    process.env.SPACES_ACCESS_KEY_ID &&
    process.env.SPACES_SECRET_ACCESS_KEY &&
    process.env.SPACES_CDN_URL;

  // If Spaces is not configured, use local storage (development fallback)
  if (!isSpacesConfigured) {
    console.log('⚠️ DigitalOcean Spaces not configured, using local file storage');
    return await uploadFileToLocal(file, folder);
  }

  // Validate required environment variables
  if (!process.env.SPACES_ENDPOINT) {
    throw new Error('SPACES_ENDPOINT environment variable is not set');
  }
  if (!process.env.SPACES_ACCESS_KEY_ID) {
    throw new Error('SPACES_ACCESS_KEY_ID environment variable is not set');
  }
  if (!process.env.SPACES_SECRET_ACCESS_KEY) {
    throw new Error('SPACES_SECRET_ACCESS_KEY environment variable is not set');
  }
  if (!process.env.SPACES_CDN_URL) {
    throw new Error('SPACES_CDN_URL environment variable is not set');
  }

  const fileExtension = path.extname(file.originalname);
  const fileName = `${folder}/${uuidv4()}${fileExtension}`;

  const uploadParams = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read' as const,
  };

  try {
    console.log('📤 Uploading file to Spaces:', {
      bucket: BUCKET_NAME,
      key: fileName,
      size: file.buffer.length,
      contentType: file.mimetype,
    });

    const s3Client = getS3Client();
    await s3Client.send(new PutObjectCommand(uploadParams));
    
    const fileUrl = `${process.env.SPACES_CDN_URL}/${fileName}`;
    console.log('✅ File uploaded successfully to:', fileUrl);
    return fileUrl;
  } catch (error: any) {
    console.error('❌ Error uploading file to Spaces:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.Code,
      region: error.$metadata?.region,
      requestId: error.$metadata?.requestId,
    });
    throw new Error(`Failed to upload file: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Generate signed URL for file access (optional, if private files)
 */
export async function generateSignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const s3Client = getS3Client();
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
  return url;
}

/**
 * Download file from URL (from old Supabase URLs)
 */
export function downloadFileFromUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode}`));
        return;
      }
      
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
  });
}

/**
 * Copy file from old storage to new storage
 */
export async function migrateFileFromSupabase(
  oldUrl: string,
  folder: string,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  try {
    // Download file from old URL
    const fileBuffer = await downloadFileFromUrl(oldUrl);

    // Create a temporary file object for multer
    const file = {
      buffer: fileBuffer,
      originalname: path.basename(oldUrl),
      mimetype: mimeType,
      size: fileBuffer.length,
    } as Express.Multer.File;

    // Upload to new storage
    return await uploadFileToSpaces(file, folder);
  } catch (error) {
    console.error(`Error migrating file from ${oldUrl}:`, error);
    throw error;
  }
}

