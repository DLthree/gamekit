/** One problem in content: the file (relative to content/), the field path, what's wrong. */
export interface ContentError {
  file: string;
  path: string;
  message: string;
}

export function formatContentError(e: ContentError): string {
  return e.path === "" ? `${e.file}: ${e.message}` : `${e.file} › ${e.path}: ${e.message}`;
}

/** Records a problem at a file and field path. */
export type Push = (file: string, path: string, message: string) => void;
