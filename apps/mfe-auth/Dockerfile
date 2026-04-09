FROM node:20-alpine

WORKDIR /workspace/apps/mfe-auth

# Install dependencies first for better layer caching.
COPY apps/mfe-auth/package*.json ./
RUN npm install

# Copy the auth source and shared tsconfig used by the app tsconfig extends path.
COPY apps/mfe-auth/ ./
COPY tsconfig.base.json /workspace/tsconfig.base.json

EXPOSE 3001

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3001"]