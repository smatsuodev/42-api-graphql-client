# Overview
This project is developing a GraphQL Client for the 42 API.

Many users found the 42 API, which is a REST API, difficult to use, leading to a demand for a more expressive GraphQL wrapper API. Additionally, the official documentation is incomplete.

Therefore, this project aims to "document the 42 API," "develop a more user-friendly client," and "visualize the 42 API."

Documentation is achieved by developing a program that automatically generates an OpenAPI schema (currently under development in `src/collect/`).

For the client, the OpenAPI schema is converted into a GraphQL schema using GraphQL Mesh and then distributed via Hive Gateway.

For 42 API visualization, a Kibana-like visualizer is currently under development in `dashboard/`.

# Development workflow
Use context7 when you use any library since your knowledge may be not latest.
When planning or making changes to the code, follow t-wada's recommended TDD approach to clarify the specifications.
After the series of changes are complete, run `bun typecheck`, `bun lint:fix`, and run tests.