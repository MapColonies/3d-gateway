import { existsSync, readFileSync, constants as fsConstants } from 'node:fs';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { StatusCodes } from 'http-status-codes';
import { union, intersect, area, featureCollection, polygon } from '@turf/turf';
import { Feature, MultiPolygon, Polygon } from 'geojson';
import { ProductType } from '@map-colonies/mc-model-types';
import Ajv from 'ajv';
import { Tracer } from '@opentelemetry/api';
import { withSpanAsyncV4, withSpanV4 } from '@map-colonies/telemetry';
import { FILE_ENCODING, SERVICES } from '../common/constants';
import { IConfig, IngestionSourcesPayload, LogContext, Provider, SourcesValidationResponse, UpdatePayload } from '../common/interfaces';
import { IngestionPayload } from '../common/interfaces';
import { AppError } from '../common/appError';
import { footprintSchema } from '../common/constants';
import { LookupTablesCall } from '../externalServices/lookupTables/lookupTablesCall';
import { CatalogCall } from '../externalServices/catalog/catalogCall';
import { convertSphereFromXYZToWGS84, convertRegionFromRadianToDegrees } from './calculatePolygonFromTileset';
import { BoundingRegion, BoundingSphere, TileSetJson } from './interfaces';
import { extractLink } from './extractPathFromLink';

interface IsValidTilesetContentResponse {
  message?: string;
  polygon?: Polygon;
}

@injectable()
export class ValidationManager {
  private readonly basePath: string;
  private readonly limit: number;
  private readonly logContext: LogContext;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    @inject(LookupTablesCall) private readonly lookupTables: LookupTablesCall,
    @inject(CatalogCall) private readonly catalog: CatalogCall,
    @inject(SERVICES.PROVIDER) private readonly provider: Provider
  ) {
    this.logContext = {
      fileName: __filename,
      class: ValidationManager.name,
    };
    this.basePath = this.config.get<string>('paths.basePath');
    this.limit = this.config.get<number>('validation.percentageLimit');
  }

  @withSpanAsyncV4
  public async sourcesValid(payload: IngestionSourcesPayload): Promise<SourcesValidationResponse> {
    const isModelFileExists = await this.validateFilesExist(payload.modelPath);
    if (!isModelFileExists) {
      return {
        isValid: false,
        message: `Unknown model name! The model name isn't in the folder!, modelPath: ${payload.modelPath}`,
      };
    }

    const tilesetLocation = join(`${payload.modelPath}`, `${payload.tilesetFilename}`);
    const isTilesetExists = await this.validateFilesExist(tilesetLocation);
    if (!isTilesetExists) {
      return {
        isValid: false,
        message: `Unknown tileset name! The tileset file wasn't found!, tileset: ${payload.tilesetFilename} doesn't exist`,
      };
    }

    const isValidTilesetContentResponse: IsValidTilesetContentResponse = {
      polygon: undefined,
      message: undefined,
    };
    const isValidTilesetContent = await this.isValidTilesetContent(tilesetLocation, isValidTilesetContentResponse);
    if (!isValidTilesetContent) {
      return {
        isValid: false,
        message: isValidTilesetContentResponse.message,
      };
    }

    return {
      isValid: true,
    };
  }

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
    result = this.validatePolygon(payload.metadata.footprint as Polygon);
    if (typeof result == 'string') {
      return result;
    }
    const tilesetPath = `${payload.modelPath}/${payload.tilesetFilename}`;
    const file: string = readFileSync(`${tilesetPath}`, 'utf8');
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
      result = this.validatePolygon(payload.footprint);
      if (typeof result == 'string') {
        return result;
      }
      const tilesetPath = extractLink(record.links);

      const logContext = { ...this.logContext, function: this.validateUpdate.name };
      this.logger.debug({
        msg: 'Extracted full path to tileset',
        logContext,
        tilesetPath,
      });
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
    if (sourcePath.includes(this.basePath)) {
      const logContext = { ...this.logContext, function: this.validateModelPath.name };
      this.logger.debug({
        msg: 'modelPath validated successfully!',
        logContext,
      });
      return true;
    }
    return `Unknown model path! The model isn't in the agreed folder!, sourcePath: ${sourcePath}, basePath: ${this.basePath}`;
  }

  @withSpanV4
  private validateModelName(modelPath: string): boolean | string {
    if (existsSync(`${modelPath}`)) {
      const logContext = { ...this.logContext, function: this.validateModelName.name };
      this.logger.debug({
        msg: 'modelName validated successfully!',
        logContext,
      });
      return true;
    }
    return `Unknown model name! The model name isn't in the folder!, modelPath: ${modelPath}`;
  }

  @withSpanV4
  private validateTilesetJson(modelPath: string, tilesetFilename: string): boolean | string {
    if (!existsSync(`${modelPath}/${tilesetFilename}`)) {
      return `Unknown tileset name! The tileset file wasn't found!, tileset: ${tilesetFilename} doesn't exist`;
    }
    const fileContent: string = readFileSync(`${modelPath}/${tilesetFilename}`, FILE_ENCODING);
    try {
      JSON.parse(fileContent);
    } catch (error) {
      return `${tilesetFilename} file that was provided isn't in a valid json format!`;
    }
    const logContext = { ...this.logContext, function: this.validateTilesetJson.name };
    this.logger.debug({
      msg: 'tileset validated successfully!',
      logContext,
    });
    return true;
  }

  @withSpanAsyncV4
  private async validateProductID(productId: string): Promise<boolean | string> {
    if (!(await this.catalog.isProductIdExist(productId))) {
      return `Record with productId: ${productId} doesn't exist!`;
    }
    const logContext = { ...this.logContext, function: this.validateProductID.name };
    this.logger.debug({
      msg: 'productId validated successfully!',
      logContext,
    });
    return true;
  }

  @withSpanV4
  // For now, the validation will be only warning.
  private validateProductType(productType: ProductType, modelName: string): boolean | string {
    const logContext = { ...this.logContext, function: this.validateProductType.name };
    if (productType != ProductType.PHOTO_REALISTIC_3D) {
      this.logger.warn({
        msg: 'product type is not 3DPhotoRealistic. skipping intersection validation',
        logContext,
        modelName,
      });
    }
    this.logger.debug({
      msg: 'productType validated successfully!',
      logContext,
    });
    return true;
  }

  @withSpanV4
  private validatePolygon(polygon: Polygon): boolean | string {
    if (!this.validatePolygonSchema(polygon)) {
      return `Invalid polygon provided. Must be in a GeoJson format of a Polygon. Should contain "type" and "coordinates" only. polygon: ${JSON.stringify(
        polygon
      )}`;
    }
    if (!this.validateCoordinates(polygon)) {
      return `Wrong polygon: ${JSON.stringify(polygon)} the first and last coordinates should be equal`;
    }
    const logContext = { ...this.logContext, function: this.validatePolygon.name };
    this.logger.debug({
      msg: 'polygon validated successfully!',
      logContext,
    });
    return true;
  }

  @withSpanV4
  private validateIntersection(fileContent: string, footprint: Polygon, productName: string): boolean | string {
    let model: Polygon;
    const logContext = { ...this.logContext, function: this.validateIntersection.name };
    try {
      this.logger.debug({
        msg: 'extract polygon of the model',
        logContext,
        modelName: productName,
      });
      const shape = (JSON.parse(fileContent) as TileSetJson).root.boundingVolume;

      if (shape.sphere != undefined) {
        model = convertSphereFromXYZToWGS84(shape as BoundingSphere);
      } else if (shape.region != undefined) {
        model = convertRegionFromRadianToDegrees(shape as BoundingRegion);
      } else if (shape.box != undefined) {
        return `BoundingVolume of box is not supported yet... Please contact 3D team.`;
      } else {
        return 'Bad tileset format. Should be in 3DTiles format';
      }

      this.logger.debug({
        msg: 'extracted successfully polygon of the model',
        logContext,
        polygon: model,
        modelName: productName,
      });

      const intersection: Feature<Polygon | MultiPolygon> | null = intersect(
        featureCollection([polygon(footprint.coordinates), polygon(model.coordinates)])
      );

      this.logger.debug({
        msg: 'intersected successfully between footprint and polygon of the model',
        logContext,
        intersection,
        modelName: productName,
      });

      if (intersection == null) {
        return `Wrong footprint! footprint's coordinates is not even close to the model!`;
      }

      const combined: Feature<Polygon | MultiPolygon> | null = union(featureCollection([polygon(footprint.coordinates), polygon(model.coordinates)]));

      this.logger.debug({
        msg: 'combined successfully footprint and polygon of the model',
        logContext,
        combined,
        modelName: productName,
      });

      const areaFootprint = area(footprint);
      const areaCombined = area(combined!);
      this.logger.debug({
        msg: 'calculated successfully the areas',
        logContext,
        footprint: areaFootprint,
        combined: areaCombined,
        modelName: productName,
      });
      /* eslint-disable-next-line @typescript-eslint/no-magic-numbers */
      const coverage = (100 * areaFootprint) / areaCombined;

      if (coverage < this.limit) {
        return `The footprint intersection with the model doesn't reach minimum required threshold, the coverage is: ${coverage}% when the minimum coverage is ${this.limit}%`;
      }
      this.logger.debug({
        msg: 'intersection validated successfully!',
        logContext,
      });
      return true;
    } catch (error) {
      this.logger.error({
        msg: `An error caused during the validation of the intersection...`,
        logContext,
        modelName: productName,
        error,
      });
      throw new AppError('IntersectionError', StatusCodes.INTERNAL_SERVER_ERROR, 'An error caused during the validation of the intersection', true);
    }
  }

  @withSpanV4
  private validateDates(startDate: Date, endDate: Date): boolean | string {
    if (startDate <= endDate) {
      const logContext = { ...this.logContext, function: this.validateDates.name };
      this.logger.debug({
        msg: 'dates validated successfully!',
        logContext,
      });
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
      const logContext = { ...this.logContext, function: this.validateResolutionMeter.name };
      this.logger.debug({
        msg: 'resolutionMeters validated successfully!',
        logContext,
      });
      return true;
    }
    return 'minResolutionMeter should not be bigger than maxResolutionMeter';
  }

  @withSpanV4
  private async validateClassification(classification: string): Promise<boolean | string> {
    const classifications = await this.lookupTables.getClassifications();
    if (classifications.includes(classification)) {
      const logContext = { ...this.logContext, function: this.validateClassification.name };
      this.logger.debug({
        msg: 'classification validated successfully!',
        logContext,
      });
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

  //#region validate sources

  @withSpanV4
  private async isValidTilesetContent(fullPath: string, isValidTilesetContentResponse: IsValidTilesetContentResponse): Promise<boolean> {
    const logContext = { ...this.logContext, function: this.isValidTilesetContent.name };
    try {
      this.logger.debug({
        msg: 'Tileset validation started',
        logContext,
        fullPath: fullPath,
      });
      const fileContent: string = await readFile(fullPath, { encoding: FILE_ENCODING });
      const tileSetJson: TileSetJson = JSON.parse(fileContent) as TileSetJson;
      const shape = tileSetJson.root.boundingVolume;

      if (shape.sphere != undefined) {
        isValidTilesetContentResponse.polygon = convertSphereFromXYZToWGS84(shape as BoundingSphere);
      } else if (shape.region != undefined) {
        isValidTilesetContentResponse.polygon = convertRegionFromRadianToDegrees(shape as BoundingRegion);
      } else if (shape.box != undefined) {
        isValidTilesetContentResponse.message = `BoundingVolume of box is not supported yet... Please contact 3D team.`;
        return false;
      } else {
        isValidTilesetContentResponse.message = 'Bad tileset format. Should be in 3DTiles format';
        return false;
      }

      // TODO: refactor in next PR in order to return bool and better message
      const validatePolygonResult = this.validatePolygon(isValidTilesetContentResponse.polygon);
      if (typeof validatePolygonResult == 'string') {
        isValidTilesetContentResponse.message = validatePolygonResult;
        return false;
      }
    } catch (error) {
      const message = `File '${fullPath}' tileset validation failed`;
      this.logger.error({
        msg: message,
        logContext,
        fullPath,
        error,
      });
      isValidTilesetContentResponse.message = message;
      return false;
    }
    return true;
  }

  @withSpanV4
  private async validateFilesExist(fullPath: string): Promise<boolean> {
    const logContext = { ...this.logContext, function: this.validateFilesExist.name };
    this.logger.debug({
      msg: 'validate file exists started',
      logContext,
      fullPath,
    });

    const isValid: boolean = await access(fullPath, fsConstants.F_OK)
      .then(() => {
        return true;
      })
      .catch(() => {
        this.logger.error({
          msg: `File '${fullPath}' doesn't exists`,
          logContext,
          fullPath,
        });
        return false;
      });
    this.logger.debug({
      msg: 'validate file exists ended',
      logContext,
      fullPath,
      isValid,
    });
    return isValid;
  }

  ////#endregion
}
