import { constants as fsConstants } from 'node:fs';
import { readFile, access } from 'node:fs/promises';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { union, intersect, area, featureCollection, polygon } from '@turf/turf';
import { Feature, MultiPolygon, Polygon } from 'geojson';
import { ProductType } from '@map-colonies/mc-model-types';
import Ajv from 'ajv';
import { Tracer } from '@opentelemetry/api';
import { withSpanAsyncV4, withSpanV4 } from '@map-colonies/telemetry';
import { FILE_ENCODING, SERVICES } from '../common/constants';
import { IConfig, IngestionSourcesPayload, LogContext, Provider, ValidationResponse, UpdatePayload } from '../common/interfaces';
import { IngestionPayload } from '../common/interfaces';
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

    const fileContent: string = await readFile(tilesetLocation, { encoding: FILE_ENCODING });
    const polygonResponse = this.getTilesetModelPolygon(fileContent);
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

    const fileContent: string = await readFile(tilesetLocation, { encoding: FILE_ENCODING });
    const polygonResponse = this.getTilesetModelPolygon(fileContent);
    if (typeof polygonResponse == 'string') {
      return {
        isValid: false,
        message: polygonResponse, // NOTE: this shouldn't happen as we call validateSources before
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
    const record = await this.catalog.getRecord(identifier);

    if (record === undefined) {
      return `Record with identifier: ${identifier} doesn't exist!`;
    }

    if (payload.sourceDateStart != undefined || payload.sourceDateEnd != undefined) {
      const sourceDateStart = payload.sourceDateStart ?? record.sourceDateStart!;
      const sourceDateEnd = payload.sourceDateEnd ?? record.sourceDateEnd!;
      const isDatesValid = this.isDatesValid(sourceDateStart, sourceDateEnd);
      if (!isDatesValid) {
        return 'sourceStartDate should not be later than sourceEndDate';
      }
    }

    if (payload.footprint != undefined) {
      const isFootprintPolygonValid: ValidationResponse = this.isPolygonValid(payload.footprint);
      if (!isFootprintPolygonValid.isValid) {
        return isFootprintPolygonValid.message!;
      }
      const tilesetPath = extractLink(record.links);

      const logContext = { ...this.logContext, function: this.validateUpdate.name };
      this.logger.debug({
        msg: 'Extracted full path to tileset',
        logContext,
        tilesetPath,
      });
      const fileContent: string = await this.provider.getFile(tilesetPath);
      const polygonResponse = this.getTilesetModelPolygon(fileContent);
      if (typeof polygonResponse == 'string') {
        return polygonResponse;
      }
      const intersectsResponse = this.isFootprintAndModelIntersects(payload.footprint, polygonResponse);
      if (!intersectsResponse.isValid) {
        return intersectsResponse.message!;
      }
    }

    if (payload.classification != undefined) {
      const classificationResponse = await this.isClassificationValid(payload.classification);
      if (!classificationResponse.isValid) {
        return classificationResponse.message!;
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

  private getTilesetModelPolygon(fileContent: string): Polygon | string {
    const logContext = { ...this.logContext, function: this.getTilesetModelPolygon.name };
    try {
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
      const message = `File tileset validation failed`;
      this.logger.error({
        msg: message,
        logContext,
        fileContent,
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
