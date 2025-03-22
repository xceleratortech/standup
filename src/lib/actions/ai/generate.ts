'use server';

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { s3Client, S3_BUCKET, generateDownloadUrl } from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY || '');

export async function generateContentFromAudio(s3Keys: string[], prompt: string) {
  try {
    const fileDataArray: { fileUri: string; mimeType: string }[] = [];

    for (const s3Key of s3Keys) {
      // Fetch the file from S3
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
      });

      const response = await s3Client.send(command);
      const fileData = await response.Body?.transformToByteArray();

      if (!fileData) {
        throw new Error(`Failed to download file from S3 for key: ${s3Key}`);
      }

      // Determine MIME type (hardcoded for now, can be improved)
      const mimeType = 'audio/mp3';

      // Convert Uint8Array to Buffer
      const buffer = Buffer.from(fileData);

      // Upload the file to Google AI File Manager
      const uploadResult = await fileManager.uploadFile(buffer, {
        mimeType: mimeType,
        displayName: s3Key, // Use S3 key as display name
      });

      let file = await fileManager.getFile(uploadResult.file.name);
      while (file.state === FileState.PROCESSING) {
        process.stdout.write('.');
        // Sleep for 1 seconds
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        // Fetch the file from the API again
        file = await fileManager.getFile(uploadResult.file.name);
      }

      if (file.state === FileState.FAILED) {
        throw new Error('Audio processing failed.');
      }

      fileDataArray.push({
        fileUri: uploadResult.file.uri,
        mimeType: mimeType,
      });
    }

    // Generate content using the uploaded files
    const content = [prompt, ...fileDataArray.map((fileData) => ({ fileData }))];
    const result = await model.generateContent(content);
    const text = result.response.text();
    console.log('Generated content:', text);
    return text;
  } catch (error: any) {
    console.error('Error generating content from S3:', error);
    throw new Error(error.message || 'Failed to generate content from S3');
  }
}

export async function getTranscriptionFromAudioFile(
  contentItems: Array<{
    type: 'audiofile' | 'prompt';
    content: string; // S3 key for audiofile or text for prompt
  }>
) {
  try {
    const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY || '');

    // Process all items in the array, keeping them in the same order
    const processedItems = [];
    let fullPrompt = '';

    for (const item of contentItems) {
      if (item.type === 'prompt') {
        // Add to our accumulated prompt text
        fullPrompt += item.content + '\n\n';
        processedItems.push(item.content);
      } else if (item.type === 'audiofile') {
        // Process the audio file from S3
        const command = new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: item.content, // This is the S3 key
        });

        const response = await s3Client.send(command);
        const fileData = await response.Body?.transformToByteArray();

        if (!fileData) {
          console.warn(`Failed to download file from S3: ${item.content}`);
          continue; // Skip this file
        }

        // Convert Uint8Array to Buffer
        const buffer = Buffer.from(fileData);
        const mimeType = 'audio/mp3';

        // Upload to Google AI File Manager
        const uploadResult = await fileManager.uploadFile(buffer, {
          mimeType: mimeType,
          displayName: item.content,
        });

        let file = await fileManager.getFile(uploadResult.file.name);
        while (file.state === FileState.PROCESSING) {
          process.stdout.write('.');
          await new Promise((resolve) => setTimeout(resolve, 1_000));
          file = await fileManager.getFile(uploadResult.file.name);
        }

        if (file.state === FileState.FAILED) {
          console.warn(`Processing failed for file: ${item.content}`);
          continue;
        }

        // Add the processed file to our items array
        processedItems.push({
          type: 'audiofile',
          fileUri: uploadResult.file.uri,
          mimeType: mimeType,
        });
      }
    }

    const schema = {
      description: 'Detailed transcription of the audio file',
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          timestamp: {
            type: SchemaType.STRING,
            description: 'Timestamp of the audio segment',
            nullable: false,
          },
          speaker: {
            type: SchemaType.STRING,
            description: 'Speaker of the audio segment, preferably using their email if identified',
            nullable: false,
          },
          text: {
            type: SchemaType.STRING,
            description: 'The transcribed text, including voice inflections and nuances.',
            nullable: false,
          },
        },
        required: ['timestamp', 'speaker', 'text'],
        propertyOrdering: ['timestamp', 'speaker', 'text'],
      },
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
        // @ts-expect-error
        responseSchema: schema,
      },
    });

    // Prepare the model content input
    const modelInput = [
      ...processedItems.map((item) =>
        typeof item === 'string'
          ? item
          : {
              fileData: {
                fileUri: (item as any).fileUri,
                mimeType: (item as any).mimeType,
              },
            }
      ),
    ];

    const result = await model.generateContent(modelInput);
    const text = result.response.text();
    console.log('Generated transcription successfully');
    return text;
  } catch (error: any) {
    console.error('Error generating transcription from S3:', error);
    throw new Error(error.message || 'Failed to generate transcription from S3');
  }
}
