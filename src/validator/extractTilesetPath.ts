import { StatusCodes } from 'http-status-codes';
import { AppError } from '../common/appError';
import { changeBasePathToPVPath, replaceBackQuotesWithQuotes } from '../model/models/utilities';

export const extractTilesetPath = (productSource: string, links: string): string => {
  const regex: RegExp = /api\/3d\/v1\/b3dm\/(?<modelId>[a-fA-F0-9-]+)\/(?<tilesetPath>.+)/;
  const match = links.match(regex);

  if (!match?.groups) {
    throw new AppError('BadLink', StatusCodes.BAD_REQUEST, `There is no good link in record, links: ${links}`, true);
  }
  const tilesetPath = match.groups.tilesetPath;
  const modelPath = replaceBackQuotesWithQuotes(changeBasePathToPVPath(productSource));
  const fullPath = `${modelPath}/${tilesetPath}`;
  return fullPath;
};
