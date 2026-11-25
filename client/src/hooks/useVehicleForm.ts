import { useEffect, useRef, useState } from 'react';
import { fetchBadges, fetchMakes, fetchModels, getErrorMessage, submitVehicle } from '../services/api';
import type { SubmissionResult } from '../types/api';
import type { MakeOption, VehicleSelection } from '../types/vehicle';
import { validateLogbookFile } from '../utils/logbookValidation';

const EMPTY_SELECTION: VehicleSelection = { make: '', model: '', badge: '' };

interface LoadingState {
  makes: boolean;
  models: boolean;
  badges: boolean;
}

/**
 * All state and behaviour for the vehicle form.
 *
 * Key ideas:
 * - Dependent fields are reset inside the event handler that changes their
 *   parent, so the UI never renders an invalid combination (no useEffect chains).
 * - Every selection change increments `selectionVersion`. An async response is
 *   applied only if its version is still current, so a slow response for an old
 *   selection can never overwrite the options for a newer one.
 */
export function useVehicleForm() {
  const [makes, setMakes] = useState<MakeOption[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [badges, setBadges] = useState<string[]>([]);
  const [selection, setSelection] = useState<VehicleSelection>(EMPTY_SELECTION);
  const [logbook, setLogbook] = useState<File | null>(null);
  const [logbookError, setLogbookError] = useState<string | null>(null);
  const [loading, setLoading] = useState<LoadingState>({ makes: true, models: false, badges: false });
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  const selectionVersion = useRef(0);
  // A ref (not state) so a rapid double-click is blocked before React re-renders.
  const submittingRef = useRef(false);

  // The only effect: load makes once when the form mounts.
  useEffect(() => {
    let ignore = false; // guards against StrictMode's double-mount and unmounting mid-request
    fetchMakes()
      .then((data) => {
        if (!ignore) setMakes(data);
      })
      .catch((error: unknown) => {
        if (!ignore) setOptionsError(getErrorMessage(error));
      })
      .finally(() => {
        if (!ignore) setLoading((prev) => ({ ...prev, makes: false }));
      });
    return () => {
      ignore = true;
    };
  }, []);

  const isCurrent = (version: number) => version === selectionVersion.current;

  /** Applies a new selection and clears everything that depended on the old one. */
  function startSelectionChange(next: VehicleSelection): number {
    selectionVersion.current += 1;
    setSelection(next);
    setLogbook(null);
    setLogbookError(null);
    setResult(null);
    setSubmitError(null);
    setOptionsError(null);
    return selectionVersion.current;
  }

  async function selectMake(make: string) {
    const version = startSelectionChange({ make, model: '', badge: '' });
    setModels([]);
    setBadges([]);
    setLoading((prev) => ({ ...prev, models: make !== '', badges: false }));
    if (!make) return;

    try {
      const options = await fetchModels(make);
      if (isCurrent(version)) setModels(options);
    } catch (error) {
      if (isCurrent(version)) setOptionsError(getErrorMessage(error));
    } finally {
      if (isCurrent(version)) setLoading((prev) => ({ ...prev, models: false }));
    }
  }

  async function selectModel(model: string) {
    const { make } = selection;
    const version = startSelectionChange({ make, model, badge: '' });
    setBadges([]);
    setLoading((prev) => ({ ...prev, badges: model !== '' }));
    if (!model) return;

    try {
      const options = await fetchBadges(make, model);
      if (isCurrent(version)) setBadges(options);
    } catch (error) {
      if (isCurrent(version)) setOptionsError(getErrorMessage(error));
    } finally {
      if (isCurrent(version)) setLoading((prev) => ({ ...prev, badges: false }));
    }
  }

  function selectBadge(badge: string) {
    startSelectionChange({ ...selection, badge });
  }

  /**
   * Fills all three fields at once. Uses the same reset logic and the same API
   * calls as manual selection, and only applies the preset if the server
   * confirms it is a valid combination.
   */
  async function quickSelect(vehicle: VehicleSelection) {
    const version = startSelectionChange(EMPTY_SELECTION);
    setModels([]);
    setBadges([]);
    setLoading((prev) => ({ ...prev, models: true, badges: true }));

    try {
      // fetchBadges fails with 404 if the make or model is unknown.
      const [modelOptions, badgeOptions] = await Promise.all([
        fetchModels(vehicle.make),
        fetchBadges(vehicle.make, vehicle.model),
      ]);
      if (!isCurrent(version)) return;

      if (!badgeOptions.includes(vehicle.badge)) {
        setOptionsError(`Badge "${vehicle.badge}" is no longer available for this vehicle.`);
        return;
      }
      setModels(modelOptions);
      setBadges(badgeOptions);
      setSelection({ make: vehicle.make, model: vehicle.model, badge: vehicle.badge });
    } catch (error) {
      if (isCurrent(version)) setOptionsError(getErrorMessage(error));
    } finally {
      if (isCurrent(version)) setLoading((prev) => ({ ...prev, models: false, badges: false }));
    }
  }

  /** Returns true when the file was accepted. */
  function selectLogbook(file: File | null): boolean {
    setResult(null);
    setSubmitError(null);

    const error = file ? validateLogbookFile(file) : null;
    setLogbookError(error);
    setLogbook(file && !error ? file : null);
    return error === null;
  }

  const isComplete = Boolean(selection.make && selection.model && selection.badge && logbook);

  async function submit() {
    if (submittingRef.current) return;
    if (!isComplete || !logbook) {
      setSubmitError('Select a make, model and badge, and choose a logbook file before submitting.');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    setResult(null);
    try {
      setResult(await submitVehicle({ ...selection, logbook }));
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return {
    makes,
    models,
    badges,
    selection,
    logbook,
    logbookError,
    loading,
    optionsError,
    isSubmitting,
    submitError,
    result,
    canSubmit: isComplete && !isSubmitting,
    selectMake,
    selectModel,
    selectBadge,
    quickSelect,
    selectLogbook,
    submit,
  };
}
