# chat-ai-api

## Backend dependencies

- `express` Backend web framework
- `cors` Access resources from a different origin
- `dotenv` Load environment variables from .env
- `stream-chat` Official JS client to work with Stream Chat
- `openai` Open AI client
- `typescript` Add types to JavaScript
- `tsx` Execute Typescript
- `drizzle-orm` ORM to work with postgres
- `drizzle-kit` CLI for Drizzle

```sh
npm i express cors dotenv stream-chat openai
```

```sh
npm i -D typescript tsx @types/node @types/express @types/cors
```

```sh
npx tsc --init
```

## Database

```sh
npm i drizzle-orm @neondatabase/serverless
```

```sh
npm i -D drizzle-kit
```

```sh
npx drizzle-kit generate
```

```sh
npx drizzle-kit migrate
```
