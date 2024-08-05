import { constants as fsConstants } from 'node:fs';
import { readFile, access } from 'node:fs/promises';
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
import { IConfig, IngestionSourcesPayload, LogContext, Provider, ValidationResponse, UpdatePayload } from '../common/interfaces';
import { IngestionPayload } from '../common/interfaces';
import { AppError } from '../common/appError';
import { footprintSchema } from '../common/constants';
import { LookupTablesCall } from '../externalServices/lookupTables/lookupTablesCall';
import { CatalogCall } from '../externalServices/catalog/catalogCall';
import { convertSphereFromXYZToWGS84, convertRegionFromRadianToDegrees } from './calculatePolygonFromTileset';
import { BoundingRegion, BoundingSphere, TileSetJson } from './interfaces';
import { extractLink } from './extractPathFromLink';

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
  public async sourcesValid(payload: IngestionSourcesPayload, tilesetLocation: string): Promise<ValidationResponse> {
    const isModelFileExists = await this.validateFilesExist(payload.adjustedModelPath!);
    if (!isModelFileExists) {
      return {
        isValid: false,
        message: `Unknown model name! The model name isn't in the folder!, modelPath: ${payload.adjustedModelPath}`,
      };
    }

    const isTilesetExists = await this.validateFilesExist(tilesetLocation);
    if (!isTilesetExists) {
      return {
        isValid: false,
        message: `Unknown tileset name! The tileset file wasn't found!, tileset: ${payload.tilesetFilename} doesn't exist`,
      };
    }

    const polygonResponse = await this.getTilesetModelPolygon(tilesetLocation);
    if (typeof polygonResponse == 'string') {
      return {
        isValid: false,
        message: polygonResponse,
      };
    }

    // TODO: refactor in next PR in order to return bool and better message
    const sourcesValidationResponse: ValidationResponse = this.isPolygonValid(polygonResponse);
    return sourcesValidationResponse;
  }

  @withSpanAsyncV4
  public async isMetadataValid(payload: IngestionPayload, tilesetLocation: string): Promise<ValidationResponse> {
    const logContext = { ...this.logContext, function: this.isMetadataValid.name };
    this.logger.debug({
      msg: 'metadataValid started',
      payload,
      logContext,
    });

    let result = this.isDatesValid(payload.metadata.sourceDateStart!, payload.metadata.sourceDateEnd!);
    if (!result) {
      return {
        isValid: false,
        message: 'sourceStartDate should not be later than sourceEndDate',
      };
    }

    result = this.isResolutionMeterValid(payload.metadata.minResolutionMeter, payload.metadata.maxResolutionMeter);
    if (!result) {
      return {
        isValid: false,
        message: 'minResolutionMeter should not be bigger than maxResolutionMeter',
      };
    }

    const sourcesValidationResponse: ValidationResponse = this.isPolygonValid(payload.metadata.footprint as Polygon);
    if (!sourcesValidationResponse.isValid) {
      return sourcesValidationResponse;
    }

    const polygonResponse = await this.getTilesetModelPolygon(tilesetLocation);
    if (typeof polygonResponse == 'string') {
      return {
        isValid: false,
        message: 'failed to extract tileset polygon', // NOTE: this shouldn't happen as we call validateSources before
      };
    }

    const validationResponse: ValidationResponse = this.isFootprintAndModelIntersects(payload.metadata.footprint as Polygon, polygonResponse);
    if (!validationResponse.isValid) {
      return validationResponse;
    }

    result = this.isProductTypeValid(payload.metadata.productType!);
    if (!result) {
      // For now, this validation will not occur as it returns true.
      return {
        isValid: false,
        message: 'product type is not 3DPhotoRealistic!',
      };
    }

    result = await this.isProductIdValid(payload.metadata.productId!);
    if (!result) {
      return {
        isValid: false,
        message: `Record with productId: ${payload.metadata.productId} doesn't exist!`,
      };
    }

    return this.isClassificationValid(payload.metadata.classification!);
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
        return `The footprint intersectection with the model doesn't reach minimum required threshhold, the coverage is: ${coverage}% when the minimum coverage is ${this.limit}%`;
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

  @withSpanAsyncV4
  private async isProductIdValid(productId: string): Promise<boolean> {
    if (!productId) {
      return true;
    }
    const logContext = { ...this.logContext, function: this.isProductIdValid.name };
    this.logger.debug({
      msg: 'productId validation started',
      productId,
      logContext,
    });
    const result = await this.catalog.isProductIdExist(productId);
    this.logger.debug({
      msg: `productId validation finished: ${result}`,
      productId,
      logContext,
    });
    return result;
  }

  @withSpanV4
  private async isClassificationValid(classification: string): Promise<ValidationResponse> {
    const logContext = { ...this.logContext, function: this.isClassificationValid.name };
    this.logger.debug({
      msg: 'Classification validation started',
      logContext,
    });
    const classifications = await this.lookupTables.getClassifications();
    const result = classifications.includes(classification);
    this.logger.debug({
      msg: `Classification validation ended: ${result}`,
      classifications,
      logContext,
    });

    if (!result) {
      return {
        isValid: false,
        message: `classification is not a valid value.. Optional values: ${classifications.join()}`,
      };
    } else {
      return { isValid: true };
    }
  }

  //#region validate sources

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

  private async getTilesetModelPolygon(fullPath: string): Promise<Polygon | string> {
    const logContext = { ...this.logContext, function: this.getTilesetModelPolygon.name };
    try {
      const fileContent: string = await readFile(fullPath, { encoding: FILE_ENCODING });
      const tileSetJson: TileSetJson = JSON.parse(fileContent) as TileSetJson;
      const shape = tileSetJson.root.boundingVolume;
      if (shape.sphere != undefined) {
        return convertSphereFromXYZToWGS84(shape as BoundingSphere);
      } else if (shape.region != undefined) {
        return convertRegionFromRadianToDegrees(shape as BoundingRegion);
      } else if (shape.box != undefined) {
        return `BoundingVolume of box is not supported yet... Please contact 3D team.`;
      } else {
        return 'Bad tileset format. Should be in 3DTiles format';
      }
    } catch (error) {
      const message = `File '${fullPath}' tileset validation failed`;
      this.logger.error({
        msg: message,
        logContext,
        fullPath,
        error,
      });
      return message;
    }
  }

  ////#endregion

  private isFootprintAndModelIntersects(footprint: Polygon, modelPolygon: Polygon): ValidationResponse {
    const logContext = { ...this.logContext, function: this.isFootprintAndModelIntersects.name };
    try {
      this.logger.debug({
        msg: 'isFootprintAndModelIntersects started',
        logContext,
        modelPolygon,
        footprint,
      });

      const intersection: Feature<Polygon | MultiPolygon> | null = intersect(
        featureCollection([polygon(footprint.coordinates), polygon(modelPolygon.coordinates)])
      );

      this.logger.debug({
        msg: 'intersected successfully between footprint and polygon of the model',
        logContext,
        intersection,
      });

      if (intersection == null) {
        return {
          isValid: false,
          message: `Wrong footprint! footprint's coordinates is not even close to the model!`,
        };
      }

      const combined: Feature<Polygon | MultiPolygon> | null = union(
        featureCollection([polygon(footprint.coordinates), polygon(modelPolygon.coordinates)])
      );

      this.logger.debug({
        msg: 'combined successfully footprint and polygon of the model',
        logContext,
        combined,
      });

      const areaFootprint = area(footprint);
      const areaCombined = area(combined!);
      this.logger.debug({
        msg: 'calculated successfully the areas',
        logContext,
        footprint: areaFootprint,
        combined: areaCombined,
      });
      /* eslint-disable-next-line @typescript-eslint/no-magic-numbers */
      const coverage = (100 * areaFootprint) / areaCombined;

      if (coverage < this.limit) {
        return {
          isValid: false,
          message: `The footprint intersectection with the model doesn't reach minimum required threshhold, the coverage is: ${coverage}% when the minimum coverage is ${this.limit}%`,
        };
      }
      this.logger.debug({
        msg: 'intersection validated successfully!',
        logContext,
      });
      return {
        isValid: true,
      };
    } catch (error) {
      this.logger.error({
        msg: `An error caused during the validation of the intersection...`,
        logContext,
        error,
        modelPolygon,
        footprint,
      });
      return {
        isValid: false,
        message: 'An error caused during the validation of the intersection',
      };
    }
  }

  private isDatesValid(startDate: Date, endDate: Date): boolean {
    if (startDate <= endDate) {
      return true;
    }
    return false;
  }

  private isResolutionMeterValid(minResolutionMeter?: number, maxResolutionMeter?: number): boolean {
    if (minResolutionMeter == undefined || maxResolutionMeter == undefined) {
      return true;
    }
    return minResolutionMeter <= maxResolutionMeter;
  }

  private isPolygonValid(polygon: Polygon): ValidationResponse {
    if (!this.validatePolygonSchema(polygon)) {
      return {
        isValid: false,
        message: `Invalid polygon provided. Must be in a GeoJson format of a Polygon. Should contain "type" and "coordinates" only. polygon: ${JSON.stringify(
          polygon
        )}`,
      };
    }
    if (!this.validateCoordinates(polygon)) {
      return {
        isValid: false,
        message: `Wrong polygon: ${JSON.stringify(polygon)} the first and last coordinates should be equal`,
      };
    }
    return { isValid: true };
  }

  // For now, the validation will be only warning.
  private isProductTypeValid(productType: ProductType): boolean {
    const logContext = { ...this.logContext, function: this.isProductTypeValid.name };
    if (productType != ProductType.PHOTO_REALISTIC_3D) {
      this.logger.warn({
        msg: 'product type is not 3DPhotoRealistic!',
        logContext,
      });
      return true; // TODO: lets check if it should be returned as false
    }
    this.logger.debug({
      msg: 'productType validated successfully!',
      logContext,
    });
    return true;
  }
}
