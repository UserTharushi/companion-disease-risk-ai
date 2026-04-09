FROM node:20-alpine

WORKDIR /workspace/apps/shell

# Install dependencies first for better layer caching.
COPY apps/shell/package*.json ./
RUN npm install

# Copy the shell source and shared tsconfig used by the app tsconfig extends path.
COPY apps/shell/ ./
COPY tsconfig.base.json /workspace/tsconfig.base.json

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
