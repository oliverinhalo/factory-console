import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueueView } from './QueueView';
import type { Client } from '../lib/github';

const QUEUE = {
  version: 1,
  items: [
    { id: 'a', title: 'Guitar cam', source: 'issue', issue: 4 },
    {
      id: 'b',
      title: 'Shift swap planner',
      source: 'console',
      brief: { mustHave: ['CSV import'] },
    },
    { id: 'c', title: 'Van load planner', source: 'bank' },
  ],
};

const writeFile = vi.fn();
const client = (content: unknown = QUEUE) =>
  ({
    repo: 'o/r',
    canWrite: true,
    fileWithSha: vi.fn().mockResolvedValue({ content: JSON.stringify(content), sha: 'sha1' }),
    writeFile,
  }) as unknown as Client;

const written = () =>
  JSON.parse(writeFile.mock.calls[0]?.[1] as string).items.map(
    (i: { title: string }) => i.title,
  );

beforeEach(() => writeFile.mockReset().mockResolvedValue('sha2'));

const ready = () => screen.findByText('Guitar cam');

describe('QueueView', () => {
  it('shows the order, numbered, with position 1 marked next', async () => {
    render(<QueueView client={client()} canEdit onChanged={() => {}} />);
    await ready();
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Guitar cam');
    expect(items[0]).toHaveTextContent('next');
    expect(items[2]).toHaveTextContent('Van load planner');
  });

  it('says where each item came from', async () => {
    render(<QueueView client={client()} canEdit onChanged={() => {}} />);
    await ready();
    expect(screen.getByText(/issue #4/)).toBeInTheDocument();
    expect(screen.getByText(/from the idea bank/)).toBeInTheDocument();
  });

  it('moves an item down and saves the new order', async () => {
    render(<QueueView client={client()} canEdit onChanged={() => {}} />);
    await ready();
    await userEvent.click(screen.getByRole('button', { name: /move Guitar cam down/i }));
    await userEvent.click(screen.getByRole('button', { name: /save the order/i }));
    await waitFor(() => expect(writeFile).toHaveBeenCalled());
    expect(written()).toEqual(['Shift swap planner', 'Guitar cam', 'Van load planner']);
  });

  it('promotes an item straight to the front', async () => {
    render(<QueueView client={client()} canEdit onChanged={() => {}} />);
    await ready();
    const rows = screen.getAllByRole('listitem');
    await userEvent.click(
      within(rows[2] as HTMLElement).getByRole('button', { name: /build next/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: /save the order/i }));
    await waitFor(() => expect(writeFile).toHaveBeenCalled());
    expect(written()[0]).toBe('Van load planner');
  });

  it('removes an item', async () => {
    render(<QueueView client={client()} canEdit onChanged={() => {}} />);
    await ready();
    await userEvent.click(screen.getByRole('button', { name: /remove Guitar cam/i }));
    await userEvent.click(screen.getByRole('button', { name: /save the order/i }));
    await waitFor(() => expect(writeFile).toHaveBeenCalled());
    expect(written()).toEqual(['Shift swap planner', 'Van load planner']);
  });

  it('does not write anything until you save', async () => {
    render(<QueueView client={client()} canEdit onChanged={() => {}} />);
    await ready();
    await userEvent.click(screen.getByRole('button', { name: /move Guitar cam down/i }));
    expect(writeFile).not.toHaveBeenCalled();
    expect(screen.getByText(/not saved yet/i)).toBeInTheDocument();
  });

  it('can discard unsaved changes', async () => {
    render(<QueueView client={client()} canEdit onChanged={() => {}} />);
    await ready();
    await userEvent.click(screen.getByRole('button', { name: /move Guitar cam down/i }));
    await userEvent.click(screen.getByRole('button', { name: /discard changes/i }));
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Guitar cam');
    expect(screen.queryByText(/not saved yet/i)).not.toBeInTheDocument();
  });

  it('edits a title and its must-haves', async () => {
    render(<QueueView client={client()} canEdit onChanged={() => {}} />);
    await ready();
    const rows = screen.getAllByRole('listitem');
    await userEvent.click(
      within(rows[0] as HTMLElement).getByRole('button', { name: /^edit$/i }),
    );
    const title = screen.getByLabelText(/^name$/i);
    await userEvent.clear(title);
    await userEvent.type(title, 'Guitar practice cam');
    await userEvent.type(screen.getByLabelText(/it must do these/i), 'Record from the webcam');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await userEvent.click(screen.getByRole('button', { name: /save the order/i }));
    await waitFor(() => expect(writeFile).toHaveBeenCalled());
    const items = JSON.parse(writeFile.mock.calls[0]?.[1] as string).items;
    expect(items[0].title).toBe('Guitar practice cam');
    expect(items[0].brief.mustHave).toEqual(['Record from the webcam']);
  });

  it('quotes the sha so a concurrent run cannot be clobbered', async () => {
    render(<QueueView client={client()} canEdit onChanged={() => {}} />);
    await ready();
    await userEvent.click(screen.getByRole('button', { name: /remove Guitar cam/i }));
    await userEvent.click(screen.getByRole('button', { name: /save the order/i }));
    await waitFor(() => expect(writeFile).toHaveBeenCalled());
    expect(writeFile.mock.calls[0]?.[2]).toBe('sha1');
  });

  it('surfaces a save failure instead of pretending it worked', async () => {
    // A local mock, not the shared one: reconfiguring a mock that already has a
    // resolved implementation let the rejection escape the click instead of
    // reaching the component's catch.
    const failing = {
      repo: 'o/r',
      canWrite: true,
      fileWithSha: vi.fn().mockResolvedValue({ content: JSON.stringify(QUEUE), sha: 'sha1' }),
      writeFile: vi.fn(() => Promise.reject(new Error('Someone else changed this first'))),
    } as unknown as Client;

    render(<QueueView client={failing} canEdit onChanged={() => {}} />);
    await ready();
    await userEvent.click(screen.getByRole('button', { name: /remove Guitar cam/i }));
    await userEvent.click(screen.getByRole('button', { name: /save the order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Someone else changed this first/,
    );
  });

  it('explains an empty queue rather than showing nothing', async () => {
    render(
      <QueueView client={client({ version: 1, items: [] })} canEdit onChanged={() => {}} />,
    );
    expect(await screen.findByText(/the queue is empty/i)).toBeInTheDocument();
  });

  it('hides the controls when it cannot edit', async () => {
    render(<QueueView client={client()} canEdit={false} onChanged={() => {}} />);
    await ready();
    expect(
      screen.queryByRole('button', { name: /move Guitar cam down/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/connect or sign in to change the order/i)).toBeInTheDocument();
  });
});
