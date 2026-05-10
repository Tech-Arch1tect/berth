import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/client';
import { fieldErrorsFromApiError } from './api-errors';

describe('fieldErrorsFromApiError', () => {
  it('returns the details map when the ApiError carries field-level errors', () => {
    const err = new ApiError(422, {
      success: false,
      error: {
        code: 'validation',
        message: 'Validation failed',
        details: { username: 'is required', password: 'too short' },
      },
    });
    expect(fieldErrorsFromApiError(err)).toEqual({
      username: 'is required',
      password: 'too short',
    });
  });

  it('returns an empty map when the ApiError has no details', () => {
    const err = new ApiError(400, {
      success: false,
      error: { code: 'bad_request', message: 'Top-level message' },
    });
    expect(fieldErrorsFromApiError(err)).toEqual({});
  });

  it('returns an empty map when the data envelope has no error key at all', () => {
    const err = new ApiError(500, { success: false });
    expect(fieldErrorsFromApiError(err)).toEqual({});
  });

  it('returns an empty map when the input is not an ApiError', () => {
    expect(fieldErrorsFromApiError(new Error('boom'))).toEqual({});
    expect(fieldErrorsFromApiError(null)).toEqual({});
    expect(fieldErrorsFromApiError(undefined)).toEqual({});
    expect(fieldErrorsFromApiError('string error')).toEqual({});
    expect(
      fieldErrorsFromApiError({ status: 422, data: { error: { details: { x: 'y' } } } })
    ).toEqual({});
  });

  it('returns an empty map when the ApiError data is null', () => {
    const err = new ApiError(500, null);
    expect(fieldErrorsFromApiError(err)).toEqual({});
  });
});
