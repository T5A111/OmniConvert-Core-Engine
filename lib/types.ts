export type ConversionType = 'image' | 'video' | 'audio' | 'document' | 'pdf';

export interface FileConversionTask {
  id: string;
  file: any;
  files?: File[];
  targetFormat: string;
  type?: string; 
  options?: any;
}

export interface ConversionResult {
  id: string;
  blob?: Blob;
  blobs?: { name: string, blob: Blob }[];
  filename?: string;
  success: boolean;
  status?: string;
  error?: string;
}
