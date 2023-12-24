# Gateway
The 3D-Gateway is the starting point of 3d-services and is responsible for validating incoming requests and routing them to the desired services. Once the validation is complete, it sends the request to the target service for further processing.

## Functionality
The Gateway service performs the following steps:

Request Validation: Upon receiving a request, the service validates the request to ensure it meets the required criteria. This validation step helps to ensure that only valid requests proceed to the next stage of the process.

Request Forwarding: Once the request passes the validation, the gateway service forwards the request to the desired service:
If it is an ingestion request -> The request will be forwarded to StoreTrigger service.
The StoreTrigger service is responsible for creating jobs and initiating the synchronization process.
If it is an update request -> The request will be forwarded to catalog service (CRUD).
The catalog service is responsible for creating and updating metadata of models in postgres DB.

## Usage
To utilize the Gateway service, you need to send a request to its endpoint with the required information. The service will then validate the request and forward it to the StoreTrigger/Catalog service.

Ensure that both the Gateway service and the external services are running and properly configured to ensure the smooth flow of the process.

## Installation

Install deps with npm

```bash
npm install
```
### Install Git Hooks
```bash
npx husky install
```

## Run Locally

Clone the project

```bash

git clone https://link-to-project

```

Go to the project directory

```bash

cd my-project

```

Install dependencies

```bash

npm install

```

Start the script

```bash

npm run start -- [parameter1] [parameter 2] [...]

```

## Running Tests

To run tests, run the following command

```bash

npm run test

```

To only run unit tests:
```bash
npm run test:unit
```

To only run integration tests:
```bash
npm run test:integration
```