/* eslint-disable @typescript-eslint/no-magic-numbers */
import * as fs from 'fs';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import * as turf from '@turf/turf'
import { Polygon, } from 'geojson';
import { ProductType } from '@map-colonies/mc-model-types';
import Ajv from 'ajv';
import { SERVICES } from '../common/constants';
import { IConfig, UpdatePayload } from '../common/interfaces';
import { IngestionPayload } from '../common/interfaces';
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
    let result: boolean | string | Polygon;

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
    // result = this.validateFootprint(payload.metadata.footprint as Polygon);
    // if (typeof result == 'string') {
    //   return result;
    // }
    const tilesetPath = `${payload.modelPath}/${payload.tilesetFilename}`;
    this.logger.debug("path", tilesetPath)
    result = this.validateIntersection(payload,payload.metadata.productName!);
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

  public async validateUpdate(identifier: string, payload: UpdatePayload): Promise<boolean | string> {
    let result: boolean | string | Polygon;
    const record = await this.catalog.getRecord(identifier);

    if (record === undefined) {
      return `Record with identifier: ${identifier} doesn't exist!`;
    }

    if (payload.footprint != undefined) {
      result = this.validateFootprint(payload.footprint);
      if (typeof result == 'string') {
        return result;
      }
      // const tilesetPath = extractTilesetPath(record.productSource!, record.links);
      // this.logger.debug({ msg: 'Extracted full path to tileset', tilesetPath });
      // result = this.validateIntersection(payload,payload.productName!);
      // if (typeof result == 'string') {
      //   return result;
      // }
    }

    if (payload.sourceDateStart != undefined || payload.sourceDateEnd != undefined) {
      const sourceDateStart = payload.sourceDateStart ?? record.sourceDateStart!;
      const sourceDateEnd = payload.sourceDateEnd ?? record.sourceDateEnd!;
      result = this.validateDates(sourceDateStart, sourceDateEnd);
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

  public validateModelPath(sourcePath: string): boolean | string {
    const basePath = this.config.get<string>('paths.basePath');

    if (sourcePath.includes(basePath)) {
      this.logger.debug({ msg: 'modelPath validated successfully!' });
      return true;
    }
    return `Unknown model path! The model isn't in the agreed folder!, sourcePath: ${sourcePath}, basePath: ${basePath}`;
  }

  private validateModelName(modelPath: string): boolean | string {
    if (fs.existsSync(`${modelPath}`)) {
      this.logger.debug({ msg: 'modelName validated successfully!' });
      return true;
    }
    return `Unknown model name! The model name isn't in the folder!, modelPath: ${modelPath}`;
  }

  private validateTilesetJson(modelPath: string, tilesetFilename: string): boolean | string {
    if (!fs.existsSync(`${modelPath}/${tilesetFilename}`)) {
      return `Unknown tileset name! The tileset file wasn't found!, tileset: ${modelPath} doesn't exist`;
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

  private async validateProductID(productId: string): Promise<boolean | string> {
    if (!(await this.catalog.isProductIdExist(productId))) {
      return `Record with productId: ${productId} doesn't exist!`;
    }
    this.logger.debug({ msg: 'productId validated successfully!' });
    return true;
  }

  // For now, the validation will be only warning.
  private validateProductType(productType: ProductType, modelName: string): boolean | string {
    if (productType != ProductType.PHOTO_REALISTIC_3D) {
      this.logger.warn({ msg: 'product type is not 3DPhotoRealistic. skipping intersection validation', modelName });
    }
    this.logger.debug({ msg: 'productType validated successfully!' });
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
    this.logger.debug({ msg: 'footprint validated successfully!' });
    return true;
  }

  private convertPolygonToBoundingBox(polygon: turf.Polygon): turf.Polygon {
    const bbox = turf.bbox(polygon);
    const boundingBox: turf.Polygon = {
        type: 'Polygon',
        coordinates: [
            [
                [bbox[0], bbox[1]],
                [bbox[0], bbox[3]],
                [bbox[2], bbox[3]],
                [bbox[2], bbox[1]],
                [bbox[0], bbox[1]] // Closing the polygon
            ]
        ]
    };
    return boundingBox;
}

  public validateIntersection(payload: IngestionPayload, productName: string): Polygon | string {
    try {
        this.logger.debug("blalalalalala")
        const tilesetPath = `${payload.modelPath}/${payload.tilesetFilename}`
        const file: string = fs.readFileSync(tilesetPath, 'utf8');
        console.log("blalala")
        const shape = JSON.parse(file).root.boundingVolume;
        console.log("papapapa")
        console.log("shape", shape)

        let model: Polygon;

        if (shape.sphere !== undefined) {
            model = polygonCalculates.convertSphereFromXYZToWGS84(shape as BoundingSphere);
            console.log("model", model)
        } else if (shape.region !== undefined) {
            model = polygonCalculates.convertRegionFromRadianToDegrees(shape as BoundingRegion);
            console.log("model", model)
        } else if (shape.box !== undefined) {
            return `BoundingVolume of box is not supported yet... Please contact 3D team.`;
        } else {
            throw new Error('Bad tileset format. Should be in 3DTiles format');
        }

        const boundingBoxCoordinates = this.convertPolygonToBoundingBox(model);
        

        this.logger.debug({ msg: 'extracted successfully polygon of the model' ,polygon: boundingBoxCoordinates, modelName: productName });
        return model;

    } catch (error) {
        if (error instanceof SyntaxError) {
            return 'Bad tileset format. Should be in JSON format';
        } else {
            this.logger.error("reading error", error)
            return 'Error reading tileset file';
        }
    



    //   const intersection: Feature<Polygon | MultiPolygon> | null = intersect(footprint, model);

    //   this.logger.debug({
    //     msg: 'intersected successfully between footprint and polygon of the model',
    //     intersection,
    //     modelName: productName,
    //   });

    //   if (intersection == null) {
    //     return `Wrong footprint! footprint's coordinates is not even close to the model!`;
    //   }


    //   this.logger.debug({ msg: 'combined successfully footprint and polygon of the model', combined, modelName: productName });

    //   const areaFootprint = area(footprint);
    //   const areaCombined = area(combined!);
    //   this.logger.debug({
    //     msg: 'calculated successfully the areas',
    //     footprint: areaFootprint,
    //     combined: areaCombined,
    //     modelName: productName,
    //   });
    //   const coverage = (100 * areaFootprint) / areaCombined;

    //   if (coverage < limit) {
    //     return `The footprint is not intersected enough with the model, the coverage is: ${coverage}% when the minimum coverage is ${limit}%`;
    //   }
    //   this.logger.debug({ msg: 'intersection validated successfully!' });
    //   return true;
    // } catch (error) {
    //   this.logger.error({
    //     msg: `An error caused during the validation of the intersection...`,
    //     modelName: productName,
    //     error,
    //   });
    //   throw new AppError('IntersectionError', httpStatus.INTERNAL_SERVER_ERROR, 'An error caused during the validation of the intersection', true);
    }
  }

  private validateDates(startDate: Date, endDate: Date): boolean | string {
    if (startDate <= endDate) {
      this.logger.debug({ msg: 'dates validated successfully!' });
      return true;
    }
    return 'sourceStartDate should not be later than sourceEndDate';
  }

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

  private async validateClassification(classification: string): Promise<boolean | string> {
    const classifications = await this.lookupTables.getClassifications();
    if (classifications.includes(classification)) {
      this.logger.debug({ msg: 'classification validated successfully!' });
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
