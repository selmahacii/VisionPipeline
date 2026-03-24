FROM node:18-slim

WORKDIR /app

# Ensure we have a package.json to install from
# Note: I'll create this in a later step if it's missing
COPY package.json . 
# If package-lock exists: COPY package-lock.json .

RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
