import type { ChangeEvent } from 'react';
import { ACCEPTED_LOGBOOK_TYPES, MAX_LOGBOOK_SIZE_BYTES, formatFileSize } from '../utils/logbookValidation';

interface LogbookUploadProps {
  file: File | null;
  error: string | null;
  disabled: boolean;
  /** Returns false if the file was rejected. */
  onFileChange: (file: File | null) => boolean;
}

/**
 * File inputs cannot be fully controlled in React (their value is read-only).
 * The parent remounts this component with a new `key` when the vehicle changes,
 * which clears the browser's selected file along with our state.
 */
export function LogbookUpload({ file, error, disabled, onFileChange }: LogbookUploadProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const accepted = onFileChange(event.target.files?.[0] ?? null);
    // Clear a rejected file from the input so the user can pick it again after fixing it.
    if (!accepted) event.target.value = '';
  }

  const hintId = 'logbook-hint';
  const errorId = 'logbook-error';

  return (
    <div className="field">
      <label htmlFor="logbook">Service logbook</label>
      <input
        id="logbook"
        name="logbook"
        type="file"
        accept={ACCEPTED_LOGBOOK_TYPES}
        disabled={disabled}
        aria-invalid={error !== null}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        onChange={handleChange}
      />
      <p id={hintId} className="hint">
        {disabled
          ? 'Select a badge to upload a logbook.'
          : `Plain text (.txt) only, up to ${formatFileSize(MAX_LOGBOOK_SIZE_BYTES)}.`}
      </p>
      {file && (
        <p className="file-name">
          Selected file: <strong>{file.name}</strong> ({formatFileSize(file.size)})
        </p>
      )}
      {error && (
        <p id={errorId} className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
