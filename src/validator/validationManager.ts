/* eslint-disable @typescript-eslint/no-magic-numbers */
import * as fs from 'fs';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import httpStatus from 'http-status-codes';
import union from '@turf/union';
import intersect from '@turf/intersect';
import area from '@turf/area';
import { Feature, MultiPolygon, Polygon } from 'geojson';
import { ProductType } from '@map-colonies/mc-model-types';
import Ajv from 'ajv';
import { SERVICES } from '../common/constants';
import { IConfig, UpdatePayload } from '../common/interfaces';
import { IngestionPayload } from '../common/interfaces';
import { AppError } from '../common/appError';
import { footprintSchema } from '../common/constants';
import { LookupTablesCall } from '../externalServices/lookupTables/requestCall';
import { CatalogCall } from '../externalServices/catalog/requestCall';
import * as polygonCalculates from './calculatePolygonFromTileset';
import { BoundingRegion, BoundingSphere, TileSetJson } from './interfaces';

@injectable()
export class ValidationManager {
  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(LookupTablesCall) private readonly lookupTables: LookupTablesCall,
    @inject(CatalogCall) private readonly catalog: CatalogCall
  ) {}

  public async validateIngestion(payload: IngestionPayload): Promise<boolean | string> {
    let result: boolean | string;

    result = this.validateModelName(payload.modelPath);
    if (typeof result == 'string') {
      return result;
    }
    result = this.validateTilesetJson(payload);
    if (typeof result == 'string') {
      return result;
    }
    result = this.validateDates(payload.metadata.sourceDateStart!, payload.metadata.sourceDateEnd!);
    if (typeof result == 'string') {
      return result;
    }
    result = this.validateResolutionMeter(payload.metadata.minResolutionMeter, payload.metadata.maxResolutionMeter);
    if (typeof result == 'string') {
      return result;
    }
    result = await this.validateClassification(payload.metadata.classification!);
    if (typeof result == 'string') {
      return result;
    }
    result = this.validateFootprint(payload.metadata.footprint as Polygon);
    if (typeof result == 'string') {
      return result;
    }
    if (payload.metadata.productId != undefined) {
      result = await this.validateProductID(payload.metadata.productId);
      if (typeof result == 'string') {
        return result;
      }
    }
    result = this.validateProductType(payload.metadata.productType!, payload.metadata.productName!);
    if (typeof result == 'string') {
      return result;
    }
    result = this.validateIntersection(payload);
    if (typeof result == 'string') {
      return result;
    }

    return true;
  }

  public async validateUpdate(identifier: string, payload: UpdatePayload): Promise<boolean | string> {
    let result: boolean | string;

    result = await this.validateRecordExistence(identifier);
    if (typeof result == 'string') {
      return result;
    }

    if (payload.classification != undefined) {
      result = await this.validateClassification(payload.classification);
      if (typeof result == 'string') {
        return result;
      }
    }
    return true;
  }

  public validateModelPath(sourcePath: string): boolean | string {
    const basePath = this.config.get<string>('paths.basePath');

    if (sourcePath.includes(basePath)) {
      return true;
    }
    return `Unknown model path! The model isn't in the agreed folder!, sourcePath: ${sourcePath}, basePath: ${basePath}`;
  }

  public async validateRecordExistence(identifier: string): Promise<boolean | string> {
    return (await this.catalog.isRecordExist(identifier)) ? true : `Record with identifier: ${identifier} doesn't exist!`;
  }

  private validateModelName(modelPath: string): boolean | string {
    if (fs.existsSync(`${modelPath}`)) {
      return true;
    }
    return `Unknown model name! The model name isn't in the folder!, modelPath: ${modelPath}`;
  }

  private validateTilesetJson(payload: IngestionPayload): boolean | string {
    if (!fs.existsSync(`${payload.modelPath}/${payload.tilesetFilename}`)) {
      return `Unknown tileset name! The tileset file wasn't found!, tileset: ${payload.tilesetFilename} doesn't exist`;
    }
    const fileContent: string = fs.readFileSync(`${payload.modelPath}/${payload.tilesetFilename}`, 'utf-8');
    try {
      JSON.parse(fileContent);
    } catch (error) {
      return `${payload.tilesetFilename} file that was provided isn't in a valid json format!`;
    }
    return true;
  }

  private async validateProductID(productId: string): Promise<boolean | string> {
    return (await this.catalog.isProductIdExist(productId)) ? true : `Record with productId: ${productId} doesn't exist!`;
  }

  // For now, the validation will be only warning.
  private validateProductType(productType: ProductType, modelName: string): boolean | string {
    if (productType != ProductType.PHOTO_REALISTIC_3D) {
      this.logger.warn({ msg: 'product type is not 3DPhotoRealistic. skipping intersection validation', modelName });
    }
    return true;
  }

  private validateFootprint(footprint: Polygon): boolean | string {
    if (!this.validatePolygonSchema(footprint)) {
      return `Invalid footprint provided. Must be in a GeoJson format of a Polygon. Should contain "type" and "coordinates" only. footprint: ${JSON.stringify(
        footprint
      )}`;
    }
    if (!this.validateCoordinates(footprint)) {
      return `Wrong footprint: ${JSON.stringify(footprint)} the first and last coordinates should be equal`;
    }
    return true;
  }

  private validateIntersection(payload: IngestionPayload): boolean | string {
    const file: string = fs.readFileSync(`${payload.modelPath}/${payload.tilesetFilename}`, 'utf8');
    const footprint = payload.metadata.footprint as Polygon;
    const limit: number = this.config.get<number>('validation.percentageLimit');
    let model: Polygon;

    try {
      this.logger.debug({ msg: 'extract polygon of the model', modelName: payload.metadata.productName });
      const shape = (JSON.parse(file) as TileSetJson).root.boundingVolume;

      if (shape.sphere != undefined) {
        model = polygonCalculates.convertSphereFromXYZToWGS84(shape as BoundingSphere);
      } else if (shape.region != undefined) {
        model = polygonCalculates.convertRegionFromRadianToDegrees(shape as BoundingRegion);
      } else if (shape.box != undefined) {
        return `BoundingVolume of box is not supported yet... Please contact 3D team.`;
      } else {
        return 'Bad tileset format. Should be in 3DTiles format';
      }

      this.logger.debug({ msg: 'extracted successfully polygon of the model', polygon: model, modelName: payload.metadata.productName });

      const intersection: Feature<Polygon | MultiPolygon> | null = intersect(footprint, model);

      this.logger.debug({
        msg: 'intersected successfully between footprint and polygon of the model',
        intersection,
        modelName: payload.metadata.productName,
      });

      if (intersection == null) {
        return `Wrong footprint! footprint's coordinates is not even close to the model!`;
      }

      const combined: Feature<Polygon | MultiPolygon> | null = union(footprint, model);

      this.logger.debug({ msg: 'combined successfully footprint and polygon of the model', combined, modelName: payload.metadata.productName });

      const areaFootprint = area(footprint);
      const areaCombined = area(combined!);
      this.logger.debug({
        msg: 'calculated successfully the areas',
        footprint: areaFootprint,
        combined: areaCombined,
        modelName: payload.metadata.productName,
      });
      const coverage = (100 * areaFootprint) / areaCombined;

      if (coverage < limit) {
        return `The footprint is not intersected enough with the model, the coverage is: ${coverage}% when the minimum coverage is ${limit}%`;
      }
      return true;
    } catch (error) {
      this.logger.error({
        msg: `An error caused during the validation of the intersection...`,
        modelName: payload.metadata.productName,
        error,
        payload,
      });
      throw new AppError('IntersectionError', httpStatus.INTERNAL_SERVER_ERROR, 'An error caused during the validation of the intersection', true);
    }
  }

  private validateDates(startDate: Date, endDate: Date): boolean | string {
    if (startDate <= endDate) {
      return true;
    }
    return 'sourceStartDate should not be later than sourceEndDate';
  }

  private validateResolutionMeter(minResolutionMeter: number | undefined, maxResolutionMeter: number | undefined): boolean | string {
    if (minResolutionMeter == undefined || maxResolutionMeter == undefined) {
      return true;
    }
    if (minResolutionMeter <= maxResolutionMeter) {
      return true;
    }
    return 'minResolutionMeter should not be bigger than maxResolutionMeter';
  }

  private async validateClassification(classification: string): Promise<boolean | string> {
    const classifications = await this.lookupTables.getClassifications();
    if (classifications.includes(classification)) {
      return true;
    }
    return `classification is not a valid value.. Optional values: ${classifications.join()}`;
  }

  private validateCoordinates(footprint: Polygon): boolean {
    const length = footprint.coordinates[0].length;
    const first = footprint.coordinates[0][0];
    const last = footprint.coordinates[0][length - 1];
    return first[0] == last[0] && first[1] == last[1];
  }

  private validatePolygonSchema(footprint: Polygon): boolean {
    const ajv = new Ajv();
    const compiledSchema = ajv.compile(footprintSchema);
    const isPolygon = compiledSchema(footprint);
    return isPolygon;
  }
}
