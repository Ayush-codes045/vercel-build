# Vercel Build


This project is a full-stack, Vercel-like application designed to automate the build and deployment of web applications from a Git repository. It leverages a microservices architecture, utilizing AWS ECS for containerized build environments, S3 for artifact storage, and a robust messaging system with Kafka for real-time logging and status updates.

## Architecture Overview

The platform is composed of four main services that work together to provide a seamless deployment experience:

1.  **`frontend-nextjs`**: The user-facing web application built with Next.js and Tailwind CSS. It provides the UI for user authentication, project creation, deployment management, and viewing real-time build logs.

2.  **`api-server`**: An Express.js backend that serves as the central control plane. It manages user data, projects, and deployments using a PostgreSQL database with Prisma. It receives requests from the frontend, triggers build jobs on AWS ECS, and consumes status/log messages from Kafka. It also uses ClickHouse for efficient log storage and retrieval.

3.  **`build-server`**: A Dockerized Node.js environment responsible for executing build tasks. When triggered by the API server, it clones the specified Git repository, runs `npm install` and `npm run build`, and pushes the resulting static assets to an S3 bucket. It continuously publishes its status and logs to Kafka topics throughout the process.

4.  **`s3-reverse-proxy`**: A lightweight Express.js server that acts as a reverse proxy. It routes incoming requests from project subdomains (e.g., `your-project.localhost:8000`) to the appropriate build artifacts stored in S3, effectively serving the deployed static site to the end-user.

## Features

-   **JWT-based Authentication**: Secure user registration and login functionality.
-   **Project Management**: Users can create projects by providing a Git repository URL.
-   **Automated Deployments**: One-click deployment triggers that spin up isolated build environments on AWS ECS Fargate.
-   **Real-time Logging**: Build logs are streamed from the build server via Kafka and displayed in real-time on the frontend.
-   **Static Site Hosting**: Built assets are stored in and served from an AWS S3 bucket.
-   **Dynamic Subdomain Routing**: The reverse proxy dynamically maps subdomains to the latest successful deployment for each project.
-   **Scalable Event-Driven Architecture**: Kafka is used as a message broker for robust, decoupled communication between the API and build servers.
-   **Efficient Log Storage**: Build logs are ingested into ClickHouse for fast and efficient querying.

## Core Technologies

| Service             | Technologies Used                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| **Frontend**        | Next.js, React, TypeScript, Tailwind CSS, Shadcn UI, Axios                                          |
| **API Server**      | Node.js, Express.js, Prisma, PostgreSQL, KafkaJS, AWS SDK (ECS), JWT, Zod, ClickHouse, bcryptjs      |
| **Build Server**    | Docker, Node.js, AWS SDK (S3), KafkaJS, `child_process`                                               |
| **Reverse Proxy**   | Node.js, Express.js, `http-proxy`, PostgreSQL Client                                                |
| **Infrastructure**  | AWS ECS, AWS S3, Aiven (for PostgreSQL, Kafka, ClickHouse), Docker                                    |

## Deployment Workflow

1.  A user registers and logs in via the Next.js frontend.
2.  The user creates a new project by submitting a Git repository URL. The `api-server` saves this project to the PostgreSQL database and generates a unique subdomain.
3.  The user clicks "Deploy" on a project.
4.  The frontend sends a request to the `api-server`. The `api-server` creates a deployment record with a `QUEUED` status and launches an AWS ECS task using the `build-server` image.
5.  The `build-server` container starts, clones the specified Git repository, and begins the build process (`npm install && npm run build`).
6.  Throughout the build, the `build-server` publishes logs and status updates (e.g., `IN_PROGRESS`) to dedicated Kafka topics.
7.  The `api-server` consumes these Kafka messages, updating the deployment status in PostgreSQL and storing logs in ClickHouse.
8.  The frontend polls API endpoints to fetch the latest status and logs, providing real-time feedback to the user.
9.  Upon a successful build, the `build-server` uploads the `dist` directory to an S3 bucket, structured by `deploymentId`, and sends a final `READY` status to Kafka. If the build fails, it sends a `FAILED` status.
10. A request to `[subdomain].localhost:8000` is handled by the `s3-reverse-proxy`.
11. The proxy queries the database to find the latest `READY` deployment ID for that subdomain.
12. Finally, it proxies the request to the corresponding directory in the S3 bucket, serving the static files.

## Setup and Configuration

### Prerequisites

*   Node.js
*   Docker
*   Git
*   AWS Account with configured credentials
*   Aiven Account (or self-hosted PostgreSQL, Kafka, and ClickHouse instances)

### Environment Variables

Each service requires a set of environment variables. Ensure you have the necessary values for your AWS credentials, database connection strings, and Kafka broker details. The primary configuration files are:
- `api-server/.env`
- `build-server/` (variables are passed via ECS task definition)
- `s3-reverse-proxy/.env`

### Running Locally

1.  **API Server**
    ```bash
    cd api-server
    npm install
    # Set up the database schema
    npx prisma migrate dev
    # Start the server
    npm start
    ```

2.  **S3 Reverse Proxy**
    ```bash
    cd s3-reverse-proxy
    npm install
    npm start
    ```

3.  **Frontend**
    ```bash
    cd frontend-nextjs
    npm install
    npm run dev
    ```

4.  **Build Server**
    The build server runs as a Docker container managed by the API server via AWS ECS. You need to build and push the Docker image to a repository (like ECR) that your ECS task definition can access.
    ```bash
    cd build-server
    docker build -t your-repo/vercel-build-server:latest .
    docker push your-repo/vercel-build-server:latest
    ```
    Ensure the ECS task definition (`builder-task` in the `api-server` config) points to this image.
