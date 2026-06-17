import { storageService } from '@/services/storage';
import { initializeContextMenu } from './contextMenu';
import { tabDetectionService } from './tabDetection';

initializeContextMenu();

tabDetectionService.initialize().catch((error) => {
  console.error('Error initializing tab detection service:', error);
});

void storageService.getReviewPromptState();
