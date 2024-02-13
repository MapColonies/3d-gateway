import { StatusCodes } from 'http-status-codes';
import { AppError } from '../common/appError';

export const extractLink = (link: string): string => {
  const regex = /api\/3d\/v1\/b3dm\/(?<path>.+)/;
  const match = link.match(regex);
  if (match?.groups) {
    return match.groups.path;
  }
  throw new AppError('', StatusCodes.INTERNAL_SERVER_ERROR, `Link extraction failed`, true);
};
