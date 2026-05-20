/**
 * Base DTO with common fields for both Images and Avatars
 */
export abstract class FileHarborBaseDto {
  id: string;
  userId?: string;
  format: string;
  width?: number;
  height?: number;
  size: number;
  mimeType: string;
  isOptimized: boolean;
  views: number;
  downloads: number;
  createdAt: string | Date;
  url: string;
  thumbnailUrl?: string;
  fullPath: string;
}

/**
 * DTO for /images endpoint response
 */
export class FileHarborImageDto extends FileHarborBaseDto {
  user?: string;
  client?: string;
  originalName?: string;
  isPrivate?: boolean;
  tags?: string[];
  description?: string;
}
