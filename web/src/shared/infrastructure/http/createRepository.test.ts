import { describe, expect, it, vi } from 'vitest';
import * as z from 'zod';
import { rejectionOf } from '../../../test/httpClient';
import { AppError } from '../../domain/appError';
import { createRepository, type HttpGateway } from './createRepository';

const MeDto = z.object({ id: z.string() });

function setup(answer: unknown = { id: 'u1' }) {
  const request = vi.fn<HttpGateway['request']>().mockResolvedValue(answer);
  return { request, repository: createRepository({ request }) };
}

async function failureOf(promise: Promise<unknown>): Promise<AppError> {
  const error = await rejectionOf(promise);
  expect(error).toBeInstanceOf(AppError);
  return error as AppError;
}

describe('createRepository.fetchDto', () => {
  it('forwards the request untouched and returns the answer typed by the schema', async () => {
    const { request, repository } = setup();
    const call = { method: 'PUT', path: '/preferences/dashboard', body: { widgets: [] } } as const;

    const dto = await repository.fetchDto(call, MeDto);

    expect(request).toHaveBeenCalledExactlyOnceWith(call);
    expect(dto).toEqual({ id: 'u1' });
  });

  it('names a contract error by method and path, defaulting to GET, and leaves the query out', async () => {
    const { repository } = setup({ id: 42 });

    const error = await failureOf(repository.fetchDto({ path: '/carbs?limit=500' }, MeDto));

    expect(error.kind).toBe('unknown');
    expect(error.message).toContain('GET /carbs at id');
    expect(error.message).not.toContain('limit');
  });

  it('uses the endpoint label it is given, for a path that names a patient', async () => {
    const { repository } = setup({ id: 42 });

    const error = await failureOf(
      repository.fetchDto({ path: '/professional/patients/p-1/summary?tz=UTC' }, MeDto, 'GET /professional/patients/:id/summary'),
    );

    expect(error.message).toContain('GET /professional/patients/:id/summary at id');
    expect(error.message).not.toContain('p-1');
  });

  it('lets the client failure through unchanged', async () => {
    const { request, repository } = setup();
    request.mockRejectedValue(new AppError('unavailable'));

    const error = await failureOf(repository.fetchDto({ path: '/me' }, MeDto));

    expect(error.kind).toBe('unavailable');
  });
});

describe('createRepository.send', () => {
  it('sends the request and resolves with nothing', async () => {
    const { request, repository } = setup({ ignored: true });

    await expect(repository.send({ method: 'DELETE', path: '/preferences/dashboard' })).resolves.toBeUndefined();

    expect(request).toHaveBeenCalledExactlyOnceWith({ method: 'DELETE', path: '/preferences/dashboard' });
  });

  it('lets the client failure through', async () => {
    const { request, repository } = setup();
    request.mockRejectedValue(new AppError('forbidden'));

    expect((await failureOf(repository.send({ method: 'DELETE', path: '/x' }))).kind).toBe('forbidden');
  });
});
