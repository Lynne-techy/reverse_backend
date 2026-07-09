export interface UploadedImageFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface HandwritingCheckResult {
  isPenHandwriting: boolean;
  text: string | null;
  similarityScore: number | null;
  scriptureReference: string | null;
  confidence: 'low' | 'medium' | 'high';
  notes: string | null;
}
