import * as fs from 'fs';
import config from 'config';
import { randBetweenDate, randNumber, randPastDate, randSentence, randUuid, randWord } from '@ngneat/falso';
import { Polygon } from 'geojson';
import { Layer3DMetadata, ProductType, RecordStatus, RecordType } from '@map-colonies/mc-model-types';
import { IngestionPayload, UpdatePayload } from '../../src/common/interfaces';
import { StoreTriggerPayload } from '../../src/externalServices/storeTrigger/interfaces';
import { ILookupOption } from '../../src/externalServices/lookupTables/interfaces';

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
    value: randWord(),
    translationCode: randWord(),
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

export const createWrongFootprintSchema = (): Polygon => {
  return {
    box: 'bla',
    type: 'Polygon',
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

export const createUuid = (): string => {
  return randUuid();
};

export const getBasePath = (): string => {
  return basePath;
};

export const createModelPath = (modelName = 'Sphere'): string => {
  return `${getBasePath()}\\${modelName}`;
};

export const createMountedModelPath = (modelName = 'Sphere'): string => {
  return `${pvPath}/${modelName}`;
};

export const createTilesetFileName = (): string => {
  return 'tileset.json';
};

export const createFootprint = (modelName = 'Sphere'): Polygon => {
  const jsonString: string = fs.readFileSync(`${pvPath}/${modelName}/footprint.json`, 'utf8');
  return JSON.parse(jsonString) as Polygon;
};

export const createMetadataWithoutProductSource = (modelName = 'Sphere'): Omit<Layer3DMetadata, 'productSource'> => {
  const sourceDateStart = randPastDate();
  const sourceDateEnd = randBetweenDate({ from: sourceDateStart, to: new Date() });
  const minResolutionMeter = randNumber({ max: maxResolutionMeter });
  return {
    productId: randUuid(),
    productName: randWord(),
    productType: ProductType.PHOTO_REALISTIC_3D,
    description: randSentence(),
    creationDate: randPastDate(),
    sourceDateStart: sourceDateStart,
    sourceDateEnd: sourceDateEnd,
    minResolutionMeter: minResolutionMeter,
    maxResolutionMeter: randNumber({ min: minResolutionMeter, max: maxResolutionMeter }),
    maxAccuracyCE90: randNumber({ min: 0, max: noData }),
    absoluteAccuracyLE90: randNumber({ min: 0, max: noData }),
    accuracySE90: randNumber({ min: 0, max: maxAccuracySE90 }),
    relativeAccuracySE90: randNumber({ min: 0, max: maxAccuracy }),
    visualAccuracy: randNumber({ min: 0, max: maxAccuracy }),
    sensors: [randWord()],
    footprint: createFootprint(modelName),
    heightRangeFrom: randNumber(),
    heightRangeTo: randNumber(),
    srsId: randNumber().toString(),
    srsName: randWord(),
    region: [randWord()],
    classification: randWord(),
    productionSystem: randWord(),
    productionSystemVer: randWord(),
    producerName: randWord(),
    minFlightAlt: randNumber(),
    maxFlightAlt: randNumber(),
    geographicArea: randWord(),
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
    productSource: randWord(),
  };
};

export const createIngestionPayload = (modelName = 'Sphere'): IngestionPayload => {
  return {
    modelPath: createModelPath(modelName),
    tilesetFilename: createTilesetFileName(),
    metadata: createMetadataWithoutProductSource(modelName),
  };
};

export const createStoreTriggerPayload = (pathToTileset: string): StoreTriggerPayload => {
  return {
    modelId: createUuid(),
    pathToTileset,
    tilesetFilename: createTilesetFileName(),
    metadata: createMetadata(),
  };
};

export const createLookupOptions = (amount = randNumber({ min: 1, max: 3 })): ILookupOption[] => {
  const lookupOptions: ILookupOption[] = [];
  for (let i = 0; i < amount; i++) {
    lookupOptions.push(createLookupOption());
  }
  return lookupOptions;
};

export const createUpdatePayload = (): Partial<UpdatePayload> => {
  const minResolutionMeter = randNumber({ max: maxResolutionMeter });
  const payload: UpdatePayload = {
    productName: randWord(),
    description: randWord(),
    creationDate: randPastDate(),
    classification: randWord(),
    minResolutionMeter: minResolutionMeter,
    maxResolutionMeter: randNumber({ min: minResolutionMeter, max: maxResolutionMeter }),
    maxAccuracyCE90: randNumber({ max: noData }),
    absoluteAccuracyLE90: randNumber({ max: noData }),
    accuracySE90: randNumber({ max: maxAccuracySE90 }),
    relativeAccuracySE90: randNumber({ max: maxAccuracy }),
    visualAccuracy: randNumber({ max: maxAccuracy }),
    heightRangeFrom: randNumber(),
    heightRangeTo: randNumber(),
    producerName: randWord(),
    minFlightAlt: randNumber(),
    maxFlightAlt: randNumber(),
    geographicArea: randWord(),
  };
  return payload;
};
