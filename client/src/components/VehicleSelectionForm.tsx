import type { FormEvent } from 'react';
import { QUICK_SELECT_VEHICLES } from '../config/quickSelect';
import { useVehicleForm } from '../hooks/useVehicleForm';
import { LogbookUpload } from './LogbookUpload';
import { QuickSelectButtons } from './QuickSelectButtons';
import { SubmissionResult } from './SubmissionResult';
import { VehicleDropdown } from './VehicleDropdown';

const toOptions = (values: string[]) => values.map((value) => ({ value, label: value }));

export function VehicleSelectionForm() {
  const form = useVehicleForm();
  const { selection, loading, isSubmitting } = form;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void form.submit();
  }

  const makeLabel = (value: string) => form.makes.find((make) => make.value === value)?.label ?? value;

  return (
    <>
      <form className="card" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
        {/* Disabling the fieldset locks every control while a submission is in flight. */}
        <fieldset disabled={isSubmitting}>
          <legend className="visually-hidden">Vehicle details</legend>

          <QuickSelectButtons
            vehicles={QUICK_SELECT_VEHICLES}
            selection={selection}
            disabled={loading.makes}
            onSelect={(vehicle) => void form.quickSelect(vehicle)}
          />

          <div className="dropdowns">
            <VehicleDropdown
              id="make"
              label="Make"
              value={selection.make}
              options={form.makes}
              placeholder="Select a make"
              isLoading={loading.makes}
              onChange={(make) => void form.selectMake(make)}
            />
            <VehicleDropdown
              id="model"
              label="Model"
              value={selection.model}
              options={toOptions(form.models)}
              placeholder={selection.make ? 'Select a model' : 'Select a make first'}
              disabled={!selection.make}
              isLoading={loading.models}
              onChange={(model) => void form.selectModel(model)}
            />
            <VehicleDropdown
              id="badge"
              label="Badge"
              value={selection.badge}
              options={toOptions(form.badges)}
              placeholder={selection.model ? 'Select a badge' : 'Select a model first'}
              disabled={!selection.model}
              isLoading={loading.badges}
              onChange={form.selectBadge}
            />
          </div>

          {form.optionsError && (
            <p className="error" role="alert">
              {form.optionsError}
            </p>
          )}

          <LogbookUpload
            // A new key whenever the vehicle changes resets the native file input.
            key={`${selection.make}|${selection.model}|${selection.badge}`}
            file={form.logbook}
            error={form.logbookError}
            disabled={!selection.badge}
            onFileChange={form.selectLogbook}
          />

          <div className="actions">
            <button type="submit" className="button" disabled={!form.canSubmit}>
              {isSubmitting ? 'Submitting…' : 'Submit'}
            </button>
            {!form.canSubmit && !isSubmitting && (
              <p className="hint">Choose a make, model, badge and logbook file to submit.</p>
            )}
          </div>

          {form.submitError && (
            <p className="error" role="alert">
              {form.submitError}
            </p>
          )}
        </fieldset>
      </form>

      {form.result && <SubmissionResult result={form.result} makeLabel={makeLabel(form.result.data.make)} />}
    </>
  );
}
