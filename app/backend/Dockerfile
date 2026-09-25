FROM node:26-alpine AS build

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package*.json ./
RUN npm ci --include=dev

COPY --chown=node:node tsconfig.json ./
COPY --chown=node:node src/ ./src/
RUN npm run build

FROM node:26-alpine

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

COPY --from=build --chown=node:node /app/build/ /app/

EXPOSE 8081
CMD [ "node", "index.js" ]
