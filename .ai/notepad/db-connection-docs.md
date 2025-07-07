---
title: Use Neon with Cloudflare Workers
subtitle: Connect a Neon Postgres database to your Cloudflare Workers application
enableTableOfContents: true
updatedOn: '2025-06-30T11:30:21.897Z'
---

## Setting up your Neon database

### Initialize a new project

Log in to the Neon Console and navigate to the [Projects](https://console.neon.tech/app/projects) section.

1. Click the **New Project** button to create a new project.

2. From the Neon **Dashboard**, navigate to the **SQL Editor** from the sidebar, and run the following SQL command to create a new table in your database:

   ```sql
   CREATE TABLE books_to_read (
       id SERIAL PRIMARY KEY,
       title TEXT,
       author TEXT
   );
   ```

   Next, insert some sample data into the `books_to_read` table so that you can query it later:

   ```sql
   INSERT INTO books_to_read (title, author)
   VALUES
       ('The Way of Kings', 'Brandon Sanderson'),
       ('The Name of the Wind', 'Patrick Rothfuss'),
       ('Coders at Work', 'Peter Seibel'),
       ('1984', 'George Orwell');
   ```

### Retrieve your Neon database connection string

Navigate to your **Project Dashboard** in the Neon Console and click **Connect** to open the **Connect to your database** modal to find your database connection string. Enable the **Connection pooling** toggle to add the `-pooler` option to your connection string. A pooled connection is recommended for serverless environments. For more information, see [Connection pooling](/docs/connect/connection-pooling).

Your pooled connection string should look similar to this:

```bash
postgresql://alex:AbC123dEf@ep-cool-darkness-123456-pooler.us-east-2.aws.neon.tech/dbname?sslmode=require&channel_binding=require
```

Keep your connection string handy for later use.

## Setting up your Cloudflare Workers project

### Create a new Worker project

Run the following command in a terminal window to set up a new Cloudflare Workers project:

```bash
npm create cloudflare@latest
```

This initiates an interactive CLI prompt to generate a new project. To follow along with this guide, you can use the following settings:

```bash
├ In which directory do you want to create your application?
│ dir ./my-neon-worker
│
├ What type of application do you want to create?
│ type "Hello World" Worker
│
├ Do you want to use TypeScript?
│ no typescript
```

When asked if you want to deploy your application, select `no`. We'll develop and test the application locally before deploying it to Cloudflare Workers platform.

The `create-cloudflare` CLI installs the `Wrangler` tool to manage the full workflow of testing and managing your Worker applications.

### Implement the Worker script

We'll use the [Neon serverless driver](/docs/serverless/serverless-driver) to connect to the Neon database, so you need to install it as a dependency:

```bash
npm install @neondatabase/serverless
```

Now, you can update the `src/index.js` file in the project directory with the following code:

```js
import { Client } from '@neondatabase/serverless';

export default {
  async fetch(request, env, ctx) {
    const client = new Client(env.DATABASE_URL);
    await client.connect();
    const { rows } = await client.query('SELECT * FROM books_to_read;');
    return new Response(JSON.stringify(rows));
  },
};
```

The `fetch` handler defined above gets called when the worker receives an HTTP request. It will query the Neon database to fetch the full list of books in our to-read list.

### Test the worker application locally

You first need to configure the `DATABASE_URL` environment variable to point to our Neon database. You can do this by creating a `.dev.vars` file at the root of the project directory with the following content:

```text
DATABASE_URL=YOUR_NEON_CONNECTION_STRING
```

Now, to test the worker application locally, you can use the `wrangler` CLI which comes with the Cloudflare project setup.

```bash
npx wrangler dev
```

This command starts a local server and simulates the Cloudflare Workers environment.

```bash
❯ npx wrangler dev
 ⛅️ wrangler 3.28.1
-------------------
Using vars defined in .dev.vars
Your worker has access to the following bindings:
- Vars:
  - DATABASE_URL: "(hidden)"
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

You can visit `http://localhost:8787` in your browser to test the worker application. It should return a JSON response with the list of books from the `books_to_read` table.

```
[{"id":1,"title":"The Way of Kings","author":"Brandon Sanderson"},{"id":2,"title":"The Name of the Wind","author":"Patrick Rothfuss"},{"id":3,"title":"Coders at Work","author":"Peter Seibel"},{"id":4,"title":"1984","author":"George Orwell"}]
```

## Deploying your application with Cloudflare Workers

### Authenticate Wrangler with your Cloudflare account

Run the following command to link the Wrangler tool to your Cloudflare account:

```bash
npx wrangler login
```

This command will open a browser window and prompt you to log into your Cloudflare account. After logging in and approving the access request for `Wrangler`, you can close the browser window and return to your terminal.

### Add your Neon connection string as a secret

Use Wrangler to add your Neon database connection string as a secret to your Worker:

```bash
npx wrangler secret put DATABASE_URL
```

When prompted, paste your Neon connection string.

# Wrangler Secret Setup for DATABASE_URL

To set up the `DATABASE_URL` for production, run the following command:

```bash
npx wrangler secret put DATABASE_URL
```

Ensure the value matches the connection string format used in `.dev.vars`.
