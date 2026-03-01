/**
 * File System Service - работа с File System Access API
 */

/**
 * Запрашивает выбор директории у пользователя
 * Примечание: Должен вызываться из popup контекста, не из background
 */
export async function selectDirectory(): Promise<FileSystemDirectoryHandle | null> {
  // Эта функция должна вызываться из popup, не из background
  // Background service worker не имеет доступа к window
  console.warn('[FS Service] selectDirectory should be called from popup context');
  return null;
}

/**
 * Сохраняет файл в выбранной директории
 */
export async function saveFile(
  directoryHandle: FileSystemDirectoryHandle,
  filename: string,
  content: string
): Promise<boolean> {
  try {
    const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch (error) {
    console.error('[FS Service] Error saving file:', error);
    return false;
  }
}

/**
 * Сохраняет файл через Chrome Downloads API (fallback)
 */
export async function saveFileViaDownload(filename: string, content: string): Promise<void> {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  try {
    await chrome.downloads.download({
      url,
      filename,
      saveAs: true,
    });
  } catch (error) {
    console.error('[FS Service] Error downloading file:', error);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Сохраняет несколько файлов в директории
 */
export async function saveFiles(
  directoryHandle: FileSystemDirectoryHandle | null,
  files: Array<{ filename: string; content: string }>
): Promise<boolean> {
  if (!directoryHandle) {
    // Fallback на downloads API
    for (const file of files) {
      await saveFileViaDownload(file.filename, file.content);
    }
    return false;
  }

  let success = true;
  for (const file of files) {
    const result = await saveFile(directoryHandle, file.filename, file.content);
    if (!result) {
      success = false;
    }
  }

  return success;
}
