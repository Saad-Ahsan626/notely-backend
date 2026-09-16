import type { ValidationError } from 'class-validator';
import {
  flattenValidationErrors,
  ValidationException,
} from './validation.exception.js';

describe('flattenValidationErrors', () => {
  it('creates one entry per failed rule', () => {
    const errors: ValidationError[] = [
      {
        property: 'password',
        constraints: {
          isLength: 'password must be longer than or equal to 8 characters',
          matches: 'password must match the required pattern',
        },
        children: [],
      },
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      {
        field: 'password',
        message: 'password must be longer than or equal to 8 characters',
      },
      {
        field: 'password',
        message: 'password must match the required pattern',
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

  it('reports only the type error when a value has the wrong type', () => {
    const errors: ValidationError[] = [
      {
        property: 'search',
        constraints: {
          maxLength: 'search must be shorter than or equal to 100 characters',
          isString: 'search must be a string',
        },
        children: [],
      },
    ];

    expect(flattenValidationErrors(errors)).toEqual([
      { field: 'search', message: 'search must be a string' },
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
