import type { ValidationError } from 'class-validator';
import {
  flattenValidationErrors,
  ValidationException,
} from './validation.exception.js';

describe('flattenValidationErrors', () => {
  it('creates one entry per failed rule', () => {
    const errors: ValidationError[] = [
      {
        property: 'title',
        constraints: {
          isString: 'title must be a string',
          isLength: 'title must be shorter than or equal to 255 characters',
        },
        children: [],
      },
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { field: 'title', message: 'title must be a string' },
      {
        field: 'title',
        message: 'title must be shorter than or equal to 255 characters',
      },
    ]);
  });

  it('builds dot paths for nested objects and arrays', () => {
    const errors: ValidationError[] = [
      {
        property: 'tags',
        children: [
          {
            property: '0',
            children: [
              {
                property: 'name',
                constraints: { isNotEmpty: 'name should not be empty' },
                children: [],
              },
            ],
          },
        ],
      },
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { field: 'tags.0.name', message: 'name should not be empty' },
    ]);
  });

  it('reports unknown properties rejected by the whitelist', () => {
    const errors: ValidationError[] = [
      {
        property: 'userId',
        constraints: {
          whitelistValidation: 'property userId should not exist',
        },
        children: [],
      },
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { field: 'userId', message: 'property userId should not exist' },
    ]);
  });
});

describe('ValidationException', () => {
  it('is a 400 carrying the details', () => {
    const details = [{ field: 'email', message: 'email must be an email' }];
    const exception = new ValidationException(details);

    expect(exception.getStatus()).toBe(400);
    expect(exception.message).toBe('Validation failed');
    expect(exception.details).toBe(details);
  });
});
