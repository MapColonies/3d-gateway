import * as fs from 'fs';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import httpStatus from 'http-status-codes';
import { union, intersect, area, featureCollection, polygon } from '@turf/turf';
import { Feature, MultiPolygon, Polygon } from 'geojson';
import { ProductType } from '@map-colonies/mc-model-types';
import Ajv from 'ajv';
import { Tracer } from '@opentelemetry/api';
import { withSpanAsyncV4, withSpanV4 } from '@map-colonies/telemetry';
import { SERVICES } from '../common/constants';
import { IConfig, Provider, UpdatePayload } from '../common/interfaces';
import { IngestionPayload } from '../common/interfaces';
import { AppError } from '../common/appError';
import { footprintSchema } from '../common/constants';
import { LookupTablesCall } from '../externalServices/lookupTables/requestCall';
import { CatalogCall } from '../externalServices/catalog/requestCall';
import * as polygonCalculates from './calculatePolygonFromTileset';
import { BoundingRegion, BoundingSphere, TileSetJson } from './interfaces';
import { extractLink } from './extractPathFromLink';

@injectable()
export class ValidationManager {
  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    @inject(LookupTablesCall) private readonly lookupTables: LookupTablesCall,
    @inject(CatalogCall) private readonly catalog: CatalogCall,
    @inject(SERVICES.PROVIDER) private readonly provider: Provider
  ) {}

  @withSpanAsyncV4
  public async validateIngestion(payload: IngestionPayload): Promise<boolean | string> {
    let result: boolean | string;

    result = this.validateModelName(payload.modelPath);
    if (typeof result == 'string') {
      return result;
    }
    result = this.validateTilesetJson(payload.modelPath, payload.tilesetFilename);
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
    result = this.validateFootprint(payload.metadata.footprint as Polygon);
    if (typeof result == 'string') {
      return result;
    }
    const tilesetPath = `${payload.modelPath}/${payload.tilesetFilename}`;
    const file: string = fs.readFileSync(`${tilesetPath}`, 'utf8');
    result = this.validateIntersection(file, payload.metadata.footprint as Polygon, payload.metadata.productName!);

    if (typeof result == 'string') {
      return result;
    }
    result = this.validateProductType(payload.metadata.productType!, payload.metadata.productName!);
    if (typeof result == 'string') {
      return result;
    }
    if (payload.metadata.productId != undefined) {
      result = await this.validateProductID(payload.metadata.productId);
      if (typeof result == 'string') {
        return result;
      }
    }
    result = await this.validateClassification(payload.metadata.classification!);
    if (typeof result == 'string') {
      return result;
    }

    return true;
  }

  @withSpanAsyncV4
  public async validateUpdate(identifier: string, payload: UpdatePayload): Promise<boolean | string> {
    let result: boolean | string;
    const record = await this.catalog.getRecord(identifier);

    if (record === undefined) {
      return `Record with identifier: ${identifier} doesn't exist!`;
    }

    if (payload.sourceDateStart != undefined || payload.sourceDateEnd != undefined) {
      const sourceDateStart = payload.sourceDateStart ?? record.sourceDateStart!;
      const sourceDateEnd = payload.sourceDateEnd ?? record.sourceDateEnd!;
      result = this.validateDates(sourceDateStart, sourceDateEnd);
      if (typeof result == 'string') {
        return result;
      }
    }

    if (payload.footprint != undefined) {
      result = this.validateFootprint(payload.footprint);
      if (typeof result == 'string') {
        return result;
      }
      const tilesetPath = extractLink(record.links);
      this.logger.debug({ msg: 'Extracted full path to tileset', tilesetPath });
      const file = await this.provider.getFile(tilesetPath);
      result = this.validateIntersection(file, payload.footprint, payload.productName!);
      if (typeof result == 'string') {
        return result;
      }
    }

    if (payload.classification != undefined) {
      result = await this.validateClassification(payload.classification);
      if (typeof result == 'string') {
        return result;
      }
    }

    return true;
  }

  @withSpanV4
  public validateModelPath(sourcePath: string): boolean | string {
    const basePath = this.config.get<string>('paths.basePath');

    if (sourcePath.includes(basePath)) {
      this.logger.debug({ msg: 'modelPath validated successfully!' });
      return true;
    }
    return `Unknown model path! The model isn't in the agreed folder!, sourcePath: ${sourcePath}, basePath: ${basePath}`;
  }

  @withSpanV4
  private validateModelName(modelPath: string): boolean | string {
    if (fs.existsSync(`${modelPath}`)) {
      this.logger.debug({ msg: 'modelName validated successfully!' });
      return true;
    }
    return `Unknown model name! The model name isn't in the folder!, modelPath: ${modelPath}`;
  }

  @withSpanV4
  private validateTilesetJson(modelPath: string, tilesetFilename: string): boolean | string {
    if (!fs.existsSync(`${modelPath}/${tilesetFilename}`)) {
      return `Unknown tileset name! The tileset file wasn't found!, tileset: ${tilesetFilename} doesn't exist`;
    }
    const fileContent: string = fs.readFileSync(`${modelPath}/${tilesetFilename}`, 'utf-8');
    try {
      JSON.parse(fileContent);
    } catch (error) {
      return `${tilesetFilename} file that was provided isn't in a valid json format!`;
    }
    this.logger.debug({ msg: 'tileset validated successfully!' });
    return true;
  }

  @withSpanAsyncV4
  private async validateProductID(productId: string): Promise<boolean | string> {
    if (!(await this.catalog.isProductIdExist(productId))) {
      return `Record with productId: ${productId} doesn't exist!`;
    }
    this.logger.debug({ msg: 'productId validated successfully!' });
    return true;
  }

  @withSpanV4
  // For now, the validation will be only warning.
  private validateProductType(productType: ProductType, modelName: string): boolean | string {
    if (productType != ProductType.PHOTO_REALISTIC_3D) {
      this.logger.warn({ msg: 'product type is not 3DPhotoRealistic. skipping intersection validation', modelName });
    }
    this.logger.debug({ msg: 'productType validated successfully!' });
    return true;
  }

  @withSpanV4
  private validateFootprint(footprint: Polygon): boolean | string {
    if (!this.validatePolygonSchema(footprint)) {
      return `Invalid footprint provided. Must be in a GeoJson format of a Polygon. Should contain "type" and "coordinates" only. footprint: ${JSON.stringify(
        footprint
      )}`;
    }
    if (!this.validateCoordinates(footprint)) {
      return `Wrong footprint: ${JSON.stringify(footprint)} the first and last coordinates should be equal`;
    }
    this.logger.debug({ msg: 'footprint validated successfully!' });
    return true;
  }

  @withSpanV4
  private validateIntersection(fileContent: string, footprint: Polygon, productName: string): boolean | string {
    const limit: number = this.config.get<number>('validation.percentageLimit');
    let model: Polygon;

    try {
      this.logger.debug({ msg: 'extract polygon of the model', modelName: productName });
      const shape = (JSON.parse(fileContent) as TileSetJson).root.boundingVolume;

      if (shape.sphere != undefined) {
        model = polygonCalculates.convertSphereFromXYZToWGS84(shape as BoundingSphere);
      } else if (shape.region != undefined) {
        model = polygonCalculates.convertRegionFromRadianToDegrees(shape as BoundingRegion);
      } else if (shape.box != undefined) {
        return `BoundingVolume of box is not supported yet... Please contact 3D team.`;
      } else {
        return 'Bad tileset format. Should be in 3DTiles format';
      }

      this.logger.debug({ msg: 'extracted successfully polygon of the model', polygon: model, modelName: productName });

      const intersection: Feature<Polygon | MultiPolygon> | null = intersect(
        featureCollection([polygon(footprint.coordinates), polygon(model.coordinates)])
      );

      this.logger.debug({
        msg: 'intersected successfully between footprint and polygon of the model',
        intersection,
        modelName: productName,
      });

      if (intersection == null) {
        return `Wrong footprint! footprint's coordinates is not even close to the model!`;
      }

      const combined: Feature<Polygon | MultiPolygon> | null = union(featureCollection([polygon(footprint.coordinates), polygon(model.coordinates)]));

      this.logger.debug({ msg: 'combined successfully footprint and polygon of the model', combined, modelName: productName });

      const areaFootprint = area(footprint);
      const areaCombined = area(combined!);
      this.logger.debug({
        msg: 'calculated successfully the areas',
        footprint: areaFootprint,
        combined: areaCombined,
        modelName: productName,
      });
      /* eslint-disable-next-line @typescript-eslint/no-magic-numbers */
      const coverage = (100 * areaFootprint) / areaCombined;

      if (coverage < limit) {
        return `The footprint is not intersected enough with the model, the coverage is: ${coverage}% when the minimum coverage is ${limit}%`;
      }
      this.logger.debug({ msg: 'intersection validated successfully!' });
      return true;
    } catch (error) {
      this.logger.error({
        msg: `An error caused during the validation of the intersection...`,
        modelName: productName,
        error,
      });
      throw new AppError('IntersectionError', httpStatus.INTERNAL_SERVER_ERROR, 'An error caused during the validation of the intersection', true);
    }
  }

  @withSpanV4
  private validateDates(startDate: Date, endDate: Date): boolean | string {
    if (startDate <= endDate) {
      this.logger.debug({ msg: 'dates validated successfully!' });
      return true;
    }
    return 'sourceStartDate should not be later than sourceEndDate';
  }

  @withSpanV4
  private validateResolutionMeter(minResolutionMeter: number | undefined, maxResolutionMeter: number | undefined): boolean | string {
    if (minResolutionMeter == undefined || maxResolutionMeter == undefined) {
      return true;
    }
    if (minResolutionMeter <= maxResolutionMeter) {
      this.logger.debug({ msg: 'resolutionMeters validated successfully!' });
      return true;
    }
    return 'minResolutionMeter should not be bigger than maxResolutionMeter';
  }

  @withSpanV4
  private async validateClassification(classification: string): Promise<boolean | string> {
    const classifications = await this.lookupTables.getClassifications();
    if (classifications.includes(classification)) {
      this.logger.debug({ msg: 'classification validated successfully!' });
      return true;
    }
    return `classification is not a valid value.. Optional values: ${classifications.join()}`;
  }

  @withSpanV4
  private validateCoordinates(footprint: Polygon): boolean {
    const length = footprint.coordinates[0].length;
    const first = footprint.coordinates[0][0];
    const last = footprint.coordinates[0][length - 1];
    return first[0] == last[0] && first[1] == last[1];
  }

  @withSpanV4
  private validatePolygonSchema(footprint: Polygon): boolean {
    const ajv = new Ajv();
    const compiledSchema = ajv.compile(footprintSchema);
    const isPolygon = compiledSchema(footprint);
    return isPolygon;
  }
}
