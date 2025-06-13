/// <reference types="@cloudflare/workers-types" />

/**
 * R2 Utility for PaceNote Service
 * 
 * Simple utility for reading files from Cloudflare R2 storage.
 * Co-located with PaceNote service as it's the primary consumer.
 */

/**
 * Read a file from an R2 bucket and return its content as text
 * 
 * @param bucket - R2 bucket binding
 * @param key - Object key (file path)
 * @returns Promise with the file content as text
 */
export async function readFileAsText(bucket: R2Bucket, key: string): Promise<string> {
  const object = await bucket.get(key);
  
  if (!object) {
    throw new Error(`File not found: ${key}`);
  }

  return await object.text();
}
