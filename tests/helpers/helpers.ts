import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import config from 'config';
import { Polygon } from 'geojson';
import { faker } from '@faker-js/faker';
import { Layer3DMetadata, ProductType, RecordStatus, RecordType } from '@map-colonies/mc-model-types';
import { IngestionPayload, UpdatePayload, UpdateStatusPayload } from '../../src/common/interfaces';
import { StoreTriggerDeletePayload, StoreTriggerIngestionPayload } from '../../src/externalServices/storeTrigger/interfaces';
import { ILookupOption } from '../../src/externalServices/lookupTables/interfaces';
import { Record3D } from '../../src/externalServices/catalog/interfaces';

const maxResolutionMeter = 8000;
const noData = 999;
const maxAccuracySE90 = 250;
const maxAccuracy = 100;
const minX = 1;
const minY = 2;
const maxX = 3;
const maxY = 4;
const pvPath = config.get<string>('paths.pvPath');
const basePath = config.get<string>('paths.basePath');

const createLookupOption = (): ILookupOption => {
  return {
    value: faker.word.sample(),
    translationCode: faker.word.sample(),
  };
};

export const createWrongFootprintCoordinates = (): Polygon => {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
      ],
    ],
  };
};

export const createWrongFootprintMixed2D3D = (): Polygon => {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minX, minY, maxY],
        [maxX, maxY],
        [maxX, maxY],
        [minX, minY, maxY],
      ],
    ],
  } as unknown as Polygon;
};

export const createWrongFootprintSchema = (): Polygon => {
  return {
    box: 'bla',
    type: 'Point',
    coordinates: [
      [
        [minX, minY],
        [maxX, maxY],
        [maxX, maxY],
        [minX, minY],
      ],
    ],
  } as unknown as Polygon;
};

export const getTileset = (model = 'Sphere'): Buffer => {
  return readFileSync(`${pvPath}/${model}/tileset.json`);
};

export const getBasePath = (): string => {
  return basePath;
};

export const createLinks = (tileset = 'tileset.json'): string => {
  return `https://localhost:8080/route/to/tiles/api/3d/v1/b3dm/${faker.string.uuid()}/${tileset}`;
};

export const createModelPath = (modelName = 'Sphere'): string => {
  return `${getBasePath()}\\${modelName}`;
};

export const getModelNameByPath = (modelPath: string): string => {
  return modelPath.replace(`${getBasePath()}\\`, '');
};

export const createMountedModelPath = (modelName = 'Sphere'): string => {
  const mountedPath = join(pvPath, modelName);
  return mountedPath;
};

export const createTilesetFileName = (): string => {
  return 'tileset.json';
};

export const createFootprint = (modelName = 'Sphere', is3D = false): Polygon => {
  const fileName = !is3D ? 'footprint' : 'footprint3D';
  const jsonString: string = readFileSync(`${pvPath}/${modelName}/${fileName}.json`, 'utf8');
  return JSON.parse(jsonString) as Polygon;
};

export const createMetadataWithoutProductSource = (modelName = 'Sphere'): Omit<Layer3DMetadata, 'productSource'> => {
  const sourceDateStart = faker.date.past();
  const sourceDateEnd = faker.date.between({ from: sourceDateStart, to: new Date() });
  const minResolutionMeter = faker.number.int({ max: maxResolutionMeter });
  return {
    productId: faker.string.uuid(),
    productName: faker.word.sample(),
    productType: ProductType.PHOTO_REALISTIC_3D,
    description: faker.word.words(),
    creationDate: faker.date.past(),
    sourceDateStart: sourceDateStart,
    sourceDateEnd: sourceDateEnd,
    minResolutionMeter: minResolutionMeter,
    maxResolutionMeter: faker.number.int({ min: minResolutionMeter, max: maxResolutionMeter }),
    maxAccuracyCE90: faker.number.int({ min: 0, max: noData }),
    absoluteAccuracyLE90: faker.number.int({ min: 0, max: noData }),
    accuracySE90: faker.number.int({ min: 0, max: maxAccuracySE90 }),
    relativeAccuracySE90: faker.number.int({ min: 0, max: maxAccuracy }),
    visualAccuracy: faker.number.int({ min: 0, max: maxAccuracy }),
    sensors: [faker.word.sample()],
    footprint: createFootprint(modelName),
    heightRangeFrom: faker.number.int(),
    heightRangeTo: faker.number.int(),
    srsId: faker.number.int().toString(),
    srsName: faker.word.sample(),
    region: [faker.word.sample()],
    classification: faker.word.sample(),
    productionSystem: faker.word.sample(),
    productionSystemVer: faker.word.sample(),
    producerName: faker.word.sample(),
    minFlightAlt: faker.number.int(),
    maxFlightAlt: faker.number.int(),
    geographicArea: faker.word.sample(),
    productStatus: RecordStatus.UNPUBLISHED,
    productBoundingBox: undefined,
    productVersion: undefined,
    type: RecordType.RECORD_3D,
    updateDate: undefined,
  };
};

export const createMetadata = (modelName = 'Sphere'): Layer3DMetadata => {
  return {
    ...createMetadataWithoutProductSource(modelName),
    productSource: createModelPath(modelName),
  };
};

export const createRecord = (modelName = 'Sphere'): Record3D => {
  return {
    ...createMetadata(modelName),
    id: faker.string.uuid(),
    links: createLinks(),
  };
};

export const createIngestionPayload = (modelName = 'Sphere'): IngestionPayload => {
  return {
    modelPath: createModelPath(modelName),
    tilesetFilename: createTilesetFileName(),
    metadata: createMetadataWithoutProductSource(modelName),
  };
};

export const createStoreTriggerPayload = (pathToTileset: string): StoreTriggerIngestionPayload => {
  return {
    modelId: faker.string.uuid(),
    pathToTileset,
    tilesetFilename: createTilesetFileName(),
    metadata: createMetadata(),
  };
};

export const createStoreTriggerDeletePayload = (modelId: string = faker.string.uuid()): StoreTriggerDeletePayload => {
  return {
    modelId: modelId,
    productId: modelId,
    productType: ProductType.PHOTO_REALISTIC_3D,
    productName: faker.word.sample(),
    producerName: faker.word.sample(),
    productVersion: faker.number.int(),
  };
};

export const createLookupOptions = (amount = faker.number.int({ min: 1, max: 3 })): ILookupOption[] => {
  const lookupOptions: ILookupOption[] = [];
  for (let i = 0; i < amount; i++) {
    lookupOptions.push(createLookupOption());
  }
  return lookupOptions;
};

export const createUpdatePayload = (modelName = 'Sphere'): Partial<UpdatePayload> => {
  const minResolutionMeter = faker.number.int({ max: maxResolutionMeter });
  const sourceDateStart = faker.date.past();
  const sourceDateEnd = faker.date.between({ from: sourceDateStart, to: new Date() });
  const payload: UpdatePayload = {
    productName: faker.word.sample(),
    description: faker.word.sample(),
    sourceDateStart: sourceDateStart,
    sourceDateEnd: sourceDateEnd,
    creationDate: faker.date.past(),
    footprint: createFootprint(modelName),
    classification: faker.word.sample(),
    minResolutionMeter: minResolutionMeter,
    maxResolutionMeter: faker.number.int({ min: minResolutionMeter, max: maxResolutionMeter }),
    maxAccuracyCE90: faker.number.int({ max: noData }),
    absoluteAccuracyLE90: faker.number.int({ max: noData }),
    accuracySE90: faker.number.int({ max: maxAccuracySE90 }),
    relativeAccuracySE90: faker.number.int({ max: maxAccuracy }),
    visualAccuracy: faker.number.int({ max: maxAccuracy }),
    heightRangeFrom: faker.number.int(),
    heightRangeTo: faker.number.int(),
    producerName: faker.word.sample(),
    minFlightAlt: faker.number.int(),
    maxFlightAlt: faker.number.int(),
    geographicArea: faker.word.sample(),
  };
  return payload;
};

export const createUpdateStatusPayload = (): UpdateStatusPayload => {
  return {
    productStatus: 'UNPUBLISHED',
  };
};
