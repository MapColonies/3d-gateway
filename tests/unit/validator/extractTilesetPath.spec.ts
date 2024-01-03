import { randWord } from '@ngneat/falso';
import { extractTilesetPath } from '../../../src/validator/extractTilesetPath';
import { createLink, createModelPath } from '../../helpers/helpers';
import { AppError } from '../../../src/common/appError';
import { changeBasePathToPVPath, replaceBackQuotesWithQuotes } from '../../../src/model/models/utilities';

describe('extractTilesetPath tests', () => {
  it('Should return the tilesetPath if links is valid', () => {
    const links = createLink();
    const productSource = createModelPath();
    const expected = `${replaceBackQuotesWithQuotes(changeBasePathToPVPath(productSource))}/tileset.json`;

    const result = extractTilesetPath(productSource, links);

    expect(result).toStrictEqual(expected);
  });

  it('Should return the tilesetPath if links contains sub-paths', () => {
    const links = createLink();
    const productSource = `${createModelPath()}/sub/path`;
    const expected = `${replaceBackQuotesWithQuotes(changeBasePathToPVPath(productSource))}/tileset.json`;

    const result = extractTilesetPath(productSource, links);

    expect(result).toStrictEqual(expected);
  });

  it('Should throw an error when links is not valid', () => {
    const links = randWord();
    const productSource = createModelPath();

    const result = () => {
      extractTilesetPath(productSource, links);
    };

    expect(result).toThrow(AppError);
  });
});
