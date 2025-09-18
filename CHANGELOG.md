# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.7.4](https://github.com/MapColonies/3d-gateway/compare/v2.7.3...v2.7.4) (2025-09-18)


### Dependency Updates

* upgrade storage-explorer-middleware from v1.2.5 to v1.3.0 (MAPCO-8722) ([#46](https://github.com/MapColonies/3d-gateway/issues/46)) ([3d9d2d4](https://github.com/MapColonies/3d-gateway/commit/3d9d2d42cbe47bc5da8d6d0fe3ef84d4770a7619))

## [2.7.3](https://github.com/MapColonies/3d-gateway/compare/v2.7.2...v2.7.3) (2025-09-01)


### Bug Fixes

* enable update of metadata when same name is used (MAPCO-8593) ([#43](https://github.com/MapColonies/3d-gateway/issues/43)) ([37489d4](https://github.com/MapColonies/3d-gateway/commit/37489d41ea612d2aa5c8ffa2e98617b142cc0a93))


### Helm Changes

* add mc labels and annotations package (MAPCO-8562) ([#41](https://github.com/MapColonies/3d-gateway/issues/41)) ([be8ddb9](https://github.com/MapColonies/3d-gateway/commit/be8ddb9374460f3902d7fe8003a55d9b4832c962))

## [2.7.2](https://github.com/MapColonies/3d-gateway/compare/v2.7.1...v2.7.2) (2025-07-31)


### Bug Fixes

* fix Ingestion Is Published Bug (MAPCO-8412) ([#37](https://github.com/MapColonies/3d-gateway/issues/37)) ([d2dac26](https://github.com/MapColonies/3d-gateway/commit/d2dac26528dd6c993976c3f743cb74345d70e4c8))

### [2.7.1](https://github.com/MapColonies/3d-gateway/compare/v2.7.0...v2.7.1) (2025-07-27)


### Bug Fixes

* fix store trigger call ([#36](https://github.com/MapColonies/3d-gateway/issues/36)) ([f57969e](https://github.com/MapColonies/3d-gateway/commit/f57969eac78a0ab86a0fb40de8008221bba1e24d))

## [2.7.0](https://github.com/MapColonies/3d-gateway/compare/v2.6.1...v2.7.0) (2025-07-27)


### Features

* handle delete functionality (MAPCO-3799) ([#35](https://github.com/MapColonies/3d-gateway/issues/35)) ([8b2e923](https://github.com/MapColonies/3d-gateway/commit/8b2e923d54318014e3292b0f3297abef93be9775))

### [2.6.1](https://github.com/MapColonies/3d-gateway/compare/v2.6.0...v2.6.1) (2025-06-16)


### Bug Fixes

* fix trim and spaces in product name ([#34](https://github.com/MapColonies/3d-gateway/issues/34)) ([3750a4c](https://github.com/MapColonies/3d-gateway/commit/3750a4c6d5c6de58a9bcf907a03d5a10c7a4484f))

## [2.6.0](https://github.com/MapColonies/3d-gateway/compare/v2.5.1...v2.6.0) (2025-06-10)


### Features

* validate productName is unique ([#32](https://github.com/MapColonies/3d-gateway/issues/32)) ([e9564d8](https://github.com/MapColonies/3d-gateway/commit/e9564d8710419aaea37a7309a8afcd24dcd7afc7))


### Bug Fixes

* handle store trigger BadRequest response (MAPCO-7785) ([#33](https://github.com/MapColonies/3d-gateway/issues/33)) ([12026e5](https://github.com/MapColonies/3d-gateway/commit/12026e578f3a93cad9705f72d024a4743289b548))

### [2.5.1](https://github.com/MapColonies/3d-gateway/compare/v2.5.0...v2.5.1) (2025-04-02)


### Bug Fixes

* set name to 120 chars ([#31](https://github.com/MapColonies/3d-gateway/issues/31)) ([2611c5f](https://github.com/MapColonies/3d-gateway/commit/2611c5f2db93f2426bc5be614d6a976ab17cd48b))

## [2.5.0](https://github.com/MapColonies/3d-gateway/compare/v2.4.6...v2.5.0) (2025-01-19)


### Features

* trim footprints to 2D coordinates ([#30](https://github.com/MapColonies/3d-gateway/issues/30)) ([40cf8d3](https://github.com/MapColonies/3d-gateway/commit/40cf8d3138c9b0c76967e465b725d8a4ac700a9e))

### [2.4.6](https://github.com/MapColonies/3d-gateway/compare/v2.4.4...v2.4.6) (2025-01-13)


### Bug Fixes

* fix polygon to recieve polygon with height ([#28](https://github.com/MapColonies/3d-gateway/issues/28)) ([7bcf070](https://github.com/MapColonies/3d-gateway/commit/7bcf070cf652010a2a88b6c6a6454c11082c7dc6))

### [2.4.5](https://github.com/MapColonies/3d-gateway/compare/v2.4.4...v2.4.5) (2024-12-03)

### [2.4.4](https://github.com/MapColonies/3d-gateway/compare/v2.4.3...v2.4.4) (2024-11-27)

### [2.4.3](https://github.com/MapColonies/3d-gateway/compare/v2.4.2...v2.4.3) (2024-11-26)


### Bug Fixes

* fix polygon bbox validation bug ([#25](https://github.com/MapColonies/3d-gateway/issues/25)) ([45d3b22](https://github.com/MapColonies/3d-gateway/commit/45d3b223d1a6021b8fd81aa4e89e7c68d024ae1e))

### [2.4.2](https://github.com/MapColonies/3d-gateway/compare/v2.4.1...v2.4.2) (2024-09-09)

### [2.4.1](https://github.com/MapColonies/3d-gateway/compare/v2.4.0...v2.4.1) (2024-09-09)


### Bug Fixes

* fix  "pathToTileset" that is passed to store trigge + openAPI tests ([#22](https://github.com/MapColonies/3d-gateway/issues/22)) ([705366a](https://github.com/MapColonies/3d-gateway/commit/705366a885dc0113eafa2fe46c17e30c3026f3fa)), closes [#23](https://github.com/MapColonies/3d-gateway/issues/23)

## [2.4.0](https://github.com/MapColonies/3d-gateway/compare/v2.3.0...v2.4.0) (2024-09-03)


### Features

* validate metadata ([#20](https://github.com/MapColonies/3d-gateway/issues/20)) ([bc89232](https://github.com/MapColonies/3d-gateway/commit/bc8923261231b0e7f26b0ef50cfd22e3f68fcdf6))
