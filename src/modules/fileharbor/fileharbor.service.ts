import {BadRequestException, Injectable, InternalServerErrorException, Logger} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as FormData from 'form-data';
import { firstValueFrom } from 'rxjs';
import { FileHarborImageDto } from './dto/file-harbor.dto';
import { ImageCleanupOptions } from "./interfaces/cleanup-options.interface";
import { FileHarborConfig } from "./interfaces/fileharbor-config.interface";

@Injectable()
export class FileHarborService {
  private readonly logger = new Logger(FileHarborService.name);

  // Constants
  private static readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ] as const;

  private static readonly MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly UPLOAD_TIMEOUT = 30000; // 30 seconds
  private static readonly DELETE_TIMEOUT = 15000; // 15 seconds

  constructor(
    private readonly httpService: HttpService,
  ) {}

  /**
   * Safely delete a single image
   */
  async deleteImageSafely(
    url: string | null | undefined,
    config: FileHarborConfig,
    options: ImageCleanupOptions = {}
  ): Promise<boolean> {
    if (!url) return true;

    const { throwOnError = false, loggerContext = 'SafeDelete' } = options;

    try {
      await this.deleteImageFromUrl(url, config);
      this.logDebug(`Successfully deleted: ${url}`, loggerContext);
      return true;
    } catch (error) {
      const errorMsg = `Failed to delete ${url}: ${error.message}`;

      if (throwOnError) {
        this.logger.error(errorMsg, error.stack);
        throw error;
      }

      this.logger.warn(errorMsg);
      return false;
    }
  }

  /**
   * Enhanced image upload with optional replacement of existing image
   */
  async uploadImageIfProvided(
    image: Express.Multer.File | undefined,
    entityName: string,
    externalId: string = '1',
    config: FileHarborConfig,
    existingImageUrl?: string,
    options: ImageCleanupOptions = {}
  ): Promise<string | null> {
    if (!image) return null;

    const { loggerContext = `Upload-${entityName}` } = options;
    this.logDebug(`Starting image upload for: ${entityName}`, loggerContext);

    try {
      const uploadResult = await this.uploadImage(
        image,
        `${entityName} Image`,
        externalId,
        config
      );

      // Clean up existing image if provided
      if (existingImageUrl) {
        await this.deleteImageSafely(existingImageUrl, config, {
          ...options,
          loggerContext: `${loggerContext}-Cleanup`,
        });
      }

      this.logDebug(`Upload completed: ${uploadResult.fullPath}`, loggerContext);
      return uploadResult.fullPath;
    } catch (error) {
      this.logger.error(`Failed to upload image for ${entityName}`, error.stack);
      throw new InternalServerErrorException(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Enhanced upload with validation
   */
  private async uploadImage(
    file: Express.Multer.File,
    description = 'Imported image',
    externalId: string,
    config: FileHarborConfig,
  ): Promise<FileHarborImageDto> {
    this.validateImageFile(file);

    try {
      const form = this.createFormData(file, { description, userId: externalId });

      const response = await firstValueFrom(
        this.httpService.post<FileHarborImageDto>(`${config.endpoint}/images`, form, {
          headers: {
            ...form.getHeaders(),
            'X-API-Key': config.apiKey,
          },
          timeout: FileHarborService.UPLOAD_TIMEOUT,
        }),
      );

      if (!response.data?.fullPath) {
        throw new Error('Upload succeeded but no URL returned');
      }

      this.logger.log(`Image uploaded: ${response.data.fullPath}`);
      return response.data;

    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Check if image exist on FileHarbor
   */
  async getImageFromId(url: string, config: FileHarborConfig): Promise<object | null> {
    if (!url) {
      throw new BadRequestException('URL is required');
    }

    const fileId = this.extractFileIdFromUrl(url);

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${config.endpoint}/images/${fileId}`, {
          headers: {
            'X-API-Key': config.apiKey,
          },
        }),
      );

      this.logger.log(`Image found for id ${fileId}`);
      return response.data;

    } catch (error) {
      this.logger.error(`Get image failed for ${fileId}: ${error.message}`);
    }

    return {};
  }

  /**
   * Enhanced delete with better ID extraction
   */
  async deleteImageFromUrl(url: string, config: FileHarborConfig): Promise<any> {
    if (!url) {
      throw new BadRequestException('URL is required');
    }

    const fileId = this.extractFileIdFromUrl(url);

    if (!fileId || fileId.length < 10) {
      throw new BadRequestException('Invalid file URL format');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.delete(`${config.endpoint}/images/${fileId}`, {
          headers: {
            'X-API-Key': config.apiKey,
          },
          timeout: FileHarborService.DELETE_TIMEOUT,
        }),
      );

      this.logger.log(`Image deleted: ${fileId}`);
      return response.data;

    } catch (error) {
      this.logger.error(`Delete failed for ${fileId}: ${error.message}`);

      // Don't throw for 404 errors (file already deleted)
      if (error.response?.status === 404) {
        this.logger.warn(`File already deleted: ${fileId}`);
        return { id: fileId, status: 'already_deleted' };
      }

      throw new InternalServerErrorException(`Delete failed: ${error.message}`);
    }
  }

  /**
   * Validate image file before upload
   */
  private validateImageFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!FileHarborService.ALLOWED_IMAGE_TYPES.includes(file.mimetype as any)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${FileHarborService.ALLOWED_IMAGE_TYPES.join(', ')}`
      );
    }

    if (file.size > FileHarborService.MAX_IMAGE_SIZE) {
      throw new BadRequestException(
        `File size too large. Maximum ${FileHarborService.MAX_IMAGE_SIZE / 1024 / 1024}MB allowed`
      );
    }
  }

  /**
   * Create FormData object from file and additional fields
   */
  private createFormData(
    file: Express.Multer.File,
    additionalFields: Record<string, string>
  ): FormData {
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype
    });

    Object.entries(additionalFields).forEach(([key, value]) => {
      form.append(key, value);
    });

    return form;
  }

  /**
   * Extract file ID from URL using multiple strategies
   */
  private extractFileIdFromUrl(url: string): string {
    // Strategy 1: Extract from /images/ path
    const imagesMatch = url.match(/\/images\/([^/?#]+)/);
    if (imagesMatch) return imagesMatch[1];

    // Strategy 2: Get last path segment
    const segments = url.split('/');
    return segments[segments.length - 1]?.split('?')[0] || '';
  }

  /**
   * Helper to log debug messages with context
   */
  private logDebug(message: string, context?: string): void {
    this.logger.debug(context ? `[${context}] ${message}` : message);
  }
}
