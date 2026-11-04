FROM node:22-slim

WORKDIR /app
RUN chown node:node /app

USER node

COPY --chown=node:node package*.json ./
RUN npm ci

COPY --chown=node:node . .

CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
