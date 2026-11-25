import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { ApiError, fetchBadges, fetchMakes, fetchModels, submitVehicle } from '../services/api';
import type { SubmissionResult } from '../types/api';

// Mock only the network functions; ApiError and getErrorMessage stay real.
vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return {
    ...actual,
    fetchMakes: vi.fn(),
    fetchModels: vi.fn(),
    fetchBadges: vi.fn(),
    submitVehicle: vi.fn(),
  };
});

const CATALOGUE: Record<string, Record<string, string[]>> = {
  ford: {
    Ranger: ['Raptor', 'Raptor X', 'Wildtrak'],
    Falcon: ['XR6', 'XR6 Turbo', 'XR8'],
  },
  tesla: {
    'Model 3': ['Performance', 'Long Range', 'Dual Motor'],
  },
  bmw: {
    '130d': ['xDrive 26d', 'xDrive 30d'],
  },
};

const notFound = () => new ApiError('Not found', 404, 'NOT_FOUND');

function mockCatalogueApi() {
  vi.mocked(fetchMakes).mockResolvedValue([
    { value: 'ford', label: 'Ford' },
    { value: 'bmw', label: 'BMW' },
    { value: 'tesla', label: 'Tesla' },
  ]);
  vi.mocked(fetchModels).mockImplementation(async (make) => {
    const models = CATALOGUE[make];
    if (!models) throw notFound();
    return Object.keys(models);
  });
  vi.mocked(fetchBadges).mockImplementation(async (make, model) => {
    const badges = CATALOGUE[make]?.[model];
    if (!badges) throw notFound();
    return badges;
  });
}

const makeSelect = () => screen.getByLabelText('Make') as HTMLSelectElement;
const modelSelect = () => screen.getByLabelText('Model') as HTMLSelectElement;
const badgeSelect = () => screen.getByLabelText('Badge') as HTMLSelectElement;
const fileInput = () => screen.getByLabelText('Service logbook') as HTMLInputElement;
const submitButton = () => screen.getByRole('button', { name: /submit/i });

const optionLabels = (select: HTMLSelectElement) =>
  within(select)
    .getAllByRole('option')
    .map((option) => option.textContent)
    .slice(1); // drop the placeholder

const textFile = (contents = 'Serviced at 10,000 km', name = 'logbook.txt', type = 'text/plain') =>
  new File([contents], name, { type });

async function renderForm() {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(makeSelect()).toBeEnabled());
  return user;
}

/** Selects a full vehicle through the dropdowns, waiting for each level to load. */
async function selectVehicle(user: ReturnType<typeof userEvent.setup>, make: string, model: string, badge: string) {
  await user.selectOptions(makeSelect(), make);
  await waitFor(() => expect(modelSelect()).toBeEnabled());
  await user.selectOptions(modelSelect(), model);
  await waitFor(() => expect(badgeSelect()).toBeEnabled());
  await user.selectOptions(badgeSelect(), badge);
}

beforeEach(() => {
  vi.resetAllMocks();
  mockCatalogueApi();
});

describe('VehicleSelectionForm', () => {
  it('starts with only the make enabled and submit disabled', async () => {
    await renderForm();

    expect(optionLabels(makeSelect())).toEqual(['Ford', 'BMW', 'Tesla']);
    expect(modelSelect()).toBeDisabled();
    expect(badgeSelect()).toBeDisabled();
    expect(fileInput()).toBeDisabled();
    expect(submitButton()).toBeDisabled();
  });

  it('loads models for the selected make, then badges for the selected model', async () => {
    const user = await renderForm();

    await user.selectOptions(makeSelect(), 'ford');
    await waitFor(() => expect(modelSelect()).toBeEnabled());
    expect(optionLabels(modelSelect())).toEqual(['Ranger', 'Falcon']);
    expect(badgeSelect()).toBeDisabled();

    await user.selectOptions(modelSelect(), 'Ranger');
    await waitFor(() => expect(badgeSelect()).toBeEnabled());
    expect(optionLabels(badgeSelect())).toEqual(['Raptor', 'Raptor X', 'Wildtrak']);
    expect(fileInput()).toBeDisabled();

    await user.selectOptions(badgeSelect(), 'Raptor');
    expect(fileInput()).toBeEnabled();
  });

  it('resets model and badge and loads new models when the make changes', async () => {
    const user = await renderForm();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    await user.selectOptions(makeSelect(), 'tesla');

    await waitFor(() => expect(optionLabels(modelSelect())).toEqual(['Model 3']));
    expect(modelSelect()).toHaveValue('');
    expect(badgeSelect()).toHaveValue('');
    expect(badgeSelect()).toBeDisabled();
    expect(fileInput()).toBeDisabled();
  });

  it('resets the badge and loads new badges when the model changes', async () => {
    const user = await renderForm();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    await user.selectOptions(modelSelect(), 'Falcon');

    await waitFor(() => expect(optionLabels(badgeSelect())).toEqual(['XR6', 'XR6 Turbo', 'XR8']));
    expect(badgeSelect()).toHaveValue('');
    expect(fileInput()).toBeDisabled();
  });

  it('clears the selected logbook when any vehicle selection changes', async () => {
    const user = await renderForm();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');
    await user.upload(fileInput(), textFile());
    expect(screen.getByText('logbook.txt')).toBeInTheDocument();

    await user.selectOptions(badgeSelect(), 'Wildtrak');

    expect(screen.queryByText('logbook.txt')).not.toBeInTheDocument();
    expect(fileInput().files).toHaveLength(0);
    expect(submitButton()).toBeDisabled();
  });

  it('populates all three dropdowns from a quick-select button', async () => {
    const user = await renderForm();

    await user.click(screen.getByRole('button', { name: 'Tesla Model 3 Performance' }));

    await waitFor(() => expect(badgeSelect()).toHaveValue('Performance'));
    expect(makeSelect()).toHaveValue('tesla');
    expect(modelSelect()).toHaveValue('Model 3');
    expect(optionLabels(badgeSelect())).toEqual(['Performance', 'Long Range', 'Dual Motor']);
    expect(fileInput()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Tesla Model 3 Performance' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('quick-select replaces an existing selection and clears the file', async () => {
    const user = await renderForm();
    await selectVehicle(user, 'tesla', 'Model 3', 'Long Range');
    await user.upload(fileInput(), textFile());

    await user.click(screen.getByRole('button', { name: 'Ford Ranger Raptor' }));

    await waitFor(() => expect(badgeSelect()).toHaveValue('Raptor'));
    expect(makeSelect()).toHaveValue('ford');
    expect(modelSelect()).toHaveValue('Ranger');
    expect(screen.queryByText('logbook.txt')).not.toBeInTheDocument();
  });

  it('ignores a slow response for a make the user has already changed away from', async () => {
    let resolveFord: (models: string[]) => void = () => {};
    vi.mocked(fetchModels).mockImplementation((make) =>
      make === 'ford'
        ? new Promise((resolve) => {
            resolveFord = resolve;
          })
        : Promise.resolve(['Model 3']),
    );
    const user = await renderForm();

    await user.selectOptions(makeSelect(), 'ford');
    await user.selectOptions(makeSelect(), 'tesla');
    await waitFor(() => expect(optionLabels(modelSelect())).toEqual(['Model 3']));

    resolveFord(['Ranger', 'Falcon']); // arrives late
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(makeSelect()).toHaveValue('tesla');
    expect(optionLabels(modelSelect())).toEqual(['Model 3']);
  });

  it('rejects a non-text file with an inline message', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<App />);
    await waitFor(() => expect(makeSelect()).toBeEnabled());
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    await user.upload(fileInput(), new File(['%PDF'], 'logbook.pdf', { type: 'application/pdf' }));

    expect(screen.getByRole('alert')).toHaveTextContent('"logbook.pdf" is not a .txt file');
    expect(submitButton()).toBeDisabled();
  });

  it('rejects a file over the size limit', async () => {
    const user = await renderForm();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    await user.upload(fileInput(), textFile('a'.repeat(1024 * 1024 + 1)));

    expect(screen.getByRole('alert')).toHaveTextContent('The maximum size is 1.0 MB');
    expect(submitButton()).toBeDisabled();
  });

  it('lets the user replace the selected file', async () => {
    const user = await renderForm();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    await user.upload(fileInput(), textFile('first', 'first.txt'));
    await user.upload(fileInput(), textFile('second', 'second.txt'));

    expect(screen.queryByText('first.txt')).not.toBeInTheDocument();
    expect(screen.getByText('second.txt')).toBeInTheDocument();
  });

  it('submits the selection and file, then shows the result as plain text', async () => {
    const contents = 'Serviced at 10,000 km\n<b>not bold</b>';
    const response: SubmissionResult = {
      message: 'Upload successful - there is no spoon',
      data: { make: 'ford', model: 'Ranger', badge: 'Raptor', logbookFileName: 'logbook.txt', logbookContents: contents },
    };
    vi.mocked(submitVehicle).mockResolvedValue(response);
    const user = await renderForm();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');
    const file = textFile(contents);
    await user.upload(fileInput(), file);

    await user.click(submitButton());

    expect(await screen.findByRole('status')).toHaveTextContent('there is no spoon');
    expect(submitVehicle).toHaveBeenCalledWith({ make: 'ford', model: 'Ranger', badge: 'Raptor', logbook: file });

    const result = screen.getByRole('region', { name: 'Submitted vehicle' });
    expect(within(result).getByText('Ford')).toBeInTheDocument();
    expect(within(result).getByText('Ranger')).toBeInTheDocument();
    expect(within(result).getByText('Raptor')).toBeInTheDocument();

    const logbook = screen.getByTestId('logbook-contents');
    expect(logbook.textContent).toBe(contents);
    expect(logbook.querySelector('b')).toBeNull(); // not interpreted as HTML
  });

  it('disables the form while submitting and prevents duplicate submissions', async () => {
    let finish: (value: SubmissionResult) => void = () => {};
    vi.mocked(submitVehicle).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const user = await renderForm();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');
    await user.upload(fileInput(), textFile());

    await user.click(submitButton());

    const pendingButton = screen.getByRole('button', { name: 'Submitting…' });
    expect(pendingButton).toBeDisabled();
    expect(makeSelect()).toBeDisabled();
    await user.click(pendingButton);
    expect(submitVehicle).toHaveBeenCalledTimes(1);

    finish({
      message: 'Upload successful - there is no spoon',
      data: { make: 'ford', model: 'Ranger', badge: 'Raptor', logbookFileName: 'logbook.txt', logbookContents: 'x' },
    });
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });

  it('clears a previous result when the selection changes', async () => {
    vi.mocked(submitVehicle).mockResolvedValue({
      message: 'Upload successful - there is no spoon',
      data: { make: 'ford', model: 'Ranger', badge: 'Raptor', logbookFileName: 'logbook.txt', logbookContents: 'x' },
    });
    const user = await renderForm();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');
    await user.upload(fileInput(), textFile());
    await user.click(submitButton());
    await screen.findByRole('status');

    await user.selectOptions(makeSelect(), 'bmw');

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the API error message when submission fails', async () => {
    vi.mocked(submitVehicle).mockRejectedValue(
      new ApiError('The logbook must be a plain text file (binary content detected).', 415, 'INVALID_FILE_CONTENT'),
    );
    const user = await renderForm();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');
    await user.upload(fileInput(), textFile());

    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('binary content detected');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(submitButton()).toBeEnabled(); // the user can retry
  });

  it('shows an error when vehicle options cannot be loaded', async () => {
    vi.mocked(fetchMakes).mockRejectedValue(
      new ApiError('Unable to reach the server. Check your connection and try again.', 0, 'NETWORK_ERROR'),
    );
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server');
  });
});
