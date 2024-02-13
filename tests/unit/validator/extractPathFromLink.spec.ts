import { randWord } from '@ngneat/falso';
import { extractLink } from '../../../src/validator/extractPathFromLink';
import { AppError } from '../../../src/common/appError';

describe('Extract Path From Link', () => {
  it('Should extract the path from link', () => {
    const expected = randWord();
    const link = `http://bla/api/3d/v1/b3dm/${expected}`;

    const result = extractLink(link);

    expect(result).toStrictEqual(expected);
  });

  it(`Should throw error when didn't find a path`, () => {
    const link = `http://bla/api/3d/v1/b3dm`;

    const result = () => extractLink(link);

    expect(result).toThrow(AppError);
  });
});
