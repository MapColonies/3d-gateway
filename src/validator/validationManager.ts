import { constants as fsConstants } from 'node:fs';
import { access } from 'node:fs/promises';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { union, intersect, area, featureCollection, polygon } from '@turf/turf';
import { Feature, MultiPolygon, Polygon, Position } from 'geojson';
import { ProductType } from '@map-colonies/mc-model-types';
import Ajv from 'ajv';
import { Tracer } from '@opentelemetry/api';
import { withSpanAsyncV4, withSpanV4 } from '@map-colonies/telemetry';
import { SERVICES } from '../common/constants';
import { IConfig, LogContext, Provider, ValidationResponse, UpdatePayload, MetaDataType } from '../common/interfaces';
import { footprintSchema } from '../common/constants';
import { LookupTablesCall } from '../externalServices/lookupTables/lookupTablesCall';
import { CatalogCall } from '../externalServices/catalog/catalogCall';
import { convertSphereFromXYZToWGS84, convertRegionFromRadianToDegrees } from './calculatePolygonFromTileset';
import { BoundingRegion, BoundingSphere, TileSetJson } from './interfaces';
import { extractLink } from './extractPathFromLink';

export const ERROR_METADATA_DATE = 'sourceStartDate should not be later than sourceEndDate';
export const ERROR_METADATA_RESOLUTION = 'minResolutionMeter should not be bigger than maxResolutionMeter';
export const ERROR_METADATA_PRODUCT_TYPE = 'product type is not 3DPhotoRealistic!';
export const ERROR_METADATA_BOX_TILESET = `BoundingVolume of box is not supported yet... Please contact 3D team.`;
export const ERROR_METADATA_BAD_FORMAT_TILESET = 'Bad tileset format. Should be in 3DTiles format';
export const ERROR_METADATA_ERRORED_TILESET = `File tileset validation failed`;
export const ERROR_METADATA_FOOTPRINT_FAR_FROM_MODEL = `Wrong footprint! footprint's coordinates is not even close to the model!`;

export interface FailedReason {
  outFailedReason: string;
}

@injectable()
export class ValidationManager {
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
    this.limit = this.config.get<number>('validation.percentageLimit');
  }

  @withSpanAsyncV4
  public async isPathExist(fullPath: string): Promise<boolean> {
    const logContext = { ...this.logContext, function: this.isPathExist.name };
    this.logger.debug({
      msg: 'isPathExist started',
      logContext,
      fullPath,
    });

    const isValid: boolean = await access(fullPath, fsConstants.F_OK)
      .then(() => {
        return true;
      })
      .catch(() => {
        this.logger.error({
          msg: `Path '${fullPath}' doesn't exists`,
          logContext,
          fullPath,
        });
        return false;
      });
    this.logger.debug({
      msg: 'isPathExist ended',
      logContext,
      fullPath,
      isValid,
    });
    return isValid;
  }

  @withSpanAsyncV4
  public async isMetadataValid(metadata: MetaDataType, modelPolygon: Polygon): Promise<ValidationResponse> {
    const logContext = { ...this.logContext, function: this.isMetadataValid.name };
    this.logger.debug({
      msg: 'metadataValid started',
      metadata,
      modelPolygon,
      logContext,
    });

    let result = this.isDatesValid(metadata.sourceDateStart!, metadata.sourceDateEnd!);
    if (!result) {
      return {
        isValid: false,
        message: ERROR_METADATA_DATE,
      };
    }

    result = this.isResolutionMeterValid(metadata.minResolutionMeter, metadata.maxResolutionMeter);
    if (!result) {
      return {
        isValid: false,
        message: ERROR_METADATA_RESOLUTION,
      };
    }

    const sourcesValidationResponse: ValidationResponse = this.isPolygonValid(metadata.footprint as Polygon);
    if (!sourcesValidationResponse.isValid) {
      return sourcesValidationResponse;
    }

    const validationResponse: ValidationResponse = this.isFootprintAndModelIntersects(metadata.footprint as Polygon, modelPolygon);
    if (!validationResponse.isValid) {
      return validationResponse;
    }

    result = this.isProductTypeValid(metadata.productType!);
    if (!result) {
      // For now, this validation will not occur as it returns true.
      return {
        isValid: false,
        message: ERROR_METADATA_PRODUCT_TYPE,
      };
    }

    result = await this.isProductIdValid(metadata.productId!);
    if (!result) {
      return {
        isValid: false,
        message: `Record with productId: ${metadata.productId} doesn't exist!`,
      };
    }

    return this.isClassificationValid(metadata.classification!);
  }

  @withSpanAsyncV4
  public async validateUpdate(identifier: string, payload: UpdatePayload, refReason: FailedReason): Promise<boolean> {
    const record = await this.catalog.getRecord(identifier);

    if (record === undefined) {
      refReason.outFailedReason = `Record with identifier: ${identifier} doesn't exist!`;
      return false;
    }

    if (payload.sourceDateStart != undefined || payload.sourceDateEnd != undefined) {
      const sourceDateStart = payload.sourceDateStart ?? record.sourceDateStart!;
      const sourceDateEnd = payload.sourceDateEnd ?? record.sourceDateEnd!;
      const isDatesValid = this.isDatesValid(sourceDateStart, sourceDateEnd);
      if (!isDatesValid) {
        refReason.outFailedReason = ERROR_METADATA_DATE;
        return false;
      }
    }

    if (payload.footprint != undefined) {
      const isFootprintPolygonValid: ValidationResponse = this.isPolygonValid(payload.footprint);
      if (!isFootprintPolygonValid.isValid) {
        refReason.outFailedReason = isFootprintPolygonValid.message!;
        return false;
      }
      const tilesetPath = extractLink(record.links);
      const logContext = { ...this.logContext, function: this.validateUpdate.name };
      this.logger.debug({
        msg: 'Extracted full path to tileset',
        logContext,
        tilesetPath,
      });
      const fileContent: string = await this.provider.getFile(tilesetPath);
      const failedReason: FailedReason = { outFailedReason: '' };
      const polygonResponse = this.getTilesetModelPolygon(fileContent, failedReason);
      if (polygonResponse == undefined) {
        refReason.outFailedReason = failedReason.outFailedReason;
        return false;
      }
      const intersectsResponse = this.isFootprintAndModelIntersects(payload.footprint, polygonResponse);
      if (!intersectsResponse.isValid) {
        refReason.outFailedReason = intersectsResponse.message!;
        return false;
      }
    }

    if (payload.classification != undefined) {
      const classificationResponse = await this.isClassificationValid(payload.classification);
      if (!classificationResponse.isValid) {
        refReason.outFailedReason = classificationResponse.message!;
        return false;
      }
    }

    return true;
  }

  @withSpanV4
  public isModelPathValid(sourcePath: string, basePath: string): boolean {
    const logContext = { ...this.logContext, function: this.isModelPathValid.name };
    const isValid = sourcePath.includes(basePath);
    this.logger.debug({
      msg: 'modelPath validation',
      isValid,
      logContext,
    });
    return isValid;
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

  @withSpanAsyncV4
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

  public getTilesetModelPolygon(fileContent: string, outReason: FailedReason): Polygon | undefined {
    const logContext = { ...this.logContext, function: this.getTilesetModelPolygon.name };
    try {
      const tileSetJson: TileSetJson = JSON.parse(fileContent) as TileSetJson;
      const shape = tileSetJson.root.boundingVolume;
      if (shape.sphere != undefined) {
        return convertSphereFromXYZToWGS84(shape as BoundingSphere);
      } else if (shape.region != undefined) {
        return convertRegionFromRadianToDegrees(shape as BoundingRegion);
      } else if (shape.box != undefined) {
        outReason.outFailedReason = ERROR_METADATA_BOX_TILESET;
      } else {
        outReason.outFailedReason = ERROR_METADATA_BAD_FORMAT_TILESET;
      }
    } catch (err) {
      const msg = ERROR_METADATA_ERRORED_TILESET;
      this.logger.error({
        msg: msg,
        logContext,
        fileContent,
        err,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      outReason.outFailedReason = msg;
    }
    return undefined;
  }

  public isPolygonValid(polygon: Polygon): ValidationResponse {
    if (!this.validatePolygonSchema(polygon)) {
      return {
        isValid: false,
        message: `Invalid polygon provided. Must be in a GeoJson format of a Polygon. Should contain "type", "coordinates" and "BBOX" only. polygon: ${JSON.stringify(
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
    if (!this.validateCoordinatesAreAll2DOr3D(polygon)) {
      return {
        isValid: false,
        message: `Wrong footprint! footprint's coordinates should be all in the same dimension 2D or 3D`,
      };
    }
    return { isValid: true };
  }

  private validateCoordinates(footprint: Polygon): boolean {
    const length = footprint.coordinates[0].length;
    const first = footprint.coordinates[0][0];
    const last = footprint.coordinates[0][length - 1];
    return first[0] == last[0] && first[1] == last[1];
  }

  private validateCoordinatesAreAll2DOr3D(footprint: Polygon): boolean {
    const expectedLength = footprint.coordinates[0][0].length;
    const isAllPolygonsCoordinatesHasSameDimention = footprint.coordinates.every((polygonInPolygon: Position[]) => {
      const isSameLength = polygonInPolygon.every((coordinate: Position) => coordinate.length === expectedLength);
      return isSameLength;
    });
    return isAllPolygonsCoordinatesHasSameDimention;
  }

  private validatePolygonSchema(footprint: Polygon): boolean {
    const ajv = new Ajv();
    const compiledSchema = ajv.compile(footprintSchema);
    const isPolygon = compiledSchema(footprint);
    return isPolygon;
  }

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
          message: ERROR_METADATA_FOOTPRINT_FAR_FROM_MODEL,
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
    } catch (err) {
      const msg = `An error caused during the validation of the intersection`;
      this.logger.error({
        msg,
        logContext,
        err,
        modelPolygon,
        footprint,
      });
      return {
        isValid: false,
        message: msg,
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

  // For now, the validation will be only warning.
  private isProductTypeValid(productType: ProductType): boolean {
    const logContext = { ...this.logContext, function: this.isProductTypeValid.name };
    if (productType != ProductType.PHOTO_REALISTIC_3D) {
      this.logger.warn({
        msg: ERROR_METADATA_PRODUCT_TYPE,
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
