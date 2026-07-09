export interface UploadedImageFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface HandwritingCheckResult {
  isPenHandwriting: boolean;
  text: string | null;
  confidence: 'low' | 'medium' | 'high';
  notes: string | null;
}
