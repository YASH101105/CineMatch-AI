# CineMatch AI 2.0

CineMatch is a movie discovery and recommendation platform designed to help users explore films and find their next watch. The project brings together a React frontend and a Java Spring Boot backend, with PostgreSQL for data storage.

## Features

- Browse and discover movies through a cinematic interface.
- Search for movies by title (where the movie-data/API integration is configured).
- View movie details and recommendations supported by the backend.
- React-based frontend for an interactive user experience.
- Spring Boot REST API architecture.
- PostgreSQL database integration.

> Features available in a running instance depend on the frontend and backend code and the configuration of any external movie-data API.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, JavaScript, CSS |
| Backend | Java, Spring Boot |
| Database | PostgreSQL |
| API style | REST |
| Frontend tooling | Node.js, npm (and Vite if configured in the frontend) |
| Backend build | Maven (if configured in the backend) |

## Getting started

### Prerequisites

Install the tools used by the project:

- Node.js and npm
- Java Development Kit (JDK)
- PostgreSQL
- Maven, if the backend uses Maven

### 1. Configure the database

Create a PostgreSQL database for CineMatch, then update the backend's local configuration with the database URL, username, and password.

Keep credentials and API keys out of source control. Use environment variables or a local, untracked configuration file.

### 2. Run the backend

From the backend directory containing `pom.xml`, run:

```bash
mvn spring-boot:run
```

If the project includes the Maven wrapper, you can use `./mvnw spring-boot:run` instead.

### 3. Run the frontend

From the frontend directory containing `package.json`, run:

```bash
npm install
npm run dev
```

Use the local URL printed by the frontend development server. If the frontend and backend run on different ports, ensure the API base URL and backend CORS settings are configured correctly.

### 4. Build for production

From the frontend directory:

```bash
npm run build
```

## Project structure

The exact directory names may differ depending on the current project files. A typical layout is:

```text
CineMatch/
├── frontend/       # React user interface
├── backend/        # Spring Boot REST API
└── README.md
```

## Security notes

- Do not commit `.env` files containing secrets, passwords, or API keys.
- Keep `node_modules/`, build output, and generated files out of Git.
- Add project-specific setup details and screenshots as the application evolves.

## Author

**Yash Rastogi**

- GitHub: [@YASH101105](https://github.com/YASH101105)

---

CineMatch is a learning and development project. Update this README as features, setup steps, and integrations are finalized.
