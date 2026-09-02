# API tests

End-to-end tests against a running API and a real Postgres. They exercise the
HTTP surface rather than mocking it, because the bugs worth catching here —
payload shapes the client actually sends, cross-user isolation, signed file
URLs — only show up over the wire.

```bash
# 1. A database (any Postgres; a throwaway one is fine)
export DATABASE_URL="postgresql://postgres@localhost:5432/dailyq_test"
npm run prisma:migrate --workspace apps/api

# 2. The API, with test values for the secrets
npm run dev --workspace apps/api

# 3. The tests, pointed at it
TEST_API_URL=http://localhost:3000 npm test --workspace apps/api
```

The AI endpoints are covered up to the point where they call OpenAI: with a
placeholder `OPENAI_API_KEY` the request fails at the provider, which is exactly
what the access-gate and quota assertions need to observe. Nothing here spends
real credit.
